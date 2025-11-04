// jest.config.js
const path = require('path');

module.exports = {
    clearMocks: true,
    coverageDirectory: 'coverage',
    cache: true,
    cacheDirectory: '<rootDir>/.jest-cache',
    moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json', 'css', 'scss'],
    moduleNameMapper: {
        '^uuid$': require.resolve('uuid'),
        'react-dnd': 'react-dnd-cjs',
        'react-dnd-html5-backend': 'react-dnd-html5-backend-cjs',
        'dnd-core': 'dnd-core-cjs',
        '\\.(css|scss)$': '<rootDir>/tests/unit/components/styleMock.tsx',
        '^keycloak-js$': '<rootDir>/tests/unit/__mocks__/keycloak-js.ts',
    },
    preset: 'ts-jest',
    roots: ['<rootDir>'],
    setupFiles: ['<rootDir>/tests/unit/components/setEnvVars.tsx', '<rootDir>/public/config/config.js'],
    setupFilesAfterEnv: ['jest-extended/all', '@testing-library/jest-dom', '<rootDir>/jest.setup.ts'],
    testEnvironment: 'jsdom',
    testPathIgnorePatterns: ['/node_modules/', '/cypress/'],
    globals: {
        'ts-jest': {
            tsconfig: path.resolve(__dirname, 'tsconfig.jest.json'),
            isolatedModules: true,
        },
    },
    transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest',
        '^.+\\.(js|jsx)$': 'ts-jest',
        '^.+\\.svg$': 'jest-transform-stub',
    },
    transformIgnorePatterns: [
        'node_modules/(?!(@turf|concaveman|rbush|quickselect|quick-lru|tinyqueue|robust-predicates|d3-.*|keycloak-js)/)',
    ],
    modulePaths: ['src'],
};