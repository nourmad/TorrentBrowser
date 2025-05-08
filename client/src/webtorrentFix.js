// Polyfills for webtorrent
import { Buffer } from 'buffer';
import path from 'path-browserify';
import stream from 'stream-browserify';
import crypto from 'crypto-browserify';
import os from 'os-browserify/browser';

// Get existing process object if available
const processEnv = typeof process !== 'undefined' ? process.env : { NODE_ENV: 'production' };

// Process polyfill
const processPolyfill = {
  browser: true,
  env: {
    NODE_ENV: processEnv.NODE_ENV || 'development'
  },
  nextTick: function (fn) {
    setTimeout(fn, 0);
  },
  version: '',
  versions: {},
  platform: 'browser'
};

// Patch Node.js core modules
window.Buffer = Buffer;
window.process = window.process || processPolyfill;

// Patch require - this is a hack to fix the WebTorrent module
// that tries to require 'process/browser' which doesn't exist
if (typeof window.require !== 'function') {
  // Create a fake require function that returns our process object for process/browser
  window.require = (modulePath) => {
    if (modulePath === 'process/browser') {
      return window.process;
    }
    throw new Error(`Module not found: ${modulePath}`);
  };
  
  // Add module.exports to mimic Node.js module system
  window.module = { exports: {} };
}

// Export them so they can be imported elsewhere if needed
export { Buffer, path, stream, crypto, os, processPolyfill as process };