import { Navigate } from 'react-router-dom'
import { getSession } from '../services/auth.js'

/*
 * RequireGuest — guards the public pages (landing, log in, sign up). A user with
 * an active session is not allowed back onto these until they log out, so they
 * are redirected into the app (the timer dashboard) with a `replace`.
 */
function RequireGuest({ children }) {
  if (getSession()) {
    return <Navigate to="/timer" replace />
  }

  return children
}

export default RequireGuest
