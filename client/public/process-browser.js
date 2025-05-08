// process/browser polyfill
var process = {
  browser: true,
  env: { NODE_ENV: 'production' },
  title: 'browser',
  argv: [],
  version: '',
  versions: {},
  on: function() {},
  addListener: function() {},
  once: function() {},
  off: function() {},
  removeListener: function() {},
  removeAllListeners: function() {},
  emit: function() {},
  nextTick: function(fn) { setTimeout(fn, 0); }
};

// Set in window context
window.process = process;

// Export for CommonJS compatibility
if (typeof module !== 'undefined') {
  module.exports = process;
} 