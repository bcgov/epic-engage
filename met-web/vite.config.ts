import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        svgr({
            svgrOptions: {
                exportType: 'default',
                ref: true,
                svgo: false,
                titleProp: true,
            },
            include: '**/*.svg?react',
        }),
        tsconfigPaths(),
        nodePolyfills({
            // Enable polyfills for specific Node.js globals and modules
            include: ['crypto', 'stream', 'buffer', 'process', 'util'],
            globals: {
                Buffer: true,
                global: true,
                process: true,
            },
        }),
    ],
    resolve: {
        alias: {
            // Explicitly resolve met-formio to the package root directory
            // The package has an invalid "module": "node" field that breaks Vite
            // This will handle both 'met-formio' imports and 'met-formio/dist/...' paths
            'met-formio': path.resolve(__dirname, 'node_modules/met-formio'),
        },
    },
    optimizeDeps: {
            include: [
                // Force pre-bundle these CommonJS packages to convert to ESM
                '@formio/js',
                '@formio/react',
                'met-formio > @formio/js',
            ],
            esbuildOptions: {
                mainFields: ['module', 'main'],
            },
            force: true, // Force re-optimization - remove this line after first successful run
        },
    server: {
        port: 3000,
        open: true,
    },
    preview: {
        port: 3000,
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
        commonjsOptions: {
            include: [/met-formio/, /node_modules/],
            transformMixedEsModules: true,
        },
    },
    define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
        // Make Vite env vars available via process.env for compatibility
        'process.env.VITE_KEYCLOAK_URL': JSON.stringify(process.env.VITE_KEYCLOAK_URL || ''),
        'process.env.VITE_KEYCLOAK_CLIENT': JSON.stringify(process.env.VITE_KEYCLOAK_CLIENT || ''),
        'process.env.VITE_KEYCLOAK_REALM': JSON.stringify(process.env.VITE_KEYCLOAK_REALM || ''),
        'process.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || ''),
    },
});
