// Direct replacement for process/browser
// This module is explicitly referenced in the webpack config alias

// Create a process object that matches the Node.js process API
const processObj = {
  browser: true,
  env: { NODE_ENV: 'production' },
  nextTick: (fn) => setTimeout(fn, 0),
  title: 'browser',
  version: '',
  versions: {},
  on: () => {},
  once: () => {},
  off: () => {},
  removeListener: () => {},
  addListener: () => {},
  emit: () => {}
};

// In case window.process already exists, use that
if (typeof window !== 'undefined' && window.process) {
  Object.assign(processObj, window.process);
} else if (typeof window !== 'undefined') {
  window.process = processObj;
}

// Export for CommonJS
module.exports = processObj; 