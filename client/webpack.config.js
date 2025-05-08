const webpack = require('webpack');

module.exports = {
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
    }
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser'
    }),
    // Define process.env.NODE_ENV in the browser
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
    })
  ]
}; 