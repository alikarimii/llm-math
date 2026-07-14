import { formatSignificant } from './formatCell'

export interface CausalTriangleProps {
  /** A real attention matrix from a real forward pass. Never fabricated. */
  weights: number[][]
  tokens: string[]
}

/**
 * The signature element.
 *
 * A lower-triangular attention matrix is the one shape unique to this subject:
 * causality made visible. Every word may look back at itself and everything
 * before it, and at nothing after it — so the mass piles up under the diagonal
 * and the space above it is not "small weights", it is forbidden ground.
 *
 * Two rules this figure exists to state, out loud, before the reader has read a
 * word:
 *
 *  - The filled triangle is `--data` at an alpha that IS the weight. Not a
 *    binned ramp, not a floor, not a decorative gradient — the true number. A
 *    weight of 0.0003 renders as very nearly nothing, because that is what it
 *    is. (The same honesty guarantee AttentionGrid is tested for.)
 *  - The void triangle carries no chroma at all, because no forward pass ever
 *    produced a number there. Absence and magnitude must not be encoded in the
 *    same channel.
 *
 * Deliberately not a client component and deliberately stateless: it takes real
 * weights and renders them. The caller runs `forward()` (see app/page.tsx and
 * app/attention/LessonHero.tsx), so the triangle is computed once, at build
 * time, and ships as static HTML.
 */
export function CausalTriangle({ weights, tokens }: CausalTriangleProps) {
  const n = tokens.length
  return (
    <div
      className="tri"
      role="img"
      aria-label={`The causal attention pattern of a trained transformer on the sentence "${tokens.join(' ')}". Each row is one word's distribution over the words it is allowed to look back at; the upper triangle is masked, because no word may look forward.`}
      style={{ gridTemplateColumns: `auto repeat(${n}, var(--tri-cell, 46px))` }}
    >
      <span aria-hidden="true" />
      {tokens.map(t => (
        <span key={`h-${t}`} aria-hidden="true" className="tri-label tri-label-col">
          {t}
        </span>
      ))}

      {weights.map((row, r) => [
        <span key={`l-${r}`} aria-hidden="true" className="tri-label tri-label-row">
          {tokens[r]}
        </span>,
        ...row.map((w, c) => {
          // Strictly above the diagonal is the mask: structural, not numeric.
          const masked = c > r
          // Unclamped from below on purpose — see the doc comment.
          const fill = Math.max(0, Math.min(1, w))
          return (
            <div
              key={`${r}-${c}`}
              data-role="tri-cell"
              data-void={masked || undefined}
              data-weight={w}
              className="tri-cell"
              title={
                masked
                  ? `${tokens[r]} → ${tokens[c]}: masked (the future)`
                  : `${tokens[r]} → ${tokens[c]}: ${formatSignificant(w)}`
              }
            >
              {!masked && (
                <div
                  aria-hidden="true"
                  data-role="tri-fill"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 3,
                    background: 'var(--data)',
                    opacity: fill,
                  }}
                />
              )}
            </div>
          )
        }),
      ])}
    </div>
  )
}
