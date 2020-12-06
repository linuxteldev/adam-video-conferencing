import { Dialog, DialogContent, DialogTitle, DialogActions, Button, DialogContentText, Box } from '@material-ui/core';
import React from 'react';
import { useForm } from 'react-hook-form';
import { useDispatch, useSelector } from 'react-redux';
import { OpenBreakoutRoomsDto } from 'src/core-hub.types';
import { RootState } from 'src/store';
import BreakoutRoomsForm from './BreakoutRoomsForm';
import * as coreHub from 'src/core-hub';
import { Duration } from 'luxon';

type Props = {
   open: boolean;
   onClose: () => void;
};

export default function CreateBreakoutRoomsDialog({ open, onClose }: Props) {
   const dispatch = useDispatch();

   const participants = useSelector((state: RootState) => state.conference.participants);
   // participants = [
   //    ...participants,
   //    ...Array.from({ length: 15 }).map((_, i) => ({
   //       participantId: 'test-' + i,
   //       displayName: 'random ' + i,
   //       role: 'mod',
   //    })),
   // ];

   const form = useForm<OpenBreakoutRoomsDto>({
      defaultValues: {
         amount: participants != undefined ? Math.ceil(participants.length / 3) : 4,
         description: '',
         duration: '15',
         assignedRooms: [],
      },
      mode: 'onChange',
   });

   const { formState, handleSubmit } = form;

   const handleApplyForm = (dto: OpenBreakoutRoomsDto) => {
      const action = coreHub.openBreakoutRooms({
         ...dto,
         amount: Number(dto.amount),
         duration: dto.duration ? Duration.fromObject({ minutes: Number(dto.duration) }).toString() : undefined,
      });

      dispatch(action);
      onClose();
   };

   return (
      <Dialog open={open} onClose={onClose} aria-labelledby="form-dialog-title" fullWidth maxWidth="md" scroll="paper">
         <form onSubmit={handleSubmit(handleApplyForm)}>
            <DialogTitle id="form-dialog-title">Create breakout rooms</DialogTitle>
            <DialogContent>
               <DialogContentText>
                  Let participants work together in smaller groups. Here you can define the amount of rooms to create.
                  You can assign a duration for the breakout phase, it will be displayed to all participants. After
                  creation the participants can join them on their own.
               </DialogContentText>
               <Box mt={4}>
                  <BreakoutRoomsForm form={form} participants={participants} />
               </Box>
            </DialogContent>
            <DialogActions>
               <Button color="primary" onClick={onClose}>
                  Cancel
               </Button>
               <Button color="primary" disabled={!formState.isValid} type="submit">
                  Open Breakout Rooms
               </Button>
            </DialogActions>
         </form>
      </Dialog>
   );
}