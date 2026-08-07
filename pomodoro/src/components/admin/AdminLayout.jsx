import { Outlet } from 'react-router-dom';
import AppLayout from '../AppLayout.jsx';
import '../../styles/AdminLayout.css';

/*
 * AdminLayout — the shell shared by every admin page.
 *
 * IT WRAPS AppLayout RATHER THAN REPLACING IT. Everything the app shell already owns stays owned by
 * it: the forest background, the account's theme and background overrides, the docked sidebar, the
 * mobile top header and slide-in overlay, Log Out, and the hydration banner. Rebuilding any of that
 * for /admin would be a second copy of ~200 lines of layout and a second design system for the
 * admin panel — the one thing this surface was explicitly told not to become.
 *
 * THE ADMIN NAVIGATION IS NOT HERE — IT IS THE SIDEBAR. `Nav` swaps its whole link set for an admin
 * (Users, Audit) and AppLayout's Log Out is already shared, so an admin's navigation is the app's
 * own navigation with different destinations: same sidebar, same mobile overlay, same breakpoints,
 * same styles. A strip of Users/Audit links inside this shell as well would be a second admin
 * navigation competing with the first, so this component renders none.
 *
 * What is left is what the app shell genuinely does not have: the panel's title, and somewhere to
 * put the page. That follows AppLayout's stated division at large widths — *"no global top header is
 * rendered here, so each page owns its own local header if it needs one"* — and matches how
 * HistoryPage already introduces itself with a local title and subtitle.
 *
 * It is a LAYOUT ROUTE: pages render through <Outlet/>, so the guards and this shell are declared
 * once in App.jsx instead of being re-wrapped by each admin page. That differs from the app's other
 * pages, which each wrap themselves in AppLayout — it is the reason the admin guard pair is stated
 * a single time rather than three, and adding an admin page needs no shell wiring at all.
 */
function AdminLayout() {
  return (
    <AppLayout>
      <div className="admin-shell">
        <header className="admin-shell__head">
          <h1 className="admin-shell__title">Admin panel</h1>
          <p className="admin-shell__subtitle">Accounts and the audit record.</p>
        </header>

        {/*
          Where the active admin page renders. Not a <main> — AppLayout already provides the
          document's one main landmark, and nesting a second would break it.
        */}
        <div className="admin-shell__content">
          <Outlet />
        </div>
      </div>
    </AppLayout>
  );
}

export default AdminLayout;
