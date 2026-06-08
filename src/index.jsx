import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.jsx';

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.message?.includes('listener indicated an asynchronous response')) {
    event.preventDefault();
  }
});

const rootElement = document.getElementById('root');
const root = createRoot(rootElement);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);


