import { ClickAwayListener, fade, IconButton, makeStyles, Paper, Tooltip } from '@material-ui/core';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import { motion } from 'framer-motion';
import { Pin, PinOff } from 'mdi-material-ui';
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import RoomsList from 'src/features/rooms/components/RoomsList';
import SceneManagement from 'src/features/scenes/components/SceneManagement';
import { RootState } from 'src/store';
import { setParticipantsOpen } from '../reducer';

const drawerWidth = 216;

const useStyles = makeStyles((theme) => ({
   drawerContainer: {
      padding: theme.spacing(1, 0, 1, 1),
      width: drawerWidth,
      height: '100%',
   },
   drawer: {
      display: 'flex',
      flexDirection: 'column',

      flexShrink: 0,
      width: '100%',
      whiteSpace: 'nowrap',

      backgroundColor: fade(theme.palette.background.paper, 0.5),
      height: '100%',

      borderColor: theme.palette.divider,
      borderWidth: 0,
   },
   listRoot: {
      position: 'relative',
      height: '100%',
   },
   backArrowButton: {
      position: 'absolute',
      top: 8,
      right: -34,
      zIndex: theme.zIndex.drawer,
      display: 'flex',
      flexDirection: 'column',
   },
}));

type Props = {
   pinned: boolean;
   onTogglePinned: () => void;
};

const arrowVariants = {
   open: { rotateY: 0, translateX: 0 },
   closed: { rotateY: 180, translateX: -3 },
};

export default function PinnableSidebar({ pinned, onTogglePinned }: Props) {
   const classes = useStyles();

   const dispatch = useDispatch();
   const open = useSelector((state: RootState) => state.conference.participantsOpen);
   const setOpen = (visible: boolean) => dispatch(setParticipantsOpen(visible));

   const handleClickAway = () => {
      if (pinned) return;

      if (!pinned) {
         setOpen(false);
      }
   };

   const handleToggle = () => setOpen(!open);

   return (
      <ClickAwayListener onClickAway={handleClickAway}>
         <div className={classes.listRoot}>
            {open && (
               <div className={classes.drawerContainer}>
                  <Paper className={classes.drawer} elevation={1}>
                     <RoomsList />
                     <SceneManagement />
                  </Paper>
               </div>
            )}
            <div className={classes.backArrowButton}>
               <IconButton aria-label="toggle room list" size="small" onClick={handleToggle}>
                  <ArrowBackIcon
                     component={motion.svg}
                     variants={arrowVariants}
                     animate={open ? 'open' : 'closed'}
                     style={{ transformOrigin: 'center', ...({ originX: 0.5, originY: 0.5 } as any) }}
                     fontSize="small"
                  />
               </IconButton>
               <Tooltip
                  title={pinned ? 'Auto hide sidebar' : 'Pin sidebar'}
                  style={{ display: open ? undefined : 'none' }}
               >
                  <IconButton size="small" onClick={onTogglePinned}>
                     {pinned ? <Pin fontSize="small" /> : <PinOff fontSize="small" />}
                  </IconButton>
               </Tooltip>
            </div>
         </div>
      </ClickAwayListener>
   );
}
