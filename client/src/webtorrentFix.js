// Polyfills for webtorrent
import { Buffer } from 'buffer';
import path from 'path-browserify';
import stream from 'stream-browserify';
import crypto from 'crypto-browserify';
import os from 'os-browserify/browser';
import process from 'process/browser';

window.Buffer = Buffer;
window.process = process;

// Export them so they can be imported elsewhere if needed
export { Buffer, path, stream, crypto, os, process }; 