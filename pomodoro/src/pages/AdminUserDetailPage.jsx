import { Link, useParams } from 'react-router-dom';

/*
 * AdminUserDetailPage — one account, at /admin/users/:id.
 *
 * A PLACEHOLDER ON PURPOSE, like the rest of the panel: no profile read, no API call, no actions. It
 * reads `id` from the route and shows it because that is the one thing a detail route has to prove it
 * can do — that the parameter arrives — and a detail page naming no record would not tell you
 * whether the routing works.
 *
 * A detail page is reached from a list, not from the navigation, so it has no sidebar entry of its
 * own: the Users entry stays marked while you are here (see Nav.jsx's ADMIN_LINKS), and this page
 * offers its own way back up.
 */
function AdminUserDetailPage() {
  const { id } = useParams();

  return (
    <section className="admin-panel" aria-labelledby="admin-user-detail-title">
      <h2 id="admin-user-detail-title" className="admin-panel__title">
        Account
      </h2>
      <p className="admin-panel__coming">Coming Soon</p>
      <p className="admin-panel__note">
        Requested account: <span className="admin-panel__value">{id}</span>
      </p>
      <Link className="admin-panel__back" to="/admin">
        Back to Users
      </Link>
    </section>
  );
}

export default AdminUserDetailPage;
