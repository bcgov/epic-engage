import React from 'react';
import { FormSubmitterProps } from './types';
import SinglePageForm from './SinglePageForm';
import MultiPageForm from './MultiPageForm';

const FormSubmit = (props: FormSubmitterProps) => {
    const isMultiPage = props.savedForm?.display === 'wizard';
    return isMultiPage ? <MultiPageForm {...props} /> : <SinglePageForm {...props} />;
};

export default FormSubmit;
