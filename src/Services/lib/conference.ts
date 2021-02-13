import { Redis } from 'ioredis';
import _ from 'lodash';
import { Router } from 'mediasoup/lib/Router';
import { Consumer, MediaKind, Producer, RtpCapabilities, WebRtcTransportOptions } from 'mediasoup/lib/types';
import config from '../config';
import { SuccessOrError } from './communication-types';
import Connection from './connection';
import Logger from './logger';
import { StreamInfoRepo } from './pader-conference/steam-info-repo';
import { Participant, ProducerSource } from './participant';
import { RoomManager } from './room-manager';
import { ISignalWrapper } from './signal-wrapper';
import {
   ChangeProducerSourceRequest,
   ChangeStreamRequest,
   ConnectionMessage,
   ConnectTransportRequest,
   CreateTransportRequest,
   CreateTransportResponse,
   ProducerChangedEventArgs,
   TransportProduceRequest,
   TransportProduceResponse,
} from './types';
import * as errors from './errors';

const logger = new Logger('Conference');

export class Conference {
   private connections: Map<string, Connection> = new Map();
   private roomManager: RoomManager;

   /** participantId -> Participant */
   private participants: Map<string, Participant> = new Map();
   private streamInfoRepo: StreamInfoRepo;

   constructor(private router: Router, public conferenceId: string, private signal: ISignalWrapper, redis: Redis) {
      this.roomManager = new RoomManager(conferenceId, signal, router, redis);
      this.streamInfoRepo = new StreamInfoRepo(redis, conferenceId);
   }

   get routerCapabilities(): RtpCapabilities {
      return this.router.rtpCapabilities;
   }

   public close(): void {
      logger.info('Close conference %s', this.conferenceId);
      this.router.close();
   }

   public async addConnection(connection: Connection): Promise<void> {
      // create locally
      this.connections.set(connection.connectionId, connection);

      // search participant, check if it already exists
      let participant = this.participants.get(connection.participantId);
      if (!participant) {
         participant = new Participant(connection.participantId);

         // does not exist, add
         this.participants.set(connection.participantId, participant);
      }

      // add connection
      participant.connections.push(connection);

      // notify room manager
      await this.roomManager.updateParticipant(participant);

      // update streams
      await this.streamInfoRepo.updateStreams(this.participants.values());
   }

   public async removeConnection(connectionId: string): Promise<SuccessOrError> {
      const connection = this.connections.get(connectionId);
      if (!connection) return { success: false, error: errors.connectionNotFound(connectionId) };

      this.connections.delete(connection.connectionId);

      // if that was the last connection of this participant, remove participant
      const participant = this.participants.get(connection.participantId);
      if (participant) {
         // remove connection from participant
         _.remove(participant.connections, (x) => x.connectionId === connection.connectionId);

         for (const [, producer] of connection.producers) {
            producer.close();
            this.removeProducer(producer, participant);
         }
         await this.roomManager.updateParticipant(participant);

         if (participant.connections.length === 0) {
            // remove participant
            this.participants.delete(participant.participantId);
            await this.roomManager.removeParticipant(participant);
         }
      }

      // update streams
      await this.streamInfoRepo.updateStreams(this.participants.values());

      return { success: true };
   }

   public async roomSwitched({ meta: { participantId } }: ConnectionMessage<any>): Promise<SuccessOrError> {
      const participant = this.participants.get(participantId);
      if (!participant) return { success: false, error: errors.participantNotFound(participantId) };

      await this.roomManager.updateParticipant(participant);

      // update streams
      await this.streamInfoRepo.updateStreams(this.participants.values());

      return { success: true };
   }

   /**
    * Change a producer/consumer of the participant. The parameter provides information about the type (consumer|producer),
    * id and action (pause|resume|close)
    */
   public async changeStream({ payload: { id, type, action }, meta }: ChangeStreamRequest): Promise<SuccessOrError> {
      const connection = this.connections.get(meta.connectionId);
      if (!connection) {
         return { success: false, error: errors.connectionNotFound(meta.connectionId) };
      }

      let stream: Producer | Consumer | undefined;
      if (type === 'consumer') {
         stream = connection.consumers.get(id);
      } else if (type === 'producer') {
         stream = connection.producers.get(id);
      }

      if (!stream) {
         return { success: false, error: errors.streamNotFound(type, id) };
      }

      if (action === 'pause') {
         await stream.pause();
      } else if (action === 'close') {
         stream.close();

         if (type === 'consumer') {
            connection.consumers.delete(id);
         } else {
            const producer = connection.producers.get(id);
            if (producer) {
               connection.producers.delete(id);

               const participant = this.participants.get(connection.participantId);
               if (participant) {
                  this.removeProducer(producer, participant);
                  await this.roomManager.updateParticipant(participant);
               }
            }
         }
      } else if (action === 'resume') {
         await stream.resume();
      }

      // update streams
      await this.streamInfoRepo.updateStreams(this.participants.values());

      return { success: true };
   }

