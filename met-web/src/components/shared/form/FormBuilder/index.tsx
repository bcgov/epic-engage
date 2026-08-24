import React, { useMemo } from 'react';
import { FormBuilder as FormioFormBuilder } from '@formio/react';
import { cloneDeep } from 'lodash';
import './formio.scss';
import { formioOptions } from './constants';
import { FormBuilderData, FormBuilderProps } from './types';

// @formio/react re-registers its builder listeners on every render and formio's Element.off can't
// match them to remove the old ones, so the builder must not re-render. Callers have to pass a
// referentially stable handleFormChange or the memo below is a no-op.
const FormBuilder = ({ handleFormChange, savedForm, isLoading }: FormBuilderProps) => {
    // formio stores its EventEmitter on the options object it is given, and reuses one already
    // there. Sharing formioOptions would hand every builder in the session the same emitter, so
    // listeners left behind by a torn-down builder would fire on the next one. Copy it per builder.
    const options = useMemo(() => cloneDeep(formioOptions), []);

    if (isLoading) {
        return <div className="formio">Loading...</div>;
    }

    return (
        <div className="formio">
            <FormioFormBuilder
                key={JSON.stringify(savedForm)}
                initialForm={savedForm || { display: 'form' }}
                options={options}
                onChange={(form: unknown) => handleFormChange(form as FormBuilderData)}
            />
        </div>
    );
};

export default React.memo(FormBuilder);
