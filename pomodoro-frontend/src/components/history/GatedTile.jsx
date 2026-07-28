import useFeatureGate from '../../hooks/useFeatureGate.js';

/*
 * GatedTile — the glass card shell shared by the History dashboard's title-gated
 * chart tiles. It keeps each chart a single .hp-tile (so the dashboard stays
 * visually consistent) while layering the same "gated but previewable" treatment
 * the Settings page uses through <FeatureGate>: the gating DECISION comes from the
 * shared useFeatureGate hook + gamification service, and this component only adds
 * the History-flavoured presentation.
 *
 * When unlocked it renders exactly like a normal chart tile (title, optional
 * subtitle, and the `meta` control/legend on the right). When still locked the
 * `meta` is replaced by a lock chip, the chart body is dimmed and marked `inert`
 * so pointer, keyboard, and assistive tech all skip the preview, and an unlock
 * hint reports how many lifetime points remain. The always-visible RecentTile
 * table stays the accessible data fallback while a chart is locked.
 */

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="13"
      height="13"
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
  );
}

function GatedTile({ feature, headingId, title, subtitle, meta, className = '', children }) {
  const { unlocked, requiredTitle, lifetimePoints } = useFeatureGate(feature);
  const remaining = requiredTitle ? Math.max(0, requiredTitle.threshold - lifetimePoints) : 0;

  return (
    <section
      className={`hp-tile ${className}${unlocked ? '' : ' hp-tile--locked'}`.trim()}
      aria-labelledby={headingId}
    >
      <header className="hp-tile__head hp-tile__head--stacked">
        <div>
          <h2 id={headingId} className="hp-tile__title">
            {title}
          </h2>
          {subtitle && <p className="hp-tile__subtitle">{subtitle}</p>}
        </div>
        {unlocked ? (
          meta
        ) : (
          <span className="hp-lock-chip">
            <LockIcon />
            {requiredTitle?.name}
          </span>
        )}
      </header>

      <div className="hp-tile__viz" inert={unlocked ? undefined : true}>
        {children}
      </div>

      {!unlocked && requiredTitle && (
        <p className="hp-lock-hint" role="note">
          Reach <strong>{requiredTitle.name}</strong> at {requiredTitle.threshold.toLocaleString()}{' '}
          lifetime points to unlock — {remaining.toLocaleString()} to go.
        </p>
      )}
    </section>
  );
}

export default GatedTile;
