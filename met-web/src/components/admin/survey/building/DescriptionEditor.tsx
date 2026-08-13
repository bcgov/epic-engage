import { useState } from 'react';
import { Box, IconButton, TextField, Typography } from '@mui/material';
import { styled } from '@mui/system';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { PrimaryButton, SecondaryButton } from 'components/shared/common';
import { Palette } from 'styles/Theme';

const DESCRIPTION_FONT_SIZE = '12px';

const AddDescriptionButton = styled('button')(() => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    marginTop: '8px',
    padding: 0,
    background: 'transparent',
    border: 'none',
    font: 'inherit',
    fontSize: DESCRIPTION_FONT_SIZE,
    color: Palette.action.active,
    textDecoration: 'underline',
    cursor: 'pointer',
    '&:hover': {
        color: Palette.primary.main,
    },
    '&:focus-visible': {
        outline: `2px solid ${Palette.primary.main}`,
        outlineOffset: '2px',
    },
}));

export interface DescriptionEditorProps {
    settingId: number;
    description: string;
    onSave: (settingId: number, description: string) => void;
    readOnly?: boolean;
}

// Add/edit/save/cancel flow for a report setting's optional description. Saving here only
// commits the draft into the panel's local state - it's persisted along with any other unsaved
// changes when the panel's own Save button is clicked.
export const DescriptionEditor = ({ settingId, description, onSave, readOnly }: DescriptionEditorProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(description);

    const startEdit = () => {
        setDraft(description);
        setIsEditing(true);
    };

    const handleSave = () => {
        onSave(settingId, draft.trim());
        setIsEditing(false);
    };

    const handleCancel = () => {
        setIsEditing(false);
    };

    if (readOnly) {
        return description ? (
            <Typography sx={{ fontSize: DESCRIPTION_FONT_SIZE, color: Palette.text.secondary, lineHeight: 1.5, mt: 1 }}>
                {description}
            </Typography>
        ) : null;
    }

    if (isEditing) {
        return (
            <Box sx={{ mt: 1 }}>
                <TextField
                    multiline
                    fullWidth
                    minRows={2}
                    size="small"
                    placeholder="Add a description…"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    sx={{ '& .MuiInputBase-root': { fontSize: DESCRIPTION_FONT_SIZE, lineHeight: 1.5 } }}
                    inputProps={{
                        'aria-label': 'Description',
                        'data-testid': `report-setting-description-input-${settingId}`,
                    }}
                />
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    <PrimaryButton
                        data-testid={`report-setting-description-save-${settingId}`}
                        size="small"
                        onClick={handleSave}
                    >
                        Save
                    </PrimaryButton>
                    <SecondaryButton size="small" onClick={handleCancel}>
                        Cancel
                    </SecondaryButton>
                </Box>
            </Box>
        );
    }

    if (description) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mt: 1 }}>
                <Typography sx={{ fontSize: DESCRIPTION_FONT_SIZE, color: Palette.text.secondary, lineHeight: 1.5 }}>
                    {description}
                </Typography>
                <IconButton
                    size="small"
                    onClick={startEdit}
                    aria-label="Edit description"
                    sx={{ p: 0.25, flexShrink: 0 }}
                >
                    <EditOutlinedIcon sx={{ fontSize: 14 }} />
                </IconButton>
            </Box>
        );
    }

    return (
        <AddDescriptionButton type="button" onClick={startEdit}>
            <AddIcon sx={{ fontSize: 14 }} /> Add description
        </AddDescriptionButton>
    );
};

export default DescriptionEditor;
