import React, { ReactNode } from 'react';
import { render, waitFor, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import EngagementForm from '../../../../src/components/engagement/form';
import { setupEnv } from '../setEnvVars';
import * as reactRedux from 'react-redux';
import * as reactRouter from 'react-router';
import * as engagementService from 'services/engagementService';
import * as engagementMetadataService from 'services/engagementMetadataService';
import * as engagementSettingService from 'services/engagementSettingService';
import * as teamMemberService from 'services/membershipService';
import * as widgetService from 'services/widgetService';
import { draftEngagement, engagementMetadata, engagementSetting, openEngagement} from '../factory';
import { createDefaultUser, USER_GROUP } from 'models/user';
import { EngagementTeamMember, initialDefaultTeamMember } from 'models/engagementTeamMember';
import { USER_ROLES } from 'services/userService/constants';
import { EngagementVisibility } from 'constants/engagementVisibility';

const mockTeamMember1: EngagementTeamMember = {
    ...initialDefaultTeamMember,
    user_id: 1,
    user: {
        ...createDefaultUser,
        id: 1,
        first_name: 'Jane',
        last_name: 'Doe',
        groups: [USER_GROUP.VIEWER.label],
    },
};

jest.mock('axios');

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useSelector: jest.fn(() => {
        return {
            roles: [USER_ROLES.VIEW_PRIVATE_ENGAGEMENTS, USER_ROLES.EDIT_ENGAGEMENT, USER_ROLES.CREATE_ENGAGEMENT],
            assignedEngagements: [draftEngagement.id],
        };
    }),
}));

jest.mock('@reduxjs/toolkit/query/react', () => ({
    ...jest.requireActual('@reduxjs/toolkit/query/react'),
    fetchBaseQuery: jest.fn(),
}));

jest.mock('@mui/material', () => ({
    ...jest.requireActual('@mui/material'),
    Link: ({ children }: { children: ReactNode }) => {
        return <a>{children}</a>;
    },
}));

jest.mock('components/map', () => () => {
    return <div></div>;
});

jest.mock('apiManager/apiSlices/widgets', () => ({
    ...jest.requireActual('apiManager/apiSlices/widgets'),
    useDeleteWidgetMutation: () => [jest.fn(() => Promise.resolve())],
    useSortWidgetsMutation: () => [jest.fn(() => Promise.resolve())],
}));

jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useLocation: jest.fn(() => ({ search: '' })),
    useParams: jest.fn(() => {
        return { projectId: '' };
    }),
    useNavigate: () => jest.fn(),
}));

describe('Engagement form Settings tab tests', () => {
    jest.spyOn(reactRedux, 'useDispatch').mockImplementation(() => jest.fn());
    jest.spyOn(teamMemberService, 'getTeamMembers').mockReturnValue(Promise.resolve([mockTeamMember1]));
    const useParamsMock = jest.spyOn(reactRouter, 'useParams');
    const getEngagements = jest.spyOn(engagementService, 'getEngagement')
    jest.spyOn(widgetService, 'getWidgets').mockReturnValue(Promise.resolve([]));
    jest.spyOn(engagementMetadataService, 'getEngagementMetadata').mockReturnValue(Promise.resolve(engagementMetadata));
    jest.spyOn(engagementSettingService, 'getEngagementSettings').mockReturnValue(Promise.resolve(engagementSetting));

    beforeEach(() => {
        setupEnv();
    });

    test('Settings tab renders', async () => {
        useParamsMock.mockReturnValue({ engagementId: '1' });
        getEngagements.mockReturnValue(Promise.resolve(draftEngagement));
        render(<EngagementForm />);

        await waitFor(() => {
            expect(screen.getByDisplayValue(draftEngagement.name)).toBeInTheDocument();
        });

        const settingsTabButton = screen.getByRole("tab", { "name": "Settings" });

        fireEvent.click(settingsTabButton);

        expect(screen.getByRole("heading", { level: 4, name: "Engagement Information" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { level: 4, name: "Engagement Access & Visibility" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { level: 4, name: "Send Report" })).toBeInTheDocument();

        const radioButtonPublic = screen.getByRole("radio", { name: /Public Engagement/i })
        expect(radioButtonPublic).toBeInTheDocument();
        expect(radioButtonPublic).toBeChecked();

        const radioButtonHidden = screen.getByRole("radio", { name: /Hidden Engagement/i })
        expect(radioButtonHidden).toBeInTheDocument();

        const radioButtonInternal = screen.getByRole("radio", { name: /Internal Engagement/i })
        expect(radioButtonInternal).toBeInTheDocument();
    });

    test('Settings tab renders with disabled Engagement Visibility buttons when engagement is already Open', async () => {
        useParamsMock.mockReturnValue({ engagementId: '2' });
        getEngagements.mockReturnValue(Promise.resolve({
            ...openEngagement,
            visibility: EngagementVisibility.Hidden
        }));
        render(<EngagementForm />);

        await waitFor(() => {
            expect(screen.getByDisplayValue(openEngagement.name)).toBeInTheDocument();
        });

        const settingsTabButton = screen.getByRole("tab", { "name": "Settings" });

        fireEvent.click(settingsTabButton);

        expect(screen.getByRole("heading", { level: 4, name: "Engagement Access & Visibility" })).toBeInTheDocument();

        const radioButtonPublic = screen.getByRole("radio", { name: /Public Engagement/i })
        expect(radioButtonPublic).toBeInTheDocument();
        expect(radioButtonPublic).toBeDisabled();

        const radioButtonHidden = screen.getByRole("radio", { name: /Hidden Engagement/i })
        expect(radioButtonHidden).toBeInTheDocument();
        expect(radioButtonHidden).toBeChecked();
        expect(radioButtonHidden).toBeDisabled();

        const radioButtonInternal = screen.getByRole("radio", { name: /Internal Engagement/i })
        expect(radioButtonInternal).toBeInTheDocument();
        expect(radioButtonInternal).toBeDisabled();
    });

});
