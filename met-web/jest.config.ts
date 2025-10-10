import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
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
    },
    preset: 'ts-jest',
    roots: ['<rootDir>'],
    setupFiles: ['<rootDir>/tests/unit/components/setEnvVars.tsx', '<rootDir>/public/config/config.js'],
    setupFilesAfterEnv: ['jest-extended/all', '@testing-library/jest-dom', '<rootDir>/jest.setup.ts'],
    testEnvironment: 'jsdom',
    testPathIgnorePatterns: ['/node_modules/', '/cypress/'],
    globals: {
        'ts-jest': {
            isolatedModules: true,
            tsconfig: {
                allowJs: true,
            },
        },
    },
    transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest',
        '^.+\\.(js|jsx)$': ['ts-jest', {
            tsconfig: {
                allowJs: true,
            },
        }],
        '^.+\\.svg$': 'jest-transform-stub',
    },
    transformIgnorePatterns: [
        'node_modules/(?!(@turf|concaveman|rbush|quickselect|quick-lru|tinyqueue|robust-predicates|d3-.*)/)',
    ],
    modulePaths: ['src'],
};

export default config;