'use client'
import { formatSignificant } from './formatCell'

export interface AttentionGridProps {
  weights: number[][]
  tokens: string[]
  progress: number
  highlightQuery?: number
}

/**
 * Rows reveal top-to-bottom as progress advances. Opacity encodes attention mass.
 *
 * Layout note (the bug this shape exists to prevent): the grid was previously a
 * `display: grid` block whose template was `auto repeat(n, 32px)`. A block-level
 * grid fills its container, and the only flexible track was that leading `auto`
 * label column — so on a wide viewport the labels sat at the far left and the
 * cells were flung a thousand-odd pixels away at the right edge, with a canyon
 * of nothing between a row's name and the row itself. `inline-grid` +
 * `width: fit-content` (see `.att` in globals.css) makes the grid exactly as wide
 * as its contents; the stage centres it.
 */
export function AttentionGrid({ weights, tokens, progress, highlightQuery }: AttentionGridProps) {
  const rows = weights.length
  return (
    <figure>
      <div
        className="att"
        style={{ gridTemplateColumns: `auto repeat(${tokens.length}, var(--att-cell))` }}
      >
        <span />
        {tokens.map(t => (
          <small key={`h-${t}`} className="att-label att-label-col">{t}</small>
        ))}
        {weights.map((row, r) => {
          const rowRevealed = progress >= (r + 1) / rows
          const dim = highlightQuery !== undefined && highlightQuery !== r
          return [
            <small
              key={`l-${r}`}
              className="att-label att-label-row"
              style={{ opacity: dim ? 0.4 : 1 }}
            >
              {tokens[r]}
            </small>,
            ...row.map((w, c) => {
              // Fill opacity is the true weight, unclamped from below — a near-zero
              // weight must render as near-invisible fill. Legibility of the grid
              // (rows/columns visible even at ~0 mass) comes from the static border
              // in `.att-cell`, which is NOT part of the mass encoding.
              const fillOpacity = Math.max(0, Math.min(1, w))
              // Strictly above the diagonal is the causal mask: not a small
              // number, but a cell no forward pass ever wrote to. Absence and
              // magnitude must not share a channel, so it gets `--void` and no
              // data colour at all.
              const masked = c > r
              return (
                <div
                  key={`${r}-${c}`}
                  data-role="att-cell"
                  data-weight={w}
                  data-void={masked || undefined}
                  className="att-cell"
                  title={`${tokens[r]} → ${tokens[c]}: ${formatSignificant(w)}`}
                  style={{
                    opacity: rowRevealed ? 1 : 0,
                    transition: 'opacity 220ms var(--ease-out)',
                  }}
                >
                  <div
                    aria-hidden="true"
                    data-role="att-fill"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'var(--data)',
                      // De-emphasize non-focal rows by scaling their existing
                      // mass encoding down, not replacing it with a flat
                      // constant — a flat value would render every dimmed
                      // row identically regardless of its actual attention
                      // pattern, discarding the exact signal the lesson is
                      // teaching. Scaling preserves relative differences
                      // while still reading as visually secondary.
                      opacity: dim ? fillOpacity * 0.3 : fillOpacity,
                      transition: 'opacity 220ms var(--ease-out)',
                    }}
                  />
                </div>
              )
            }),
          ]
        })}
      </div>
    </figure>
  )
}
