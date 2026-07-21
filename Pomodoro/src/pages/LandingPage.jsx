import { Link } from 'react-router-dom'
import './LandingPage.css'

const APP_NAME = 'Evergrove'

function LeafIcon() {
  return (
    <svg
      className="landing-leaf"
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M11 21c-4 0-8-3-8-9 0-5 4-9 17-9 0 12-4 18-9 18-2.5 0-4-1.5-4-4 0-4 4-7 9-8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function AuthButtons({ variant }) {
  return (
    <div className={`landing-auth landing-auth--${variant}`}>
      <Link to="/signup" className="landing-btn landing-btn--primary">
        Sign Up
      </Link>
      <Link to="/login" className="landing-btn landing-btn--ghost">
        Log In
      </Link>
    </div>
  )
}

function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-header">
        <Link to="/" className="landing-brand" aria-label={`${APP_NAME} home`}>
          <LeafIcon />
          <span className="landing-brand__name">{APP_NAME}</span>
        </Link>
        {/* Header buttons: shown on tablet/desktop, hidden on mobile via CSS */}
        <AuthButtons variant="header" />
      </header>

      <main className="landing-main">
        <div className="landing-main__inner">
          <span className="landing-eyebrow">Focus · Grow · Achieve</span>
          <h1 className="landing-title">{APP_NAME}</h1>
          <p className="landing-punchline">
            Plant your focus. Watch your progress grow.
          </p>
          <p className="landing-desc">
            {APP_NAME} turns the Pomodoro technique into a calm, rewarding ritual.
            Work in focused sessions tied to your daily tasks, then earn points and
            titles that keep your momentum growing day after day.
          </p>
          {/* Main buttons: hidden on tablet/desktop, revealed & stacked on mobile via CSS */}
          <AuthButtons variant="main" />
        </div>
      </main>
    </div>
  )
}

export default LandingPage
