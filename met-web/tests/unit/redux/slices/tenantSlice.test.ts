import '@testing-library/jest-dom';
import tenantReducer, { saveTenant, loadingTenant, TenantState } from 'redux/slices/tenantSlice';

describe('tenantSlice', () => {
    const initialState: TenantState = {
        id: '',
        name: '',
        logoUrl: '',
        basename: '',
        loading: true,
        isLoaded: false,
    };

    describe('loadingTenant', () => {
        test('sets loading to true', () => {
            const state = tenantReducer(initialState, loadingTenant(true));
            expect(state.loading).toBe(true);
        });

        test('sets loading to false', () => {
            const state = tenantReducer(initialState, loadingTenant(false));
            expect(state.loading).toBe(false);
        });
    });

    describe('saveTenant', () => {
        test('saves tenant data and sets isLoaded to true', () => {
            const tenantData = {
                id: 'tenant-123',
                name: 'Test Tenant',
                logoUrl: 'https://example.com/logo.png',
                basename: '/tenant',
            };
            const state = tenantReducer(initialState, saveTenant(tenantData));

            expect(state.id).toBe('tenant-123');
            expect(state.name).toBe('Test Tenant');
            expect(state.logoUrl).toBe('https://example.com/logo.png');
            expect(state.basename).toBe('/tenant');
            expect(state.isLoaded).toBe(true);
        });

        test('sets logoUrl to empty string when not provided', () => {
            const tenantData = {
                id: 'tenant-123',
                name: 'Test Tenant',
                basename: '/tenant',
            };
            const state = tenantReducer(initialState, saveTenant(tenantData));

            expect(state.logoUrl).toBe('');
        });

        test('overwrites existing tenant data', () => {
            const existingState: TenantState = {
                id: 'old-tenant',
                name: 'Old Tenant',
                logoUrl: 'old-logo.png',
                basename: '/old',
                loading: false,
                isLoaded: true,
            };
            const newTenantData = {
                id: 'new-tenant',
                name: 'New Tenant',
                logoUrl: 'new-logo.png',
                basename: '/new',
            };
            const state = tenantReducer(existingState, saveTenant(newTenantData));

            expect(state.id).toBe('new-tenant');
            expect(state.name).toBe('New Tenant');
        });
    });
});
