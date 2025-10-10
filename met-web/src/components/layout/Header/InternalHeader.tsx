import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppBar, Box, Toolbar, Button, IconButton, CssBaseline, useMediaQuery, Theme } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { When } from 'react-if';
import UserService from 'services/userService';
import SideNav from '../SideNav/SideNav';
import { Palette } from 'styles/Theme';
import EnvironmentBanner from './EnvironmentBanner';
import { HeaderTitle } from 'components/common';
import { ReactComponent as BCLogo } from 'assets/images/BritishColumbiaLogoDark.svg';
import { HeaderProps } from './types';
import { useAppTranslation } from 'hooks';

const InternalHeader = ({ drawerWidth = 280 }: HeaderProps) => {
    const isMediumScreen: boolean = useMediaQuery((theme: Theme) => theme.breakpoints.up('md'));
    const [open, setOpen] = useState(false);
    const [imageError, setImageError] = useState(false);
    const navigate = useNavigate();
    const { t: translate } = useAppTranslation();

    const logoUrl = translate('common.logoUrl');
    return (
        <>
            <AppBar
                position="fixed"
                sx={{
                    zIndex: (theme: Theme) => (isMediumScreen ? theme.zIndex.drawer + 1 : theme.zIndex.drawer),
                    backgroundColor: Palette.internalHeader.backgroundColor,
                    color: Palette.internalHeader.color,
                }}
                data-testid="appbar-header"
            >
                <CssBaseline />
                <Toolbar>
                    <When condition={!isMediumScreen}>
                        <IconButton
                            color="info"
                            sx={{
                                height: '2em',
                                width: '2em',
                                marginRight: { xs: '1em' },
                            }}
                            onClick={() => setOpen(!open)}
                        >
                            <MenuIcon />
                        </IconButton>
                    </When>
                    <When condition={logoUrl && !imageError}>
                        <Box
                            sx={{
                                backgroundImage: logoUrl,
                                height: '5em',
                                width: { xs: '7em', md: '15em' },
                                marginRight: { xs: '1em', md: '3em' },
                            }}
                        >
                            <img
                                src={logoUrl}
                                alt="Site Logo"
                                style={{
                                    objectFit: 'cover',
                                    height: '5em',
                                    width: '100%',
                                    cursor: 'pointer',
                                }}
                                onClick={() => {
                                    navigate('/');
                                }}
                                onError={(_e) => {
                                    setImageError(true);
                                }}
                            />
                        </Box>
                    </When>
                    <When condition={!logoUrl || imageError}>
                        <Box
                            component={BCLogo}
                            sx={{
                                cursor: 'pointer',
                                height: '5em',
                                width: { xs: '7em', md: '15em' },
                                marginRight: { xs: '1em', md: '3em' },
                            }}
                            onClick={() => {
                                navigate('/');
                            }}
                            alt="British Columbia Logo"
                        />
                    </When>
                    {isMediumScreen ? (
                        <HeaderTitle
                            onClick={() => {
                                navigate('/');
                            }}
                            sx={{ flexGrow: 1, cursor: 'pointer' }}
                        >
                            {translate('header.title')}
                        </HeaderTitle>
                    ) : (
                        <HeaderTitle
                            onClick={() => {
                                navigate('/');
                            }}
                            sx={{ flexGrow: 1, cursor: 'pointer' }}
                        >
                            {translate('header.smallTitle')}
                        </HeaderTitle>
                    )}
                    <Button
                        data-testid="button-header"
                        sx={{
                            color: Palette.internalHeader.color,
                        }}
                        onClick={() => UserService.doLogout()}
                    >
                        Logout
                    </Button>
                </Toolbar>
                <EnvironmentBanner />
            </AppBar>
            <SideNav
                setOpen={setOpen}
                data-testid="sidenav-header"
                isMediumScreen={isMediumScreen}
                open={open}
                drawerWidth={drawerWidth}
            />
        </>
    );
};

export default InternalHeader;
