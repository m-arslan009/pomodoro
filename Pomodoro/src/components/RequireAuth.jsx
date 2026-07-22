import { Navigate, useLocation } from 'react-router-dom'
import { getSession } from '../services/auth.js'

/*
 * RequireAuth — guards the internal application pages. When there is no active
 * session (see auth.js), the user is bounced to the login page with a `replace`
 * so the protected URL never lands in history. The originally requested location
 * is stashed in navigation state so the login flow could return the user there
 * later if desired.
 */
function RequireAuth({ children }) {
  const location = useLocation()

  if (!getSession()) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}

export default RequireAuth
