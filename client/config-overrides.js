const webpack = require('webpack');
const path = require('path');

module.exports = function override(config, env) {
  // Add fallbacks for node modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    path: require.resolve('path-browserify'),
    stream: require.resolve('stream-browserify'),
    crypto: require.resolve('crypto-browserify'),
    buffer: require.resolve('buffer'),
    os: require.resolve('os-browserify/browser'),
    process: require.resolve('process/browser'),
    vm: require.resolve('vm-browserify')
  };

  // Add alias for process/browser to fix WebTorrent issue
  // Use our custom implementation
  config.resolve.alias = {
    ...config.resolve.alias,
    'process/browser': path.resolve(__dirname, 'src/process/browser.js')
  };

  // Enforce specific file extension for process/browser
  config.module = {
    ...config.module,
    rules: [
      ...(config.module?.rules || []),
      {
        test: /node_modules\/webtorrent\/.*\.js$/,
        loader: 'string-replace-loader',
        options: {
          search: "require\\(['\"]process/browser['\"]\\)",
          replace: 'window.process || require("process")',
          flags: 'g'
        }
      }
    ]
  };

  // Add plugins for polyfills
  config.plugins = [
    ...config.plugins,
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser'
    }),
    // Define process.env.NODE_ENV
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(env === 'production' ? 'production' : 'development')
    })
  ];

  return config;
}; 