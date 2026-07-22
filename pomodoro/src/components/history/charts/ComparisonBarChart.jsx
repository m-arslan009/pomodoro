import { useState } from 'react'
import useElementWidth from '../../../hooks/useElementWidth.js'

/*
 * ComparisonBarChart — grouped bars comparing two outcomes (completed vs
 * terminated) per period. Drawn in measured pixels; each bar is a top-rounded
 * path anchored to the baseline with a 2px surface gap between the pair.
 *
 * dataviz notes: two SERIES here are status roles (good vs bad), so a legend is
 * always shown and identity never rests on colour alone. One axis; recessive
 * baseline; per-group hover tooltip listing both values.
 */

const PAD = { top: 18, right: 12, bottom: 8, left: 12 }
const GROUP_GAP = 2 // surface gap between the two bars in a pair

/** Path for a rectangle with only its top corners rounded, grown from baseline. */
function topRoundedRect(x, y, w, h, r) {
  if (h <= 0 || w <= 0) return ''
  const radius = Math.min(r, w / 2, h)
  return [
    `M ${x} ${y + h}`,
    `L ${x} ${y + radius}`,
    `Q ${x} ${y} ${x + radius} ${y}`,
    `L ${x + w - radius} ${y}`,
    `Q ${x + w} ${y} ${x + w} ${y + radius}`,
    `L ${x + w} ${y + h}`,
    'Z',
  ].join(' ')
}

function ComparisonBarChart({ data, completedColor, terminatedColor }) {
  const [wrapRef, width] = useElementWidth()
  const [active, setActive] = useState(null)

  const height = width && width < 460 ? 188 : 216
  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = height - PAD.top - PAD.bottom
  const baseline = PAD.top + plotH
  const max = Math.max(1, ...data.flatMap((d) => [d.completed, d.terminated]))

  const groupW = data.length > 0 ? plotW / data.length : 0
  const groupPad = Math.min(groupW * 0.16, 14)
  const barW = Math.max(0, (groupW - groupPad * 2 - GROUP_GAP) / 2)

  const groups = data.map((d, i) => {
    const gx = PAD.left + i * groupW + groupPad
    const cH = (d.completed / max) * plotH
    const tH = (d.terminated / max) * plotH
    return {
      ...d,
      center: PAD.left + i * groupW + groupW / 2,
      completedRect: { x: gx, y: baseline - cH, w: barW, h: cH },
      terminatedRect: { x: gx + barW + GROUP_GAP, y: baseline - tH, w: barW, h: tH },
    }
  })

  const gridYs = [0.25, 0.5, 0.75, 1].map((f) => baseline - f * plotH)

  return (
    <div className="hp-chart" ref={wrapRef}>
      {width > 0 && (
        <>
          <svg
            className="hp-chart__svg"
            width={width}
            height={height}
            role="img"
            aria-label={`Completed versus terminated sessions by period: ${data
              .map((d) => `${d.label} ${d.completed} completed, ${d.terminated} terminated`)
              .join('; ')}`}
          >
            {gridYs.map((y) => (
              <line
                key={y}
                className="hp-chart__grid"
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y}
                y2={y}
              />
            ))}

            <line
              className="hp-chart__baseline"
              x1={PAD.left}
              x2={width - PAD.right}
              y1={baseline}
              y2={baseline}
              vectorEffect="non-scaling-stroke"
            />

            {groups.map((g, i) => {
              const dim = active != null && active !== i
              return (
                <g key={g.label} style={{ opacity: dim ? 0.4 : 1 }}>
                  <path
                    className="hp-chart__bar hp-chart__bar--good"
                    d={topRoundedRect(g.completedRect.x, g.completedRect.y, g.completedRect.w, g.completedRect.h, 4)}
                    fill={completedColor}
                  />
                  <path
                    className="hp-chart__bar hp-chart__bar--bad"
                    d={topRoundedRect(g.terminatedRect.x, g.terminatedRect.y, g.terminatedRect.w, g.terminatedRect.h, 4)}
                    fill={terminatedColor}
                  />
                </g>
              )
            })}

            {/* Full-height hover targets, one per group. */}
            {groups.map((g, i) => (
              <rect
                key={`hit-${g.label}`}
                x={PAD.left + i * groupW}
                y={0}
                width={groupW}
                height={height}
                fill="transparent"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                aria-hidden="true"
              />
            ))}
          </svg>

          {active != null && groups[active] && (
            <div
              className="hp-chart__tooltip"
              style={{ left: `${(groups[active].center / width) * 100}%`, top: `${PAD.top}px` }}
            >
              <span className="hp-chart__tooltip-label">{groups[active].label}</span>
              <span className="hp-chart__tooltip-row">
                <span className="hp-chart__swatch hp-chart__swatch--good" aria-hidden="true" />
                {groups[active].completed} completed
              </span>
              <span className="hp-chart__tooltip-row">
                <span className="hp-chart__swatch hp-chart__swatch--bad" aria-hidden="true" />
                {groups[active].terminated} terminated
              </span>
            </div>
          )}

          <div className="hp-chart__labels" aria-hidden="true">
            {groups.map((g) => (
              <span
                key={g.label}
                className="hp-chart__label"
                style={{ left: `${(g.center / width) * 100}%` }}
              >
                {g.label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default ComparisonBarChart
