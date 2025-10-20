import React from 'react';
import { SubscribeProvider } from './SubscribeContext';
import SubscribeForm from './SubscribeForm';
import EmailListFormDrawer from './EmailListFormDrawer';
import FormSignUpDrawer from './FormSignUpDrawer';

export const SubscribeWidget = () => {
    return (
        <SubscribeProvider>
            <SubscribeForm />
            <EmailListFormDrawer />
            <FormSignUpDrawer />
        </SubscribeProvider>
    );
};

export default SubscribeWidget;
