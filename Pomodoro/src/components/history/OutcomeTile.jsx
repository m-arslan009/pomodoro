/*
 * OutcomeTile — how the tracked tasks resolved, as horizontal share bars. Each
 * outcome's bar is scaled against the largest bucket so the mix is readable at a
 * glance; counts are shown directly so nothing depends on bar length alone.
 */

function OutcomeTile({ outcomes }) {
  const total = outcomes.reduce((sum, o) => sum + o.count, 0)
  const max = Math.max(1, ...outcomes.map((o) => o.count))

  return (
    <section className="hp-tile hp-outcome" aria-labelledby="hp-outcome-heading">
      <header className="hp-tile__head">
        <h2 id="hp-outcome-heading" className="hp-tile__title">
          Task outcomes
        </h2>
        <span className="hp-tile__meta">{total} tracked</span>
      </header>

      {total === 0 ? (
        <p className="hp-empty">
          No tasks tracked yet. Add tasks on the timer and their outcomes will
          break down here.
        </p>
      ) : (
        <ul className="hp-outcome__list">
          {outcomes.map((o) => {
            const share = total > 0 ? Math.round((o.count / total) * 100) : 0
            return (
              <li key={o.key} className="hp-outcome__row">
                <div className="hp-outcome__meta">
                  <span className="hp-outcome__label">{o.label}</span>
                  <span className="hp-outcome__count">
                    {o.count}
                    <span className="hp-outcome__share"> · {share}%</span>
                  </span>
                </div>
                <div className="hp-bar">
                  <span
                    className={`hp-bar__fill hp-bar__fill--${o.tone}`}
                    style={{ width: `${(o.count / max) * 100}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default OutcomeTile
