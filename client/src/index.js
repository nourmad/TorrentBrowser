// Import polyfills first
import './process-polyfill.js';
import './polyfills/webtorrent-fix';
import './webtorrentFix';

// Standard React imports
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { Buffer } from 'buffer';

// Ensure process and Buffer are available globally
if (typeof window.process === 'undefined') {
  window.process = {
    browser: true,
    env: { NODE_ENV: process.env.NODE_ENV || 'production' },
    nextTick: (fn) => setTimeout(fn, 0),
    title: 'browser',
    version: '',
    versions: {}
  };
}

if (typeof window.Buffer === 'undefined') {
  window.Buffer = Buffer;
}

// Ensure dark mode is applied before initial render
// This works with the script in index.html to prevent any flash of white content
if (localStorage.getItem('darkMode') === 'true') {
  document.documentElement.setAttribute('data-theme', 'dark');
} else {
  document.documentElement.removeAttribute('data-theme');
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
