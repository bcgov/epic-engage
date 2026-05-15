import React, { forwardRef } from 'react';
import { FormSubmitterProps, FormSubmitHandle } from './types';
import SinglePageForm from './SinglePageForm';
import MultiPageForm from './MultiPageForm';

const FormSubmit = forwardRef<FormSubmitHandle, FormSubmitterProps>((props, ref) => {
    const isMultiPage = props.savedForm?.display === 'wizard';
    return isMultiPage ? <MultiPageForm {...props} /> : <SinglePageForm ref={ref} {...props} />;
});

FormSubmit.displayName = 'FormSubmit';

export default FormSubmit;
