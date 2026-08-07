import { Link } from 'react-router-dom';
import AppLayout from './AppLayout.jsx';
import useAuth from '../hooks/useAuth.js';
import { isAdmin } from '../services/admin.js';
import '../styles/AdminLayout.css';

/*
 * RequireAdmin — guards the /admin surface.
 *
 * IT IS COMPOSED WITH RequireAuth, NEVER USED ALONE (see App.jsx). RequireAuth owns the two
 * questions this component deliberately does not ask: whether the session is still resolving
 * (its PageLoader branch) and whether anyone is signed in at all. By the time this renders,
 * `user` is a real account — so the only question left here is which account it is. Duplicating
 * RequireAuth's loading branch would be a second copy of a rule that already has one home.
 *
 * The answer comes from `services/admin.js` and nowhere else — the same function the navigation uses
 * to choose its link set, so the two cannot disagree about who an admin is. Until the backend returns
 * `role`, that answer is "no" for every account, which is the correct default for a missing claim.
 *
 * It guards RENDERING, not data. The API has no admin routes yet and no admin guard; when it does,
 * refusing a non-admin is its job, from the bearer token. This component only decides what the client
 * is willing to draw.
 *
 * Denied renders a plain notice rather than redirecting. A silent bounce to /timer would make an
 * unbuilt panel and a broken route indistinguishable — from the outside, and from the inside while
 * the skeleton is being verified. The notice states only that the area is not available for this
 * account: it names no other account, and confirms nothing about who is or is not an administrator.
 *
 * It renders inside AppLayout so a denial is still a page of this app — the user keeps the
 * navigation, and the offered way out is a link, because leaving is navigation, not an action.
 * The styles come from AdminLayout.css, which owns every /admin surface including this one.
 */
function RequireAdmin({ children }) {
  const { user } = useAuth();

  if (!isAdmin(user)) {
    return (
      <AppLayout>
        <section className="admin-denied" aria-labelledby="admin-denied-title">
          <h1 id="admin-denied-title" className="admin-denied__title">
            Admin panel
          </h1>
          <p className="admin-denied__body">This area isn’t available for your account.</p>
          <Link className="admin-denied__link" to="/timer">
            Back to the Timer
          </Link>
        </section>
      </AppLayout>
    );
  }

  return children;
}

export default RequireAdmin;
