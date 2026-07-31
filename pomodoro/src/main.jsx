import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import './index.css';
import App from './App.jsx';
import { store } from './store/index.js';
import { DEFAULT_SETTINGS } from './services/settings.js';
import { applyBaseTheme } from './services/appearance.js';

/*
 * Paint the default colour scheme before anything else renders.
 *
 * It can only be the default here: preferences belong to an account and a cold start is
 * anonymous, so there is nothing to read yet. AppLayout applies the account's own scheme once
 * login has fetched it, and the public pages (landing / auth) are outside AppLayout and only
 * ever see this one.
 */
applyBaseTheme(DEFAULT_SETTINGS.theme);

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
