import { Navigate, useLocation } from 'react-router-dom';
import PageLoader from './PageLoader.jsx';
import useAuth from '../hooks/useAuth.js';

/*
 * RequireAuth — guards the internal application pages.
 *
 * The loading branch is live (ADR-008 rev. 3). A cold load no longer knows the answer
 * synchronously: there may be a refresh cookie, and only `bootstrapAuth` can say. Redirecting to
 * /login before that resolves would bounce a signed-in user off the page they asked for, so the
 * guard waits — briefly, and honestly — instead.
 *
 * The originally requested location travels in navigation state so the login flow can return
 * the user there.
 */
function RequireAuth({ children }) {
  const location = useLocation();
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) return <PageLoader label="Checking your session…" />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

export default RequireAuth;
