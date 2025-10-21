import React from 'react';
import { DashboardContextProvider } from './DashboardContext';
import EngagementList from './EngagementList';

export const AdminDashboard = () => {
    return (
        <DashboardContextProvider>
            <EngagementList />
        </DashboardContextProvider>
    );
};

export default AdminDashboard;
