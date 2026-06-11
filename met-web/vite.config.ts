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
            dedupe: ['react', 'react-dom', '@formio/js', '@formio/react', '@formio/core', 'dayjs', 'redux', 'i18next'],
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
                        // Formio core packages — kept together so @formio/core initializes
                        // before @formio/js, and @formio/js registers its built-in components
                        // before anything tries to extend them
                        if (id.includes('/node_modules/@formio/')) {
                            return 'formio';
                        }
                        // met-formio is intentionally in a SEPARATE chunk from @formio/js.
                        // Its component modules access Components.components.textfield at
                        // evaluation time (not lazily). If met-formio is co-bundled with
                        // @formio/js, the whole chunk evaluates together and there is no way
                        // to guarantee @formio/js has registered its components first.
                        // Keeping it separate means the dynamic import in index.tsx can load
                        // the formio chunk first (fully initializing the registry), then load
                        // this chunk — at which point Components.components.textfield exists.
                        if (id.includes('/node_modules/met-formio/')) {
                            return 'met-formio';
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
                        // causes useSelector/useDispatch to reference a different store than Provider
                        if (
                            id.includes('/node_modules/redux/') ||
                            id.includes('/node_modules/react-redux/') ||
                            id.includes('/node_modules/@reduxjs/')
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