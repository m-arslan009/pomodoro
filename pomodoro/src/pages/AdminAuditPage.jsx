/*
 * AdminAuditPage — the audit record, at /admin/audit.
 *
 * A PLACEHOLDER ON PURPOSE, like the rest of the panel: no log, no table, no filters, no API call.
 * What an audit record contains and where it comes from is undecided — nothing in `CONTRACT.md`
 * describes one — so this page claims nothing about it and only holds the route open.
 */
function AdminAuditPage() {
  return (
    <section className="admin-panel" aria-labelledby="admin-audit-title">
      <h2 id="admin-audit-title" className="admin-panel__title">
        Audit
      </h2>
      <p className="admin-panel__coming">Coming Soon</p>
    </section>
  );
}

export default AdminAuditPage;
