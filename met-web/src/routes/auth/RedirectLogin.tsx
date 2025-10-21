import React, { useEffect } from 'react';
import { MidScreenLoader } from 'components/shared/common';
import UserService from 'services/userService';

export const RedirectLogin = () => {
    const fullUrl = window.location.href;

    useEffect(() => {
        UserService.doLogin(fullUrl);
    }, []);
    return <MidScreenLoader />;
};

export default RedirectLogin;
