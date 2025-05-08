const webpack = require('webpack');

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
          fs: false,
          net: false,
          tls: false,
          child_process: false
        },
      },
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