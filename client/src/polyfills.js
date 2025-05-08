// Comprehensive polyfills for WebTorrent in browser environment
import { Buffer } from 'buffer';
import path from 'path-browserify';
import stream from 'stream-browserify';
import crypto from 'crypto-browserify';
import os from 'os-browserify/browser';

// Fix for global
if (typeof global === 'undefined') {
  window.global = window;
}

// Fix for process - careful to avoid circular references
const processEnv = typeof process !== 'undefined' && process.env 
  ? process.env 
  : { NODE_ENV: 'development' };

// Define process object if it doesn't exist
if (typeof process === 'undefined') {
  window.process = {
    browser: true,
    env: {
      NODE_ENV: processEnv.NODE_ENV || 'development'
    },
    nextTick: function(fn) {
      setTimeout(fn, 0);
    },
    version: '',
    versions: {},
    platform: 'browser',
    title: 'browser'
  };
} else {
  // Make sure process is available in window
  window.process = process;
}

// Fix for Buffer
window.Buffer = Buffer;

// Fix for setImmediate
if (typeof setImmediate === 'undefined') {
  window.setImmediate = function setImmediate(fn) {
    return setTimeout(fn, 0);
  };
  window.clearImmediate = function clearImmediate(id) {
    clearTimeout(id);
  };
}

// Patch Node.js core modules
window.path = path;
window.stream = stream;
window.crypto = crypto || window.crypto;
window.os = os;

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
  window.module = window.module || { exports: {} };
}

// Export everything for direct imports if needed
export default {
  global: window.global,
  process: window.process,
  Buffer: window.Buffer,
  setImmediate: window.setImmediate,
  clearImmediate: window.clearImmediate,
  path,
  stream,
  crypto,
  os
}; 