   /**
    * Change a specific selected producer source of the participant. This may specifically be used by moderators to disable
    * the microphone on certain participants. They can not use changeStream directly as they don't know which connection a
    * producer belongs to
    */
   public async changeProducerSource({ payload, meta }: ChangeProducerSourceRequest): Promise<SuccessOrError> {
      const participant = this.participants.get(meta.participantId);
      if (!participant) {
         return { success: false, error: errors.participantNotFound(meta.participantId) };
      }

      const { source, action } = payload;

      const producerLink = participant.producers[source];
      if (!producerLink) {
         return { success: false, error: errors.producerSourceNotFound(source) };
      }

      const result = await this.changeStream({
         meta: {
            conferenceId: meta.conferenceId,
            connectionId: producerLink.connectionId,
            participantId: meta.participantId,
         },
         payload: { action, id: producerLink.producer.id, type: 'producer' },
      });

      if (result.success) {
         const args: ProducerChangedEventArgs = { ...payload, producerId: producerLink.producer.id };
         await this.signal.sendToConnection(producerLink.connectionId, 'producerChanged', args);
      }

      return result;
   }

   /**
    * Create a new producer in an existing transport
    */
   public async transportProduce({
      payload: { transportId, appData, kind, ...producerOptions },
      meta,
   }: TransportProduceRequest): Promise<SuccessOrError<TransportProduceResponse>> {
      const connection = this.connections.get(meta.connectionId);
      if (!connection) return { success: false, error: errors.connectionNotFound(meta.connectionId) };

      const participant = this.participants.get(connection.participantId);
      if (!participant) return { success: false, error: errors.participantNotFound(connection.participantId) };

      const transport = connection.transport.get(transportId);
      if (!transport) return { success: false, error: errors.transportNotFound(transportId) };

      const source: ProducerSource = appData.source;
      if (!this.verifyProducerSource(kind, source))
         return { success: false, error: errors.invalidProducerKind(source, kind) };

      appData = { ...appData, participantId: participant.participantId };

      const producer = await transport.produce({
         ...producerOptions,
         kind,
         appData,
         // keyFrameRequestDelay: 5000
      });

      if (participant.producers[source]) {
         participant.producers[source]?.producer.close();
         participant.producers[source] = undefined;
      }

      producer.on('score', (score) => {
         this.signal.sendToConnection(connection.connectionId, 'producerScore', { producerId: producer.id, score });
      });

      connection.producers.set(producer.id, producer);
      participant.producers[source] = { producer, connectionId: connection.connectionId };

      await this.roomManager.updateParticipant(participant);

      // update streams
      await this.streamInfoRepo.updateStreams(this.participants.values());

      return { success: true, response: { id: producer.id } };
   }

   /**
    * Connect the transport after initialization
    */
   public async connectTransport({ payload, meta }: ConnectTransportRequest): Promise<SuccessOrError> {
      const connection = this.connections.get(meta.connectionId);
      if (!connection) return { success: false, error: errors.connectionNotFound(meta.connectionId) };

      const transport = connection.transport.get(payload.transportId);
      if (!transport) return { success: false, error: errors.transportNotFound(payload.transportId) };

      logger.debug('connectTransport() | participantId: %s', connection.participantId);

      await transport.connect(payload);
      return { success: true };
   }

   /**
    * Initialize a new transport
    */
   public async createTransport({
      payload: { sctpCapabilities, forceTcp, producing, consuming },
      meta,
   }: CreateTransportRequest): Promise<SuccessOrError<CreateTransportResponse>> {
      const connection = this.connections.get(meta.connectionId);
      if (!connection) return { success: false, error: errors.connectionNotFound(meta.connectionId) };

      const participant = this.participants.get(connection.participantId);
      if (!participant) return { success: false, error: errors.participantNotFound(connection.participantId) };

      logger.debug('createTransport() | participantId: %s', connection.participantId);

      const webRtcTransportOptions: WebRtcTransportOptions = {
         ...config.webRtcTransport.options,
         enableSctp: Boolean(sctpCapabilities),
         numSctpStreams: sctpCapabilities?.numStreams,
         appData: { producing, consuming },
      };

      if (forceTcp) {
         webRtcTransportOptions.enableUdp = false;
         webRtcTransportOptions.enableTcp = true;
      }

      const transport = await this.router.createWebRtcTransport(webRtcTransportOptions);
      connection.transport.set(transport.id, transport);

      const { maxIncomingBitrate } = config.webRtcTransport;

      // If set, apply max incoming bitrate limit.
      if (maxIncomingBitrate) {
         try {
            await transport.setMaxIncomingBitrate(maxIncomingBitrate);
         } catch (error) {}
      }

      await this.roomManager.updateParticipant(participant);

      return {
         success: true,
         response: {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
            sctpParameters: transport.sctpParameters,
         },
      };
   }

   private removeProducer(producer: Producer, participant: Participant): void {
      for (const [k, activeProducer] of Object.entries(participant.producers)) {
         if (activeProducer?.producer.id === producer.id) {
            participant.producers[k as ProducerSource] = undefined;
         }
      }
   }

   private verifyProducerSource(kind: MediaKind, source: ProducerSource): boolean {
      if (source === 'mic' && kind === 'audio') return true;
      if (source === 'screen' && kind === 'video') return true;
      if (source === 'webcam' && kind === 'video') return true;

      if (source === 'loopback-mic' && kind === 'audio') return true;
      if (source === 'loopback-webcam' && kind === 'video') return true;
      if (source === 'loopback-screen' && kind === 'video') return true;

      return false;
   }
}