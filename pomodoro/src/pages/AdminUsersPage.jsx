/*
 * AdminUsersPage — the panel's landing page, at /admin.
 *
 * A PLACEHOLDER ON PURPOSE. The admin panel is being built incrementally, and this increment added
 * role-based navigation and route protection — not page content. There is no account list, no table,
 * no actions and no API call here, and there is not meant to be one yet.
 *
 * Its route is `index` under /admin (see App.jsx) — Users has no /admin/users path of its own, which
 * is why the sidebar's Users entry points at /admin and stays marked on the detail route.
 */
function AdminUsersPage() {
  return (
    <section className="admin-panel" aria-labelledby="admin-users-title">
      <h2 id="admin-users-title" className="admin-panel__title">
        Users
      </h2>
      <p className="admin-panel__coming">Coming Soon</p>
    </section>
  );
}

export default AdminUsersPage;
