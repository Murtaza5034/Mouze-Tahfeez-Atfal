import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.jsx';

const rootElement = document.getElementById('root');
const root = createRoot(rootElement);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Manual OneSignal Worker Registration (Ground Zero Fix)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/OneSignalSDKWorker.js', { scope: '/' })
      .then(reg => console.log('OneSignal Worker Registered Manual:', reg))
      .catch(err => console.error('Worker Registration Failed:', err));
  });
}
