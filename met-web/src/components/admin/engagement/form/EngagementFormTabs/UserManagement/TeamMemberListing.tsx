import React, { useContext } from 'react';
import { HeadCell } from 'components/shared/common/Table/types';
import { Link } from 'react-router-dom';
import { Link as MuiLink } from '@mui/material';
import MetTable from 'components/shared/common/Table';
import { useAppSelector } from 'hooks';
import { USER_ROLES } from 'services/userService/constants';
import { EngagementTabsContext } from '../EngagementTabsContext';
import { ENGAGEMENT_MEMBERSHIP_STATUS_NAME, EngagementTeamMember } from 'models/engagementTeamMember';
import { formatDate } from 'utils/helpers/dateHelper';
import { ActionsDropDown } from 'components/admin/engagement/form/EngagementFormTabs/UserManagement/ActionsDropDown';

const TeamMemberListing = () => {
    const { teamMembers, teamMembersLoading } = useContext(EngagementTabsContext);
    const { roles } = useAppSelector((state) => state.user);
    const canViewUserDetails = roles.includes(USER_ROLES.EDIT_ENGAGEMENT);

    const headCells: HeadCell<EngagementTeamMember>[] = [
        {
            key: 'user',
            numeric: false,
            disablePadding: true,
            label: 'Team Members',
            allowSort: false,
            renderCell: (row: EngagementTeamMember) => {
                const name = row.user?.last_name + ', ' + row.user?.first_name;
                return canViewUserDetails ? (
                    <MuiLink component={Link} to={`/usermanagement/${row.user_id}/details`}>
                        {name}
                    </MuiLink>
                ) : (
                    name
                );
            },
        },
        {
            key: 'status',
            numeric: false,
            disablePadding: true,
            label: 'Status',
            allowSort: false,
            renderCell: (row: EngagementTeamMember) => ENGAGEMENT_MEMBERSHIP_STATUS_NAME[row.status],
        },
        {
            key: 'created_date',
            numeric: false,
            disablePadding: true,
            label: 'Date Added',
            allowSort: false,
            renderCell: (row: EngagementTeamMember) => formatDate(row.created_date),
        },
        {
            key: 'revoked_date',
            numeric: false,
            disablePadding: true,
            label: 'Date Revoked',
            allowSort: false,
            renderCell: (row: EngagementTeamMember) => (row.revoked_date ? formatDate(row.revoked_date) : null),
        },
        {
            key: 'id',
            numeric: false,
            disablePadding: true,
            label: 'Actions',
            allowSort: false,
            customStyle: { width: '170px' },
            renderCell: (row: EngagementTeamMember) => {
                return <ActionsDropDown membership={row} />;
            },
        },
    ];

    return <MetTable headCells={headCells} rows={teamMembers} loading={teamMembersLoading} noPagination={true} />;
};

export default TeamMemberListing;
