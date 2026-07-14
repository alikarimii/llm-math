'use client'
import type { Vector as Vec } from '../../lib/transformer/types'
import { formatCell } from './formatCell'

export interface MatMulProps { a: Vec; b: Vec; progress: number; label?: string }

/** Reveals a·b term by term. At progress p, floor(p*n) terms are summed. */
export function MatMul({ a, b, progress, label }: MatMulProps) {
  const n = a.length
  const shown = Math.floor(progress * n)
  const partial = a.slice(0, shown).reduce((s, x, i) => s + x * b[i], 0)
  return (
    <figure aria-label={label}>
      {label && <figcaption>{label}</figcaption>}
      <div className="matmul">
        {a.map((x, i) => (
          <span
            key={i}
            className="mono"
            data-role="term"
            data-active={i < shown}
            style={{
              opacity: i < shown ? 1 : 0.25,
              transition: 'opacity 160ms var(--ease-out)',
            }}
          >
            {formatCell(x).text}×{formatCell(b[i]).text}
            {i < n - 1 ? ' +' : ''}
          </span>
        ))}
        <span className="mono" data-role="sum">
          = {formatCell(partial).text}
        </span>
      </div>
    </figure>
  )
}
