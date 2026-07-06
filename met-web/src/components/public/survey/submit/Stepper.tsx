import React from 'react';
import { Stepper, Step, StepLabel, StepButton, Box } from '@mui/material';
import { StepIconProps } from '@mui/material/StepIcon';
import { FormInfo } from 'components/shared/form/FormBuilder/types';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

export interface ProgressBarProps {
    currentPage: number;
    pages: Array<FormInfo>;
    // When provided, steps become clickable and can be visited in any order (used by the dashboard).
    onStepClick?: (index: number) => void;
    [prop: string]: unknown;
}

// Keeps the step number (no checkmark) and just turns it blue when active or completed.
const NumberStepIcon = ({ active, completed, icon }: StepIconProps) => {
    const highlighted = active || completed;
    return (
        <Box
            sx={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                color: '#fff',
                backgroundColor: highlighted ? 'primary.main' : 'grey.400',
            }}
        >
            {icon}
        </Box>
    );
};

function FormStepper({ currentPage, pages, onStepClick, ...rest }: ProgressBarProps) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const clickable = Boolean(onStepClick);

    return (
        <Box sx={{ pb: 2 }}>
            <Stepper
                activeStep={currentPage}
                alternativeLabel
                nonLinear={clickable}
                sx={{ minWidth: pages.length * 72 }}
                {...rest}
            >
                {pages.map((page: FormInfo, index: number) => {
                    const label = (!isMobile || index === currentPage) && page.title;
                    return (
                        <Step key={index} completed={clickable ? index < currentPage : undefined}>
                            {clickable ? (
                                <StepButton onClick={() => onStepClick?.(index)} icon={index + 1}>
                                    <StepLabel StepIconComponent={NumberStepIcon}>{label}</StepLabel>
                                </StepButton>
                            ) : (
                                <StepLabel> {label}</StepLabel>
                            )}
                        </Step>
                    );
                })}
            </Stepper>
        </Box>
    );
}

export default FormStepper;
