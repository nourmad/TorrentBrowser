const webpack = require('webpack');
const path = require('path');

module.exports = {
  webpack: {
    configure: {
      resolve: {
        fallback: {
          path: require.resolve('path-browserify'),
          stream: require.resolve('stream-browserify'),
          crypto: require.resolve('crypto-browserify'),
          buffer: require.resolve('buffer'),
          os: require.resolve('os-browserify/browser'),
          process: require.resolve('process/browser'),
          util: require.resolve('util/'),
          assert: require.resolve('assert/'),
          vm: require.resolve('vm-browserify'),
          fs: false,
          net: false,
          tls: false,
          child_process: false
        },
        alias: {
          'process/browser': path.resolve(__dirname, 'src/process/browser.js')
        }
      },
      module: {
        rules: [
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
      }
    },
    plugins: {
      add: [
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
          process: 'process/browser',
        }),
        new webpack.DefinePlugin({
          'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
        })
      ],
    },
  },
}; 