import '@testing-library/jest-dom';
import loginReducer, { authorize, deauthorize } from 'redux/slices/loginSlice';

describe('loginSlice', () => {
    const initialState = {
        authorized: false,
    };

    describe('authorize', () => {
        test('sets authorized to true', () => {
            const state = loginReducer(initialState, authorize());
            expect(state.authorized).toBe(true);
        });

        test('keeps authorized true when already authorized', () => {
            const authorizedState = { authorized: true };
            const state = loginReducer(authorizedState, authorize());
            expect(state.authorized).toBe(true);
        });
    });

    describe('deauthorize', () => {
        test('sets authorized to false', () => {
            const authorizedState = { authorized: true };
            const state = loginReducer(authorizedState, deauthorize());
            expect(state.authorized).toBe(false);
        });

        test('keeps authorized false when already unauthorized', () => {
            const state = loginReducer(initialState, deauthorize());
            expect(state.authorized).toBe(false);
        });
    });
});
