import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import './index.css';
import App from './App.jsx';
import { store } from './store/index.js';
import { bootstrapAuth } from './store/authSlice.js';
import { hydrateSession } from './store/hydrate.js';
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
 * Resume the session, once, before anything renders.
 *
 * DO NOT MOVE THIS INTO A useEffect. <StrictMode> deliberately double-invokes effects in
 * development, so an effect-based bootstrap would fire two refreshes on every cold start. Refresh
 * tokens rotate: the second would present a token the first had just rotated away, the server would
 * read that as a replayed token, and it would revoke every session the account has. The symptom is
 * being signed out on every single page load, in development only, with nothing in the code that
 * looks wrong. Dispatching from the composition root fires it exactly once.
 *
 * The rejection is swallowed on purpose. Most cold starts are anonymous, and finding that out is
 * what this call is *for* — it is not an error, and the slice records it without setting one.
 */
store
  .dispatch(bootstrapAuth())
  .unwrap()
  .then(() => hydrateSession(store.dispatch))
  .catch(() => {});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </StrictMode>
);
