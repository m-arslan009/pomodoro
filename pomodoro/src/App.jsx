import { Routes, Route, Navigate } from 'react-router-dom'
import RequireAuth from './components/RequireAuth.jsx'
import RequireGuest from './components/RequireGuest.jsx'
import LandingPage from './pages/LandingPage.jsx'
import LogInPage from './pages/LogInPage.jsx'
import SignUpPage from './pages/SignUpPage.jsx'
import TimerPage from './pages/TimerPage.jsx'
import HistoryPage from './pages/HistoryPage.jsx'
import SettingPage from './pages/SettingPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'

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

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
