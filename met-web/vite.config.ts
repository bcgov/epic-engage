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
            // Force all chunks to share single instances of libraries that are singletons or
            // have adapter/validator relationships that break when duplicated across chunks.
            // redux intentionally excluded — react-querybuilder has a nested @reduxjs/toolkit
            // v2.x that requires redux v5 (isPlainObject, isAction); deduping would force it
            // onto the top-level redux v4 and break the build.
            dedupe: ['react', 'react-dom', '@formio/js', '@formio/react', '@formio/core', 'dayjs', 'i18next'],
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
                    // Function form required so met-formio can be matched by resolved path.
                    // The object form can't handle it because met-formio's package.json has
                    // an invalid "module": "node" field — the alias resolves it to a directory,
                    // so Rollup can't use it as a named entry point in the object form.
                    manualChunks(id) {
                        // React — must be a single shared instance across all chunks
                        if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) {
                            return 'react';
                        }
                        // Formio — met-formio uses a lazy getter for component registry access
                        // (fixed in met-formio), so it's safe to co-bundle with @formio/js
                        if (id.includes('/node_modules/@formio/') || id.includes('/node_modules/met-formio/')) {
                            return 'formio';
                        }
                        // Map libraries — keep together to avoid spatial index init ordering issues
                        if (id.includes('/node_modules/maplibre-gl/') || id.includes('/node_modules/react-map-gl/')) {
                            return 'maplibre';
                        }
                        // Date pickers — validateDay.js throws if dayjs is in a separate chunk
                        if (id.includes('/node_modules/dayjs/') || id.includes('/node_modules/@mui/x-date-pickers/')) {
                            return 'datepickers';
                        }
                        // Redux — store must be a single instance; splitting react-redux from redux
                        // causes useSelector/useDispatch to reference a different store than Provider.
                        // Exclude react-querybuilder's nested copies: it uses @reduxjs/toolkit v2 +
                        // redux v5 internally, which is a different major from the app's redux v4.
                        if (
                            !id.includes('/node_modules/react-querybuilder/') &&
                            (
                                id.includes('/node_modules/redux/') ||
                                id.includes('/node_modules/react-redux/') ||
                                id.includes('/node_modules/@reduxjs/')
                            )
                        ) {
                            return 'redux';
                        }
                        // i18next — initialized once via i18n.init(); duplicating it means hooks
                        // get an uninitialized copy and t() returns raw keys
                        if (id.includes('/node_modules/i18next/') || id.includes('/node_modules/react-i18next/')) {
                            return 'i18n';
                        }
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