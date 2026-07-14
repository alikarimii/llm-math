'use client'
import { softmax } from '../../lib/transformer/ops'

export interface SoftmaxRowProps { logits: number[]; progress: number; labels?: string[] }

/**
 * progress 0 → raw logits (normalized only for display height)
 * progress 1 → the true softmax distribution
 * We interpolate between them so the "normalizing" is visible as motion.
 */
export function SoftmaxRow({ logits, progress, labels }: SoftmaxRowProps) {
  const probs = softmax(logits)
  const finite = logits.filter(Number.isFinite)
  const lo = finite.length ? Math.min(...finite) : 0
  const hi = finite.length ? Math.max(...finite) : 1
  const span = hi - lo || 1
  const raw = logits.map(v => (Number.isFinite(v) ? (v - lo) / span : 0))

  return (
    <figure>
      <div className="softmax">
        {logits.map((_, i) => {
          const value = raw[i] + (probs[i] - raw[i]) * progress
          return (
            <div key={i} style={{ textAlign: 'center' }}>
              {/* Fixed-height track + scaleY bar: animating `transform` instead of
                  `height` keeps this off the layout/paint path (GPU-only). The
                  bar is `--data` because a probability is model output; the
                  label under it is ink, because a token is not. */}
              <div style={{ height: 120, width: 30, display: 'flex', alignItems: 'flex-end' }}>
                <div
                  data-role="bar"
                  data-value={value}
                  data-final-prob={probs[i]}
                  style={{
                    height: 120,
                    width: 30,
                    background: 'var(--data)',
                    borderRadius: 3,
                    transformOrigin: 'bottom',
                    transform: `scaleY(${Math.max(0, value)})`,
                    transition: 'transform 200ms var(--ease-out)',
                  }}
                />
              </div>
              {labels?.[i] && <small className="softmax-label">{labels[i]}</small>}
            </div>
          )
        })}
      </div>
    </figure>
  )
}
