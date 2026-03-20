const webpack = require('webpack');
const path = require('path');
const wcConfig = require('./config-overrides-wc');

module.exports = function override(config) {
    const isWcBuild = process.argv.indexOf('--wc-build') !== -1;
    
    // Add alias for broken animation-frame-polyfill (Node 24 compatibility)
    config.resolve.alias = {
        ...config.resolve.alias,
        'animation-frame-polyfill': path.resolve(__dirname, 'src/animation-frame-shim.js'),
    };
    
    const fallback = config.resolve.fallback || {};
    Object.assign(fallback, {
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        assert: require.resolve('assert'),
        http: require.resolve('stream-http'),
        https: require.resolve('https-browserify'),
        os: require.resolve('os-browserify'),
        url: require.resolve('url'),
    });
    config.resolve.fallback = fallback;
    config.plugins = (config.plugins || []).concat([
        new webpack.ProvidePlugin({
            process: 'process/browser',
            Buffer: ['buffer', 'Buffer'],
        }),
    ]);
    config.module.rules.unshift({
        test: /\.m?js$/,
        resolve: {
            fullySpecified: false,
        },
    });
    if (isWcBuild) {
        config.entry = wcConfig.entry;
        config.output = {
            ...config.output,
            ...wcConfig.output,
        };
    }
    return config;
};
