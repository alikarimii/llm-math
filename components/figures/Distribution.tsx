'use client'

export interface DistributionProps {
  probs: number[]
  labels: string[]
  progress: number
  compare?: number[]
  cutoff?: number
  label?: string
}

/**
 * A probability distribution over the vocabulary, as horizontal bars.
 *
 * Bars are drawn in the order given — the CALLER sorts. That is deliberate: the
 * playground fixes the order once at T = 1 and holds it, so dragging the
 * temperature slider reshapes the bars in place rather than making them leap
 * over one another.
 *
 * `compare` draws a second, ghosted series behind the first: the corpus
 * frequencies, so the reader can see the model's bars land on them.
 *
 * `cutoff` marks where top-k / top-p truncation falls — the bars past it are
 * still drawn, but flagged as cut, because seeing WHAT was discarded is the
 * whole point.
 *
 * Bar widths animate via an inline `transition` and nothing else, which is what
 * lets the global prefers-reduced-motion override in globals.css suppress the
 * motion. See no-imperative-animation.test.ts.
 */
export function Distribution({
  probs, labels, progress, compare, cutoff, label,
}: DistributionProps) {
  const shown = Math.round(Math.min(1, Math.max(0, progress)) * probs.length)
  const scale = Math.max(...probs, ...(compare ?? [0])) || 1

  return (
    <figure className="distribution">
      {label && <figcaption>{label}</figcaption>}
      <div className="distribution-rows">
        {probs.map((p, i) => {
          const revealed = i < shown
          const cut = cutoff !== undefined && i >= cutoff
          return (
            <div
              className="distribution-row"
              key={i}
              data-revealed={revealed}
              data-cut={cut}
            >
              <span className="distribution-label">{labels[i]}</span>
              <span className="distribution-track">
                {compare && (
                  <span
                    className="distribution-bar-compare"
                    data-series="compare"
                    style={{
                      width: revealed ? `${(compare[i] / scale) * 100}%` : '0%',
                      transition: 'width 180ms var(--ease-out)',
                    }}
                  />
                )}
                <span
                  className="distribution-bar"
                  data-series="model"
                  style={{
                    width: revealed ? `${(p / scale) * 100}%` : '0%',
                    transition: 'width 180ms var(--ease-out)',
                  }}
                />
              </span>
              <span className="distribution-value">
                {revealed ? p.toFixed(3) : ''}
              </span>
            </div>
          )
        })}
      </div>
    </figure>
  )
}
