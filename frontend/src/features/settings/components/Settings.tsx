import { makeStyles, Tab, Tabs } from '@material-ui/core';
import React from 'react';
import AudioSettings from './AudioSettings';
import EquipmentSettings from './EquipmentSettings';

interface TabPanelProps {
   children?: React.ReactNode;
   index: any;
   value: any;
   className?: string;
}

function TabPanel(props: TabPanelProps) {
   const { children, value, index, ...other } = props;

   return (
      <div
         role="tabpanel"
         hidden={value !== index}
         id={`settings-tabpanel-${index}`}
         aria-labelledby={`settings-tab-${index}`}
         {...other}
      >
         {value === index && children}
      </div>
   );
}

function a11yProps(index: any) {
   return {
      id: `settings-tab-${index}`,
      'aria-controls': `settings-tabpanel-${index}`,
   };
}

const useStyles = makeStyles((theme) => ({
   root: {
      flexGrow: 1,
      backgroundColor: theme.palette.background.paper,
      display: 'flex',
      height: 400,
   },
   tabs: {
      borderRight: `1px solid ${theme.palette.divider}`,
   },
   tab: {
      flex: 1,
   },
}));

export default function Settings() {
   const classes = useStyles();
   const [value, setValue] = React.useState(0);

   const handleChange = (event: React.ChangeEvent<unknown>, newValue: number) => {
      setValue(newValue);
   };

   return (
      <div className={classes.root}>
         <Tabs
            orientation="vertical"
            variant="scrollable"
            aria-label="settings tabs"
            className={classes.tabs}
            value={value}
            onChange={handleChange}
         >
            <Tab label="Common" {...a11yProps(0)} />
            <Tab label="Audio" {...a11yProps(1)} />
            <Tab label="Equipment" {...a11yProps(2)} />
         </Tabs>
         <TabPanel value={value} index={0} className={classes.tab}>
            Item One
         </TabPanel>
         <TabPanel value={value} index={1} className={classes.tab}>
            <AudioSettings />
         </TabPanel>
         <TabPanel value={value} index={2} className={classes.tab}>
            <EquipmentSettings />
         </TabPanel>
      </div>
   );
}