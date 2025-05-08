// Import polyfills first
import './process-polyfill.js';
import './polyfills/webtorrent-fix';

// Apply WebTorrent patches
import { applyWebTorrentPatches } from './patches/webtorrent-patch';
applyWebTorrentPatches();

// Then other polyfills
import './webtorrentFix';

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { Buffer } from 'buffer';

// Additional safety measures
if (!window.Buffer) {
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
