﻿using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using PaderConference.Core.Domain.Entities;
using PaderConference.Core.Interfaces.Gateways.Repositories;
using PaderConference.Core.Interfaces.Services;
using PaderConference.Core.Services.Media.Communication;
using PaderConference.Core.Services.Media.Mediasoup;
using PaderConference.Core.Services.Synchronization;
using PaderConference.Core.Signaling;

namespace PaderConference.Core.Services.Media
{
    public class MediaService : ConferenceService
    {
        private readonly ISignalMessenger _clients;
        private readonly IMediaRepo _repo;
        private readonly string _conferenceId;
        private readonly ILogger<MediaService> _logger;
        private readonly IConnectionMapping _connectionMapping;
        private readonly ISynchronizedObject<Dictionary<string, ParticipantStreamInfo>> _synchronizedStreams;

        private Func<Task>? _unsubscribeSendMessage;
        private Func<Task>? _unsubscribeStreams;

        public MediaService(string conferenceId, ISignalMessenger clients,
            ISynchronizationManager synchronizationManager, IMediaRepo repo, IConnectionMapping connectionMapping,
            ILogger<MediaService> logger)
        {
            _conferenceId = conferenceId;
            _clients = clients;
            _repo = repo;
            _connectionMapping = connectionMapping;
            _logger = logger;

            _synchronizedStreams =
                synchronizationManager.Register("mediaStreams", new Dictionary<string, ParticipantStreamInfo>());
        }

        public override async ValueTask InitializeAsync()
        {
            // notify sfu about new conference
            await _repo.RegisterConference(_conferenceId);

            // initialize synchronous message sending
            _unsubscribeSendMessage = await _repo.SubscribeOnSendMessage(_conferenceId, OnSendMessageToConnection);

            _unsubscribeStreams = await _repo.SubscribeStreamsChanged(_conferenceId, OnStreamsChanged);
        }

        public override async ValueTask DisposeAsync()
        {
            if (_unsubscribeSendMessage != null)
            {
                await _unsubscribeSendMessage();
                _unsubscribeSendMessage = null;
            }

            if (_unsubscribeStreams != null)
            {
                await _unsubscribeStreams();
                _unsubscribeStreams = null;
            }
        }

        private async Task OnStreamsChanged()
        {
            var streams = await _repo.GetStreams(_conferenceId);
            await _synchronizedStreams.Update(streams);
        }

        public override async ValueTask OnClientDisconnected(Participant participant)
        {
            if (_connectionMapping.ConnectionsR.TryGetValue(participant.ParticipantId, out var connections))
            {
                var meta = new ConnectionMessageMetadata(_conferenceId, connections.MainConnectionId,
                    participant.ParticipantId);

                await _repo.NotifyClientDisconnected(meta);
            }
        }

        private async Task OnSendMessageToConnection(SendToConnectionDto arg)
        {
            await _clients.SendToConnectionAsync(arg.ConnectionId, arg.MethodName, arg.Payload);
        }

        private ConnectionMessageMetadata GetMeta(IServiceMessage message)
        {
            return new ConnectionMessageMetadata(_conferenceId, message.ConnectionId,
                message.Participant.ParticipantId);
        }

        public Func<IServiceMessage<TRequest>, ValueTask<JsonElement?>> Redirect<TRequest>(
            ConferenceDependentKey dependentKey)
        {
            async ValueTask<JsonElement?> Invoke(IServiceMessage<TRequest> message)
            {
                var meta = GetMeta(message);
                var request = new ConnectionMessage<TRequest>(message.Payload, meta);

                return await _repo.SendMessage(dependentKey, _conferenceId, request);
            }

            return Invoke;
        }

        public async ValueTask<JsonElement?> GetRouterCapabilities(IServiceMessage _)
        {
            return await _repo.GetRtpCapabilities(_conferenceId);
        }
    }
}