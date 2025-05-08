const webpack = require('webpack');
const path = require('path');

module.exports = function override(config, env) {
  // Add fallbacks for Node.js core modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "crypto": require.resolve("crypto-browserify"),
    "stream": require.resolve("stream-browserify"),
    "path": require.resolve("path-browserify"),
    "os": require.resolve("os-browserify/browser"),
    "buffer": require.resolve("buffer/"),
    "fs": false,
    "http": false,
    "https": false,
    "net": false,
    "tls": false,
    "zlib": false,
    "dgram": false,
    "dns": false,
    "child_process": false,
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

  // Enable WebTorrent's Buffer usage
  config.plugins = (config.plugins || []).concat([
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),
    // Define process.env.NODE_ENV
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(env === 'production' ? 'production' : 'development')
    })
  ]);

  return config;
}; 