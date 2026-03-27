import React from 'react';
import { FormBuilder as FormioFormBuilder } from '@formio/react';
import './formio.scss';
import { formioOptions } from './constants';
import { FormBuilderData, FormBuilderProps } from './types';

const FormBuilder = ({ handleFormChange, savedForm, isLoading }: FormBuilderProps) => {
    if (isLoading) {
        return <div className="formio">Loading...</div>;
    }

    return (
        <div className="formio">
            <FormioFormBuilder
                key={JSON.stringify(savedForm)}
                initialForm={savedForm || { display: 'form' }}
                options={formioOptions}
                onChange={(form: unknown) => handleFormChange(form as FormBuilderData)}
            />
        </div>
    );
};

export default FormBuilder;
