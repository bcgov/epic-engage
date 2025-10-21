import React from 'react';
import { FormContextProvider } from './FormContext';
import { FormCACForm } from './FormCACForm';

export const FormCAC = () => {
    return (
        <FormContextProvider>
            <FormCACForm />
        </FormContextProvider>
    );
};
