import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { getSettings } from './services/storage.js';
import { applyBaseTheme } from './services/appearance.js';

// Apply the saved base colour scheme before first paint so it also covers the
// public pages (landing / auth) that sit outside AppLayout.
applyBaseTheme(getSettings().theme);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
