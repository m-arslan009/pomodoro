import { Navigate, useLocation } from 'react-router-dom';
import PageLoader from './PageLoader.jsx';
import useAuth from '../hooks/useAuth.js';

/*
 * RequireAuth — guards the internal application pages.
 *
 * The access token lives in memory, so on a cold load the answer is known synchronously and
 * `isLoading` never holds in practice. The branch stays because the store still models a
 * loading state and rendering the page — or a redirect — against an unresolved session would be
 * wrong if anything ever reintroduces one.
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
