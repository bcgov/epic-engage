import { useState, ReactNode } from 'react';
import { Box, FormControlLabel, Switch, Typography } from '@mui/material';
import { styled } from '@mui/system';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { PermissionsGate } from 'components/shared/permissionsGate';
import { USER_ROLES } from 'services/userService/constants';

const TEMPLATE_HELP_TEXT =
    "When you toggle ON this option and save your Survey, your Survey will become a Template. As long as this option is on, the Template can be cloned (and then edited) but can't be attached directly to an Engagement.";
const HIDE_SURVEY_HELP_TEXT =
    "When you toggle ON this option and save your Survey, your Survey will be 'Hidden'. When the toggle is ON and as long as the survey is not attached to an engagement, the Survey will only be visible to Superusers. When you are ready to make it available and able to be cloned or attached to an engagement, change the toggle to OFF and click the Save button.";

// Toggle styled per design spec: 36x20 track, 14px thumb, 3px offset, 16px travel.
const SurveySwitch = styled(Switch)(() => ({
    width: 36,
    height: 20,
    padding: 0,
    display: 'flex',
    '& .MuiSwitch-switchBase': {
        padding: 0,
        margin: 3,
        transitionDuration: '200ms',
        '&.Mui-checked': {
            transform: 'translateX(16px)',
            color: '#fff',
            '& + .MuiSwitch-track': {
                backgroundColor: '#013366',
                opacity: 1,
                border: 0,
            },
        },
    },
    '& .MuiSwitch-thumb': {
        boxShadow: 'none',
        width: 14,
        height: 14,
        borderRadius: '50%',
    },
    '& .MuiSwitch-track': {
        borderRadius: 10,
        backgroundColor: '#9F9D9C',
        opacity: 1,
        transition: 'background-color 200ms',
    },
}));

const DetailsButton = styled('button')(() => ({
    background: 'transparent',
    border: 'none',
    padding: 0,
    marginTop: '4px',
    font: 'inherit',
    fontSize: '12px',
    color: '#255A90',
    textDecoration: 'underline',
    textAlign: 'left',
    cursor: 'pointer',
    '&:hover': {
        color: '#013366',
    },
    '&:focus-visible': {
        outline: '2px solid #013366',
        outlineOffset: '2px',
    },
}));

const SettingRow = ({
    id,
    label,
    helpText,
    control,
}: {
    id: string;
    label: string;
    helpText: string;
    control: ReactNode;
}) => {
    const [open, setOpen] = useState(false);
    const panelId = `${id}-details`;

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                alignItems: 'flex-start',
                gap: '24px',
            }}
        >
            <Box sx={{ minWidth: { md: '180px' }, width: { xs: '100%', md: 'auto' } }}>
                <FormControlLabel
                    control={control}
                    label={
                        <Typography sx={{ fontSize: '14px', fontWeight: 600, lineHeight: 1.4, color: '#2D2D2D' }}>
                            {label}
                        </Typography>
                    }
                    sx={{ m: 0, gap: '12px', alignItems: 'center' }}
                />
                <Box>
                    <DetailsButton
                        type="button"
                        aria-expanded={open}
                        aria-controls={panelId}
                        onClick={() => setOpen((prev) => !prev)}
                    >
                        {open ? 'Hide details' : 'See details'}
                    </DetailsButton>
                </Box>
            </Box>
            {open && (
                <Box
                    id={panelId}
                    sx={{
                        flex: 1,
                        width: { xs: '100%', md: 'auto' },
                        fontSize: '13px',
                        lineHeight: 1.6,
                        color: '#474543',
                        backgroundColor: '#EBF1F8',
                        borderLeft: '3px solid #013366',
                        padding: '10px 14px',
                        borderRadius: '0 4px 4px 0',
                    }}
                >
                    {helpText}
                </Box>
            )}
        </Box>
    );
};

export const AdditionalSettings = ({
    isTemplateSurvey,
    onTemplateChange,
    isHiddenSurvey,
    onHiddenChange,
    disabled,
}: {
    isTemplateSurvey: boolean;
    onTemplateChange: (checked: boolean) => void;
    isHiddenSurvey: boolean;
    onHiddenChange: (checked: boolean) => void;
    disabled: boolean;
}) => {
    return (
        <Box
            sx={{
                mt: '16px',
                mb: '24px',
                backgroundColor: '#FAF9F8',
                border: '1px solid #D8D8D8',
                borderRadius: '6px',
                boxShadow: 'none',
                overflow: 'hidden',
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 20px',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#474543',
                    borderBottom: '1px solid #D8D8D8',
                }}
            >
                <SettingsOutlinedIcon sx={{ fontSize: '15px' }} />
                Additional settings
            </Box>
            <Box sx={{ padding: '10px 20px' }}>
                <SettingRow
                    id="setting-template"
                    label="Save as template"
                    helpText={TEMPLATE_HELP_TEXT}
                    control={
                        <PermissionsGate scopes={[USER_ROLES.CREATE_SURVEY]} errorProps={{ disabled: true }}>
                            <SurveySwitch
                                checked={isTemplateSurvey}
                                disabled={disabled}
                                onChange={(e) => onTemplateChange(e.target.checked)}
                            />
                        </PermissionsGate>
                    }
                />
                <Box sx={{ borderBottom: '1px solid #D8D8D8', my: '10px' }} />
                <SettingRow
                    id="setting-hidden"
                    label="Hide survey"
                    helpText={HIDE_SURVEY_HELP_TEXT}
                    control={
                        <PermissionsGate scopes={[USER_ROLES.CREATE_SURVEY]} errorProps={{ disabled: true }}>
                            <SurveySwitch
                                checked={isHiddenSurvey}
                                disabled={disabled}
                                onChange={(e) => onHiddenChange(e.target.checked)}
                            />
                        </PermissionsGate>
                    }
                />
            </Box>
        </Box>
    );
};
