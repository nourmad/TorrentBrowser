// Polyfills for webtorrent
import { Buffer } from 'buffer';
import path from 'path-browserify';
import stream from 'stream-browserify';
import crypto from 'crypto-browserify';
import os from 'os-browserify/browser';

// Process polyfill
const process = {
  browser: true,
  env: {
    NODE_ENV: process?.env?.NODE_ENV || process?.env?.REACT_APP_NODE_ENV || 'development'
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
window.process = process;

// Patch require - this is a hack to fix the WebTorrent module
// that tries to require 'process/browser' which doesn't exist
if (typeof window.require !== 'function') {
  // Create a fake require function that returns our process object for process/browser
  window.require = (modulePath) => {
    if (modulePath === 'process/browser') {
      return process;
    }
    throw new Error(`Module not found: ${modulePath}`);
  };
  
  // Add module.exports to mimic Node.js module system
  window.module = { exports: {} };
}

// Export them so they can be imported elsewhere if needed
export { Buffer, path, stream, crypto, os, process };