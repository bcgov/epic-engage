import React from 'react';
import { EventsProvider } from './EventsContext';
import EventsForm from './EventsForm';
import InPersonEventFormDrawer from './InPersonEventFormDrawer';
import VirtualSessionFormDrawer from './VirtualSessionFormDrawer';

export const EventsWidget = () => {
    return (
        <EventsProvider>
            <EventsForm />
            <InPersonEventFormDrawer />
            <VirtualSessionFormDrawer />
        </EventsProvider>
    );
};

export default EventsWidget;
