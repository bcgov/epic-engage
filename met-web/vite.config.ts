import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), 'VITE_');

    return {
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
            // Force all chunks to share a single React instance; prevents "undefined is not
            // a non-null object" crashes when formio and met-formio land in separate chunks.
            // dayjs must also be deduped — @mui/x-date-pickers validators blow up with the
            // same error if dayjs lands in a different chunk than the adapter.
            // redux must be deduped — if duplicated, useSelector/useDispatch hooks won't
            // see the store that Provider wraps, causing silent stale/empty state.
            // i18next must be deduped — hooks get an uninitialized instance if duplicated,
            // causing all t() calls to return the raw key string.
            dedupe: ['react', 'react-dom', 'dayjs', 'redux', 'i18next'],
        },
        optimizeDeps: {
                include: [
                    // Force pre-bundle these CommonJS packages to convert to ESM
                    '@formio/js',
                    '@formio/react',
                    '@formio/core',
                    'met-formio',
                    // Pre-bundle map libraries together to avoid circular dependency issues
                    'maplibre-gl',
                    'react-map-gl',
                ],
                esbuildOptions: {
                    mainFields: ['module', 'main'],
                },
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
            rollupOptions: {
                output: {
                    manualChunks: {
                        // Single shared React chunk — all other chunks import from here,
                        // preventing duplicate-React crashes across async/formio chunks
                        react: ['react', 'react-dom'],
                        // Keep maplibre and react-map-gl in the same chunk to avoid
                        // initialization order issues with spatial indexing dependencies
                        maplibre: ['maplibre-gl', 'react-map-gl'],
                        // Keep Formio packages together to ensure validators initialize properly
                        // Note: met-formio excluded due to invalid package.json "module" field causing alias issues
                        formio: ['@formio/js', '@formio/react', '@formio/core'],
                        // Keep dayjs and date pickers together — validateDay.js throws
                        // "undefined is not a non-null object" if dayjs is in a separate chunk
                        datepickers: ['dayjs', '@mui/x-date-pickers'],
                        // Keep redux ecosystem in one chunk — store must be a single instance;
                        // splitting react-redux from redux causes useSelector/useDispatch to
                        // reference a different store than the one Provider wraps
                        redux: ['redux', 'react-redux', '@reduxjs/toolkit'],
                        // Keep i18next and react-i18next together — i18next is initialized once
                        // via i18n.init(); duplicating it means hooks get an uninitialized copy
                        i18n: ['i18next', 'react-i18next'],
                    },
                },
            },
        },
        define: {
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
            // Inject all VITE_ env vars into process.env
            ...Object.keys(env).reduce((acc, key) => {
                acc[`process.env.${key}`] = JSON.stringify(env[key]);
                return acc;
            }, {} as Record<string, string>),
        },
    };
});