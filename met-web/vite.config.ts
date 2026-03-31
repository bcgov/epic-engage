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
            // Inject all VITE_ env vars into process.env
            ...Object.keys(env).reduce((acc, key) => {
                acc[`process.env.${key}`] = JSON.stringify(env[key]);
                return acc;
            }, {} as Record<string, string>),
        },
    };
});
