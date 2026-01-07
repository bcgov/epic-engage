import React, { useContext } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Checkbox, FormControlLabel, FormGroup, FormHelperText, Grid, Link } from '@mui/material';
import { MetLabel, MetParagraph, PrimaryButton } from 'components/shared/common';
import { useAppTranslation } from 'hooks';
import { FormContext } from './FormContext';
import { TAB_TWO } from './constants';
import { When } from 'react-if';

// Define the Yup schema for validation
const schema = yup.object({
    understand: yup.boolean().oneOf([true], 'You must acknowledge this.'),
    termsOfReference: yup.boolean().oneOf([true], 'You must acknowledge this.'),
});

interface FormData {
    understand: boolean;
    termsOfReference: boolean;
}

export const FirstTab: React.FC = () => {
    const { t: translate } = useAppTranslation();
    const { setTabValue, setFormSubmission } = useContext(FormContext);

    // Initialize form state and validation using react-hook-form
    const {
        handleSubmit,
        control,
        formState: { errors },
        trigger,
    } = useForm<FormData>({
        resolver: yupResolver(schema),
        defaultValues: {
            understand: false,
            termsOfReference: false,
        },
    });

    // Function to handle form submission
    const handleNextClick = async (data: FormData) => {
        trigger();

        setFormSubmission((prev) => ({ ...prev, ...data }));
        setTabValue(TAB_TWO);
    };

    const contactEmail = translate('cacForm.contactEmail');

    return (
        <Grid container spacing={2}>
            <Grid item xs={12}>
                <MetLabel>What is a Community Advisory Committee (CAC)?</MetLabel>
                <MetParagraph>
                    A community advisory committee provides a venue for interested community members to advise the
                    Environmental Assessment Office on the potential effects of a project on a community. It supports
                    information-sharing so members can learn about and stay up to date on the environmental assessment
                    and gives members an opportunity to provide their input on potential project impacts and mitigation
                    measures. In particular, community advisory committee members can provide valuable local knowledge
                    about the community, the region’s environment or the use of the proposed project area to ensure this
                    information is captured in the EAO’s assessment.
                </MetParagraph>
            </Grid>
            <Grid item xs={12}>
                <MetParagraph>
                    The format and structure of community advisory committees depend on the potential effects of a
                    project and community interest, amongst other considerations.
                </MetParagraph>
            </Grid>

            <Grid item xs={12}>
                <MetLabel>What can I expect as a Community Advisory Committee Member?</MetLabel>
                <MetParagraph>
                    The Environmental Assessment Office will provide community advisory committee members with
                    information on the environmental assessment process and the proposed project, including
                    notifications of process milestones, when and where key documents are posted, information on public
                    comment periods and any other engagement opportunities. Members will be invited to provide their
                    input through public comment periods held at several points in the environmental assessment.
                    Depending on the overall interest of community advisory committee members, the Environmental
                    Assessment Office may also hold meetings (online or in person) or host other engagement
                    opportunities to directly seek the advice of community advisory committee members. See the
                    <Link href="https://www2.gov.bc.ca/assets/gov/environment/natural-resource-stewardship/environmental-assessments/guidance-documents/cac_guide_v20_2024_final.pdf">
                        Community Advisory Committee Guideline
                    </Link>{' '}
                    for further information.
                </MetParagraph>
            </Grid>

            <Grid item xs={12}>
                <MetLabel>I understand that...</MetLabel>
            </Grid>
            <Grid item xs={12}>
                Personal information is collected under Section 26(c) of the Freedom of Information and Protection of
                Privacy Act, for the purpose of participating in the Community Advisory Committee conducted by the
                Environmental Assessment Office. If you have any questions about the collection, use and disclosure of
                your personal information, please contact {translate('cacForm.contactTitle')} at{' '}
                <Link href={`mailto:${contactEmail}`}>{contactEmail}</Link>.
            </Grid>

            <Grid item xs={12}>
                <FormGroup>
                    <FormControlLabel
                        control={
                            <Controller
                                name="understand"
                                control={control}
                                render={({ field }) => <Checkbox {...field} />}
                            />
                        }
                        label={
                            <MetLabel>By checking this box, I acknowledge that I understand the above text.</MetLabel>
                        }
                    />
                    <When condition={Boolean(errors.understand)}>
                        <FormHelperText
                            sx={{
                                marginLeft: '2.5em',
                                marginTop: '-1em',
                            }}
                            error
                        >
                            {String(errors.understand?.message)}
                        </FormHelperText>
                    </When>
                    <FormControlLabel
                        control={
                            <Controller
                                name="termsOfReference"
                                control={control}
                                render={({ field }) => <Checkbox {...field} />}
                            />
                        }
                        label={
                            <MetLabel>
                                By checking this box, I acknowledge that I have read, understood, and will abide by the{' '}
                                <Link href="https://www2.gov.bc.ca/assets/gov/environment/natural-resource-stewardship/environmental-assessments/guidance-documents/2018-act/community_advisory_committee_guideline_v1.pdf">
                                    Community Advisory Committee Terms of Reference.
                                </Link>
                            </MetLabel>
                        }
                    />
                    <When condition={Boolean(errors.termsOfReference)}>
                        <FormHelperText
                            sx={{
                                marginLeft: '2.5em',
                                marginTop: '-1em',
                            }}
                            error
                        >
                            {String(errors.termsOfReference?.message)}
                        </FormHelperText>
                    </When>
                </FormGroup>
            </Grid>

            <Grid item xs={12}>
                <PrimaryButton onClick={handleSubmit(handleNextClick)}>Next</PrimaryButton>
            </Grid>
        </Grid>
    );
};
