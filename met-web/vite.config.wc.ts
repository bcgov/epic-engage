import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';
import { readFileSync } from 'fs';

// Read version from package.json
const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));
const version = packageJson.version;

// https://vitejs.dev/config/
// Web Component library build configuration
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
            'met-formio': path.resolve(__dirname, 'node_modules/met-formio'),
        },
    },
    define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
    },
    build: {
        lib: {
            entry: path.resolve(__dirname, 'src/web-components/index.ts'),
            name: 'MetWebComponents',
            formats: ['iife'],
            fileName: () => `static/js/met-web-component.${version}.js`,
        },
        outDir: 'wc-lib',
        sourcemap: true,
        // Bundle everything including React - makes the WC fully standalone
        rollupOptions: {
            output: {
                // Ensure all dependencies are bundled
                inlineDynamicImports: true,
            },
        },
        commonjsOptions: {
            include: [/met-formio/, /node_modules/],
            transformMixedEsModules: true,
        },
    },
});
