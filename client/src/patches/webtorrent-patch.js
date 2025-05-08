// Patch to fix issues with WebTorrent in the browser

// Fix for process/browser request
// We create a module that returns our process polyfill
const processBrowserPolyfill = {
  title: 'browser',
  browser: true,
  env: { NODE_ENV: 'production' },
  argv: [],
  version: '',
  versions: {},
  on: () => {},
  addListener: () => {},
  once: () => {},
  off: () => {},
  removeListener: () => {},
  removeAllListeners: () => {},
  emit: () => {},
  nextTick: (fn) => setTimeout(fn, 0),
};

// Apply patches
export function applyWebTorrentPatches() {
  console.log('Applying WebTorrent patches...');
  
  // Assign process globally if not present
  if (!window.process) {
    window.process = processBrowserPolyfill;
  }
  
  // Create a fake require function that returns our polyfill for certain modules
  const originalRequire = window.require || (() => {});
  window.require = function patchedRequire(module) {
    // Handle process/browser specifically
    if (module === 'process/browser') {
      console.log('Intercepted require("process/browser")');
      return processBrowserPolyfill;
    }
    
    // Try original require
    if (typeof originalRequire === 'function') {
      try {
        return originalRequire(module);
      } catch (e) {
        // Fallback for common Node.js modules
        if (module === 'buffer') return { Buffer };
        if (module === 'path') return require('path-browserify');
        if (module === 'crypto') return require('crypto-browserify');
        if (module === 'stream') return require('stream-browserify');
        if (module === 'os') return require('os-browserify/browser');
        if (module === 'fs') return { existsSync: () => false };
        if (module === 'net') return {};
        if (module === 'tls') return {};
        if (module === 'child_process') return {};
      }
    }
    
    throw new Error(`Module not found: ${module}`);
  };
  
  console.log('WebTorrent patches applied');
}

// Export the polyfill for direct use
export const processBrowser = processBrowserPolyfill; 