import { Dispatch, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { sendEquipmentCommand } from 'src/core-hub';
import { EquipmentCommandAction } from 'src/core-hub.types';
import { RootState } from 'src/store';
import { UseMediaState } from 'src/store/webrtc/hooks/useMedia';
import { ProducerSource } from 'src/store/webrtc/types';
import { AnyInputDevice } from '../settings/types';
import { ConnectedEquipmentDto } from './types';

function wrapControl(
   source: ProducerSource,
   device: AnyInputDevice | undefined,
   local: UseMediaState,
   equipment: ConnectedEquipmentDto[] | null,
   dispatch: Dispatch<any>,
): UseMediaState {
   if (!device || device.type === 'local') {
      return local;
   } else {
      const equipmentInfo = equipment?.find((x) => x.equipmentId === device.equipmentId)?.status?.[source] ?? {
         connected: false,
         enabled: false,
         paused: false,
      };

      const executeEquipmentCommand = (action: EquipmentCommandAction) => {
         dispatch(sendEquipmentCommand({ action, equipmentId: device.equipmentId, source, deviceId: device.deviceId }));
      };

      return {
         enable: () => executeEquipmentCommand('enable'),
         disable: () => executeEquipmentCommand('disable'),
         pause: () => executeEquipmentCommand('pause'),
         resume: () => executeEquipmentCommand('resume'),
         switchDevice: (deviceId) => {
            dispatch(
               sendEquipmentCommand({
                  action: 'switchDevice',
                  equipmentId: device.equipmentId,
                  source,
                  deviceId,
               }),
            );
         },
         ...equipmentInfo,
      };
   }
}

export default function useDeviceManagement(
   source: ProducerSource,
   local: UseMediaState,
   device?: AnyInputDevice,
): UseMediaState {
   const previousDevice = useRef<AnyInputDevice | undefined>();
   const dispatch = useDispatch();
   const equipment = useSelector((state: RootState) => state.media.equipment);

   useEffect(() => {
      if (previousDevice.current?.deviceId === device?.deviceId) return;

      const deviceType = device?.type || 'local'; // undefined device is default device locally

      // disable previous device
      if (previousDevice.current?.type !== deviceType) {
         if (previousDevice.current) {
            // disable previous device
            if (previousDevice.current.type === 'local') {
               local.disable();
            } else {
               dispatch(
                  sendEquipmentCommand({
                     action: 'disable',
                     equipmentId: previousDevice.current.equipmentId,
                     source,
                     deviceId: previousDevice.current.deviceId,
                  }),
               );
            }
         }
      }

      if (device?.type === 'equipment') {
         dispatch(
            sendEquipmentCommand({
               action: 'switchDevice',
               equipmentId: device.equipmentId,
               source,
               deviceId: device.deviceId,
            }),
         );
      } else {
         local.switchDevice(device?.deviceId);
      }

      previousDevice.current = device;
   }, [device]);

   const controller = wrapControl(source, device, local, equipment, dispatch);
   return controller;
}
