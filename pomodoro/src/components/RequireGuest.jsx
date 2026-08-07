import { Navigate, useLocation } from 'react-router-dom';
import PageLoader from './PageLoader.jsx';
import useAuth from '../hooks/useAuth.js';
import { landingPathFor } from '../services/admin.js';

/*
 * RequireGuest — guards the public pages (landing, log in, sign up). A signed-in user is sent
 * into the app until they log out.
 *
 * Mirrors RequireAuth's loading branch, and it matters here too: with a refresh cookie a cold load
 * may turn out to be signed in, and rendering the login form only to yank it away a moment later is
 * worse than a brief, honest wait.
 */
function RequireGuest({ children }) {
  const location = useLocation();
  const { isLoading, isAuthenticated, user } = useAuth();

  if (isLoading) return <PageLoader label="Checking your session…" />;

  if (isAuthenticated) {
    // Honour the page the user was originally sent here from, so signing in returns them to
    // where they were rather than always to the dashboard. Failing that, the account's own
    // landing page — the admin panel for an administrator, the Timer for everyone else. This is
    // the branch a cold load with a live refresh cookie takes, so it decides where reopening the
    // app lands just as much as the login form does; the two share one rule for that reason.
    const intended = location.state?.from?.pathname;
    return <Navigate to={intended ?? landingPathFor(user)} replace />;
  }

  return children;
}

export default RequireGuest;
