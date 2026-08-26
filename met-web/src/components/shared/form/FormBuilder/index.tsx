import React, { useMemo } from 'react';
import { FormBuilder as FormioFormBuilder } from '@formio/react';
import { cloneDeep } from 'lodash';
import './formio.scss';
import { formioOptions } from './constants';
import { FormBuilderData, FormBuilderProps } from './types';

// Owning the options copy here, where the key rebuilds the builder,
// keeps an emitter from outliving its own builder and carrying dead listeners into the next one.
const BuilderInstance = ({ handleFormChange, savedForm }: Omit<FormBuilderProps, 'isLoading'>) => {
    const options = useMemo(() => cloneDeep(formioOptions), []);

    return (
        <FormioFormBuilder
            initialForm={savedForm || { display: 'form' }}
            options={options}
            onChange={(form: unknown) => handleFormChange(form as FormBuilderData)}
        />
    );
};

// Memoized because @formio/react re-registers its listeners on every render
const FormBuilder = ({ handleFormChange, savedForm, isLoading }: FormBuilderProps) => {
    if (isLoading) {
        return <div className="formio">Loading...</div>;
    }

    return (
        <div className="formio">
            <BuilderInstance
                key={JSON.stringify(savedForm)}
                handleFormChange={handleFormChange}
                savedForm={savedForm}
            />
        </div>
    );
};

export default React.memo(FormBuilder);
