import { useState } from 'react'
import useElementWidth from '../../../hooks/useElementWidth.js'

/*
 * AreaTrendChart — a single-series area + line chart drawn in real pixels
 * (measured, not a stretched viewBox) so the glowing accent line stays crisp
 * and HTML labels/tooltip align exactly to each point.
 *
 * dataviz notes: one axis, one series (so no legend — the tile title names it),
 * a 2px non-scaling accent line over a low-opacity gradient fill, ≥8px markers,
 * recessive grid, and a crosshair+tooltip hover layer. The <svg> carries a
 * role="img" summary so the trend is available without a pointer.
 */

const PAD = { top: 18, right: 16, bottom: 8, left: 16 }

function AreaTrendChart({ data, accent, unit = '', gradientId }) {
  const [wrapRef, width] = useElementWidth()
  const [active, setActive] = useState(null)

  const height = width && width < 460 ? 188 : 216
  const plotW = Math.max(0, width - PAD.left - PAD.right)
  const plotH = height - PAD.top - PAD.bottom
  const max = Math.max(1, ...data.map((d) => d.value))

  const points = data.map((d, i) => {
    const x = data.length > 1 ? PAD.left + (i * plotW) / (data.length - 1) : PAD.left + plotW / 2
    const y = PAD.top + plotH - (d.value / max) * plotH
    return { ...d, x, y }
  })

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${PAD.top + plotH} L ${points[0].x} ${PAD.top + plotH} Z`
      : ''

  const gridYs = [0.25, 0.5, 0.75, 1].map((f) => PAD.top + plotH - f * plotH)
  const activePoint = active != null ? points[active] : null

  const summary = data.map((d) => `${d.label} ${d.value}`).join(', ')

  return (
    <div className="hp-chart" ref={wrapRef}>
      {width > 0 && (
        <>
          <svg
            className="hp-chart__svg"
            width={width}
            height={height}
            role="img"
            aria-label={`Trend of ${unit || 'values'} by period: ${summary}`}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity="0.34" />
                <stop offset="100%" stopColor={accent} stopOpacity="0.02" />
              </linearGradient>
            </defs>

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

            {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
            {linePath && (
              <path
                className="hp-chart__line"
                d={linePath}
                fill="none"
                stroke={accent}
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {activePoint && (
              <line
                className="hp-chart__crosshair"
                x1={activePoint.x}
                x2={activePoint.x}
                y1={PAD.top}
                y2={PAD.top + plotH}
                vectorEffect="non-scaling-stroke"
              />
            )}

            {points.map((p, i) => (
              <circle
                key={p.label}
                className={`hp-chart__dot${i === active ? ' hp-chart__dot--active' : ''}`}
                cx={p.x}
                cy={p.y}
                r={i === active ? 5.5 : 4}
                fill={accent}
              />
            ))}

            {/* Transparent hover columns — wider hit target than the marks. */}
            {points.map((p, i) => {
              const half = data.length > 1 ? plotW / (data.length - 1) / 2 : plotW / 2
              const x = Math.max(0, p.x - half)
              const w = Math.min(width, p.x + half) - x
              return (
                <rect
                  key={`hit-${p.label}`}
                  x={x}
                  y={0}
                  width={w}
                  height={height}
                  fill="transparent"
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  aria-hidden="true"
                />
              )
            })}
          </svg>

          {activePoint && (
            <div
              className="hp-chart__tooltip"
              style={{ left: `${(activePoint.x / width) * 100}%`, top: `${activePoint.y}px` }}
            >
              <span className="hp-chart__tooltip-label">{activePoint.label}</span>
              <span className="hp-chart__tooltip-value">
                {activePoint.value} {unit}
              </span>
            </div>
          )}

          <div className="hp-chart__labels" aria-hidden="true">
            {points.map((p) => (
              <span
                key={p.label}
                className="hp-chart__label"
                style={{ left: `${(p.x / width) * 100}%` }}
              >
                {p.label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default AreaTrendChart
