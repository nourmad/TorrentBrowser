// Process polyfill
const processPolyfill = {
  browser: true,
  env: {
    NODE_ENV: process?.env?.NODE_ENV || process?.env?.REACT_APP_NODE_ENV || 'development'
  },
  nextTick: function(fn) {
    setTimeout(fn, 0);
  },
  version: '',
  versions: {},
  platform: 'browser'
};

// Only set if window.process is not already defined
if (!window.process) {
  window.process = processPolyfill;
}

export default window.process; 