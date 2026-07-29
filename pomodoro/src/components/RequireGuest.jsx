import { Navigate, useLocation } from 'react-router-dom';
import PageLoader from './PageLoader.jsx';
import useAuth from '../hooks/useAuth.js';

/*
 * RequireGuest — guards the public pages (landing, log in, sign up). A signed-in user is sent
 * into the app until they log out.
 *
 * Mirrors RequireAuth's loading branch for the same reason: it does not hold today, and
 * rendering the login form only to yank it away would be worse than a brief, honest wait if it
 * ever did.
 */
function RequireGuest({ children }) {
  const location = useLocation();
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) return <PageLoader label="Checking your session…" />;

  if (isAuthenticated) {
    // Honour the page the user was originally sent here from, so signing in returns them to
    // where they were rather than always to the dashboard.
    const intended = location.state?.from?.pathname;
    return <Navigate to={intended ?? '/timer'} replace />;
  }

  return children;
}

export default RequireGuest;
