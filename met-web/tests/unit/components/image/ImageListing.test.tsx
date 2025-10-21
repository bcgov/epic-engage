import React from 'react';
import { ReactNode } from 'react';
import { USER_ROLES } from 'services/userService/constants';
import * as reactRedux from 'react-redux';
import * as notificationSlice from 'services/notificationService/notificationSlice';
import * as imageService from 'services/imageService';
import { setupEnv } from '../setEnvVars';
import ImageListing from 'components/admin/imageManagement/ImageListing';
import { ImageProvider } from 'components/admin/imageManagement/ImageListing/ImageContext';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { formatDate } from 'utils/helpers/dateHelper';
import assert from 'assert';

const mockImageOne = {
    id: 1,
    display_name: 'Pond.png',
    unique_name: '123456789',
    date_uploaded: '2024-08-14 10:00:00',
    url: 'randomurl1.com',
};

const mockImageTwo = {
    id: 2,
    display_name: 'Tree.png',
    unique_name: 'abcdefg',
    date_uploaded: '2024-08-13 10:00:00',
    url: 'randomurl2.com',
};

jest.mock('axios');

jest.mock('@mui/material', () => ({
    ...jest.requireActual('@mui/material'),
    Link: ({ children }: { children: ReactNode }) => {
        return <a>{children}</a>;
    },
    useMediaQuery: () => false,
}));

jest.mock('components/shared/common', () => ({
    ...jest.requireActual('components/shared/common'),
    PrimaryButton: ({ children, ...rest }: { children: ReactNode; [prop: string]: unknown }) => {
        return <button {...rest}>{children}</button>;
    },
}));

jest.mock('components/shared/permissionsGate', () => ({
    ...jest.requireActual('components/shared/permissionsGate'),
    PermissionsGate: ({ children }: { children: ReactNode }) => {
        return <>{children}</>;
    },
}));

jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: jest.fn(),
    useLocation: jest.fn(() => ({
        search: '',
    })),
}));

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useSelector: jest.fn(() => {
        return {
            roles: [USER_ROLES.CREATE_IMAGES],
        };
    }),
}));

describe('Image listing page tests', () => {
    jest.spyOn(reactRedux, 'useDispatch').mockImplementation(() => jest.fn());
    jest.spyOn(notificationSlice, 'openNotification').mockImplementation(jest.fn());
    const getImagesMock = jest.spyOn(imageService, 'getImages');

    beforeEach(() => {
        setupEnv();
    });

    test('Image table is rendered and images are fetched', async () => {
        getImagesMock.mockReturnValue(
            Promise.resolve({
                items: [mockImageOne, mockImageTwo],
                total: 2,
            }),
        );

        render(
            <ImageProvider>
                <ImageListing />
            </ImageProvider>,
        );

        await waitFor(() => {
            expect(screen.getByText(mockImageOne.display_name)).toBeInTheDocument();
            expect(screen.getByText(formatDate(mockImageOne.date_uploaded))).toBeInTheDocument();
            expect(screen.getByText(mockImageOne.url)).toBeInTheDocument();

            expect(screen.getByText(mockImageTwo.display_name)).toBeInTheDocument();
            expect(screen.getByText(formatDate(mockImageTwo.date_uploaded))).toBeInTheDocument();
            expect(screen.getByText(mockImageTwo.url)).toBeInTheDocument();
        });
    });

    test('Search bar works and fetches images with search text', async () => {
        getImagesMock.mockReturnValue(
            Promise.resolve({
                items: [mockImageOne],
                total: 1,
            }),
        );

        const { container } = render(
            <ImageProvider>
                <ImageListing />
            </ImageProvider>,
        );

        await waitFor(() => {
            expect(screen.getByText(mockImageOne.display_name)).toBeInTheDocument();
            expect(screen.getByText(formatDate(mockImageOne.date_uploaded))).toBeInTheDocument();
            expect(screen.getByText(mockImageOne.url)).toBeInTheDocument();
        });

        const searchField = container.querySelector('input[name="searchText"]');
        assert(searchField, 'Unable to find search field that matches the given query');

        fireEvent.change(searchField, { target: { value: 'Pond' } });
        fireEvent.click(screen.getByTestId('image/listing/searchButton'));

        await waitFor(() => {
            expect(getImagesMock).lastCalledWith({
                page: 1,
                size: 10,
                search_text: 'Pond',
            });
        });
    });

    test('Image uploader renders in image listing', async () => {
        render(
            <ImageProvider>
                <ImageListing />
            </ImageProvider>,
        );

        await waitFor(() => {
            expect(
                screen.getByText(
                    'Drag and drop an image here, or click to select an image from your device. Formats accepted are: jpg, png, webp.',
                ),
            ).toBeInTheDocument();
        });
    });
});
