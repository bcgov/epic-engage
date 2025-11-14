import {
    FormControl,
    FormControlLabel,
    FormLabel,
    Grid,
    Modal,
    Radio,
    RadioGroup,
    Stack,
    TextField,
} from '@mui/material';
import { MetHeader1, MetLabel, modalStyle, PrimaryButton, SecondaryButton } from 'components/shared/common';
import { SettingKey } from 'constants/settingKey';
import { useAppDispatch } from 'hooks';
import { Setting } from 'models/settings';
import React, { useEffect, useState } from 'react';
import { If, Then } from 'react-if';
import { openNotification } from 'services/notificationService/notificationSlice';
import { getSettingByKey, patchSettings, postSettings } from 'services/settingsService';
import * as yup from 'yup';
import AutoComplete from '@mui/material/Autocomplete';
import { getThreatContactById, getThreatContacts, postThreatContact } from 'services/threatContactService';
import { ThreatContact } from 'models/threatContact';

interface IEditContactModalProps {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    onSaveCallback?: () => void;
}

const EditContactModal = ({ isOpen, setIsOpen, onSaveCallback }: IEditContactModalProps) => {
    const [selectedOption, setSelectedOption] = useState<string | null>('EXISTING');
    const [contacts, setContacts] = useState<ThreatContact[]>([]);
    const [selectedContact, setSelectedContact] = useState<ThreatContact | null>(null);
    const [threatContactSetting, setThreatContactSetting] = useState<Setting | null>(null);
    const [firstName, setFirstName] = useState<string>('');
    const [lastName, setLastName] = useState<string>('');
    const [email, setEmail] = useState<string>('');
    const dispatch = useAppDispatch();

    // Function to fetch current threat contact setting and the corresponding contact
    const fetchSettings = async () => {
        const currentThreatContactSetting = await getSettingByKey(SettingKey.THREAT_CONTACT);
        if (!currentThreatContactSetting?.setting_value) return;
        const currentThreatContact = await getThreatContactById(
            parseInt(currentThreatContactSetting.setting_value, 10),
        );
        setThreatContactSetting(currentThreatContactSetting);
        setSelectedContact(currentThreatContact);
    };

    // Fetch contacts for dropdown
    useEffect(() => {
        const fetchContacts = async () => {
            const loadedContacts = await getThreatContacts();
            setContacts(loadedContacts);
        };

        fetchContacts();
    }, [isOpen]);

    // Get current threat contact setting and the corresponding contact
    useEffect(() => {
        fetchSettings();
    }, [isOpen]);

    // Update or create a setting for threat contact based on if there is an existing threat contact for this tenant
    const updateOrCreateSetting = async (settingValue: number) => {
        if (threatContactSetting?.id !== undefined) {
            const updatedSetting = await patchSettings(String(threatContactSetting.id), String(settingValue));
            return updatedSetting;
        } else {
            const newSetting = await postSettings({
                setting_key: SettingKey.THREAT_CONTACT,
                setting_value: String(settingValue),
                setting_value_type: 'integer',
            });
            return newSetting;
        }
    };

    // Yup validation schema
    const newContactSchema = yup.object().shape({
        firstName: yup.string().required('First name is required'),
        lastName: yup.string().required('Last name is required'),
        email: yup.string().email('Invalid email format').required('Email is required'),
    });

    // Validate new contact form and display error notification if invalid
    const validateNewContact = async () => {
        try {
            await newContactSchema.validate({
                firstName,
                lastName,
                email,
            });
            return true;
        } catch (error) {
            dispatch(
                openNotification({
                    text: error instanceof Error ? error.message : 'Error while trying to validate new contact.',
                    severity: 'error',
                }),
            );
            return false;
        }
    };

    // Handle save action
    const handleSave = async () => {
        if (selectedOption === 'EXISTING' && selectedContact) {
            await updateOrCreateSetting(selectedContact.id);
        } else if (selectedOption === 'NEW') {
            const isValid = await validateNewContact();
            if (!isValid) return;
            const createdThreatContact = await postThreatContact({
                first_name: firstName,
                last_name: lastName,
                email: email,
            });
            await updateOrCreateSetting(createdThreatContact.id);
        }
        setIsOpen(false);
        onSaveCallback?.();
        setFirstName('');
        setLastName('');
        setEmail('');
        setSelectedOption('EXISTING');
        fetchSettings();
    };

    const clearAndCloseForm = () => {
        setFirstName('');
        setLastName('');
        setEmail('');
        setSelectedOption('EXISTING');
        setIsOpen(false);
    };

    return (
        <Modal aria-labelledby="modal-title" open={isOpen} onClose={clearAndCloseForm}>
            <Grid
                container
                direction="row"
                justifyContent="flex-start"
                alignItems="space-between"
                sx={{ ...modalStyle, overflowY: 'scroll' }}
                rowSpacing={2}
            >
                <Grid item xs={12}>
                    <FormLabel id="controlled-radio-buttons-group">
                        <MetHeader1 sx={{ color: '#494949' }}>Edit Contact</MetHeader1>
                    </FormLabel>
                </Grid>
                <Grid item xs={12}>
                    <FormControl fullWidth sx={{ mt: 1 }}>
                        <RadioGroup defaultValue={selectedOption} onChange={(e) => setSelectedOption(e.target.value)}>
                            <FormControlLabel
                                key={'EXISTING'}
                                value={'EXISTING'}
                                control={<Radio />}
                                label={<MetLabel sx={{ color: '#494949' }}>Select Existing Contact</MetLabel>}
                                sx={{ mb: 0 }}
                            />
                            <If condition={selectedOption === 'EXISTING'}>
                                <Then>
                                    <AutoComplete
                                        id="threat-contact-selector"
                                        options={contacts || []}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                label=" "
                                                InputLabelProps={{
                                                    shrink: false,
                                                }}
                                                fullWidth
                                            />
                                        )}
                                        isOptionEqualToValue={(option, value) => option.id === value.id}
                                        size="small"
                                        getOptionLabel={(contact: ThreatContact) =>
                                            `${contact.first_name} ${contact.last_name} - ${contact.email}`
                                        }
                                        onChange={(
                                            _e: React.SyntheticEvent<Element, Event>,
                                            contact: ThreatContact | null,
                                        ) => {
                                            setSelectedContact(contact);
                                        }}
                                        value={selectedContact}
                                    />
                                </Then>
                            </If>
                            <FormControlLabel
                                key={'NEW'}
                                value={'NEW'}
                                control={<Radio />}
                                label={<MetLabel sx={{ color: '#494949' }}>Create New Contact</MetLabel>}
                                sx={{ mb: 0 }}
                            />
                            <If condition={selectedOption === 'NEW'}>
                                <Then>
                                    <Grid container spacing={1} sx={{ mt: 0 }}>
                                        <Grid item xs={6}>
                                            <TextField
                                                required
                                                fullWidth
                                                placeholder="First Name"
                                                variant="outlined"
                                                value={firstName}
                                                onChange={(e) => setFirstName(e.target.value)}
                                                sx={{ fontSize: '14px' }}
                                            />
                                        </Grid>
                                        <Grid item xs={6}>
                                            <TextField
                                                required
                                                fullWidth
                                                placeholder="Last Name"
                                                variant="outlined"
                                                value={lastName}
                                                onChange={(e) => setLastName(e.target.value)}
                                                sx={{ fontSize: '14px' }}
                                            />
                                        </Grid>
                                        <Grid item xs={12}>
                                            <TextField
                                                required
                                                fullWidth
                                                type="email"
                                                placeholder="Email Address"
                                                variant="outlined"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                sx={{ fontSize: '14px' }}
                                            />
                                        </Grid>
                                    </Grid>
                                </Then>
                            </If>
                        </RadioGroup>
                    </FormControl>
                </Grid>
                <Grid container direction="row" item xs={12}>
                    <Grid
                        item
                        container
                        direction={{ xs: 'column', sm: 'row' }}
                        xs={12}
                        justifyContent="flex-end"
                        spacing={1}
                        sx={{ mt: '1em' }}
                    >
                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1}
                            width="100%"
                            justifyContent="flex-end"
                        >
                            <SecondaryButton data-testid={'cancel-button'} onClick={clearAndCloseForm}>
                                Cancel
                            </SecondaryButton>
                            <PrimaryButton data-testid={'calculator-button'} onClick={() => handleSave()}>
                                Save
                            </PrimaryButton>
                        </Stack>
                    </Grid>
                </Grid>
            </Grid>
        </Modal>
    );
};

export default EditContactModal;
