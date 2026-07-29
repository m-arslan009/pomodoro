import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import './index.css';
import App from './App.jsx';
import { store } from './store/index.js';
import { getSettings } from './services/storage.js';
import { applyBaseTheme } from './services/appearance.js';

// Apply the saved base colour scheme before first paint so it also covers the
// public pages (landing / auth) that sit outside AppLayout.
applyBaseTheme(getSettings().theme);

/*
 * No session bootstrap. The access token is held in memory only, so a page load starts anonymous
 * by definition — there is nothing to ask the server about until the user signs in.
 */

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </StrictMode>
);
