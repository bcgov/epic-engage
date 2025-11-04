const mockKeycloak = {
    init: jest.fn().mockResolvedValue(true),
    login: jest.fn(),
    logout: jest.fn(),
    updateToken: jest.fn().mockResolvedValue(true),
    loadUserInfo: jest.fn().mockResolvedValue({
        sub: 'test-user-id',
        preferred_username: 'testuser',
        email: 'test@example.com',
    }),
    token: 'mock-token',
    idToken: 'mock-id-token',
    refreshToken: 'mock-refresh-token',
    authenticated: true,
    hasResourceRole: jest.fn().mockReturnValue(true),
};

export default jest.fn(() => mockKeycloak);