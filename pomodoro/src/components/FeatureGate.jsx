import useFeatureGate from '../hooks/useFeatureGate.js'
import '../styles/FeatureGate.css'

/*
 * FeatureGate — wraps a title-gated feature as a self-contained glass section.
 *
 * Per the "gated but previewable" decision, a locked feature is not hidden: the
 * same UI renders as a dimmed, non-interactive PREVIEW with a lock chip and a
 * "Reach {Title} to unlock" hint that reports how many lifetime points remain.
 * Once the unlocking title is earned the section becomes a normal interactive
 * card.
 *
 * The preview body is marked `inert`, so pointer, keyboard, and assistive tech
 * all skip the disabled controls, while the heading and unlock hint outside it
 * stay fully readable and announced.
 */

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

function FeatureGate({ feature, title, description, children }) {
  const { unlocked, requiredTitle, lifetimePoints } = useFeatureGate(feature)
  const remaining = requiredTitle ? Math.max(0, requiredTitle.threshold - lifetimePoints) : 0
  const headingId = `gate-${feature}`

  return (
    <section
      className={`feature-section${unlocked ? '' : ' feature-section--locked'}`}
      aria-labelledby={headingId}
    >
      <header className="feature-section__head">
        <div className="feature-section__heading">
          <h2 id={headingId} className="feature-section__title">
            {title}
          </h2>
          {description && <p className="feature-section__desc">{description}</p>}
        </div>
        {unlocked ? (
          <span className="feature-chip feature-chip--unlocked">Unlocked</span>
        ) : (
          <span className="feature-chip feature-chip--locked">
            <LockIcon />
            {requiredTitle?.name}
          </span>
        )}
      </header>

      <div className="feature-section__body" inert={unlocked ? undefined : true}>
        {children}
      </div>

      {!unlocked && requiredTitle && (
        <p className="feature-section__hint" role="note">
          Reach <strong>{requiredTitle.name}</strong> at{' '}
          {requiredTitle.threshold.toLocaleString()} lifetime points to unlock —{' '}
          {remaining.toLocaleString()} to go.
        </p>
      )}
    </section>
  )
}

export default FeatureGate
