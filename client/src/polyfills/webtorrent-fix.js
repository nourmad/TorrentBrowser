// Fix for WebTorrent's process/browser dependency
// This file must be imported before WebTorrent

// Make sure window.process exists
if (typeof window.process === 'undefined') {
  window.process = {
    browser: true,
    env: { NODE_ENV: 'production' },
    nextTick: fn => setTimeout(fn, 0),
    title: 'browser',
    version: '',
    versions: {}
  };
}

// Patch window.require to handle 'process/browser'
if (typeof window.require !== 'function') {
  window.require = function(mod) {
    if (mod === 'process/browser') {
      return window.process;
    }
    throw new Error(`Cannot find module '${mod}'`);
  };
}

// Export process for direct use
export const processBrowser = window.process; 