import { Routes, Route, Navigate } from 'react-router-dom';
import RequireAuth from './components/RequireAuth.jsx';
import RequireGuest from './components/RequireGuest.jsx';
import RequireAdmin from './components/RequireAdmin.jsx';
import AdminLayout from './components/admin/AdminLayout.jsx';
import LandingPage from './pages/LandingPage.jsx';
import LogInPage from './pages/LogInPage.jsx';
import SignUpPage from './pages/SignUpPage.jsx';
import TimerPage from './pages/TimerPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import SettingPage from './pages/SettingPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import ReportConfirmPage from './pages/ReportConfirmPage.jsx';
import ReportUnsubscribePage from './pages/ReportUnsubscribePage.jsx';
import AdminUsersPage from './pages/AdminUsersPage.jsx';
import AdminUserDetailPage from './pages/AdminUserDetailPage.jsx';
import AdminAuditPage from './pages/AdminAuditPage.jsx';

function App() {
  return (
    <Routes>
      {/* Public pages — only reachable while signed out. */}
      <Route
        path="/"
        element={
          <RequireGuest>
            <LandingPage />
          </RequireGuest>
        }
      />
      <Route
        path="/login"
        element={
          <RequireGuest>
            <LogInPage />
          </RequireGuest>
        }
      />
      <Route
        path="/signup"
        element={
          <RequireGuest>
            <SignUpPage />
          </RequireGuest>
        }
      />

      {/*
        Opened from a link in an email, so guarded by neither RequireAuth nor RequireGuest.
        RequireAuth would strand the phone that has never signed in; RequireGuest would bounce a
        signed-in reader to /timer and they could never act on the link at all. The token in the
        query string is the only credential either page has, and the server is what checks it.
      */}
      <Route path="/reports/confirm" element={<ReportConfirmPage />} />
      <Route path="/reports/unsubscribe" element={<ReportUnsubscribePage />} />

      {/* Protected pages — only reachable while signed in. */}
      <Route
        path="/timer"
        element={
          <RequireAuth>
            <TimerPage />
          </RequireAuth>
        }
      />
      <Route
        path="/history"
        element={
          <RequireAuth>
            <HistoryPage />
          </RequireAuth>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <SettingPage />
          </RequireAuth>
        }
      />
      <Route
        path="/profile"
        element={
          <RequireAuth>
            <ProfilePage />
          </RequireAuth>
        }
      />

      {/*
        Admin panel — a LAYOUT ROUTE, unlike every other page above.

        The two guards are composed and stated once: RequireAuth answers "is the session resolved,
        and is anyone signed in", and only then does RequireAdmin ask "is it this account". Order
        matters — RequireAdmin deliberately has no loading or anonymous branch of its own, so it
        must never be reached before RequireAuth has settled both.

        The shell and the guard pair wrap the nested routes rather than each page wrapping itself
        (the pattern the other pages follow with AppLayout), so adding an admin page later is one
        <Route> and no shell wiring. Users is the `index` route — /admin IS the users page, and
        there is no /admin/users list path.
      */}
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          </RequireAuth>
        }
      >
        <Route index element={<AdminUsersPage />} />
        <Route path="users/:id" element={<AdminUserDetailPage />} />
        <Route path="audit" element={<AdminAuditPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
