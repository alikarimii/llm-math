'use client'
import type { CSSProperties } from 'react'
import type { Vector as VectorValues } from '../../lib/transformer/types'
import { formatCell } from './formatCell'

export interface VectorProps {
  values: VectorValues
  progress: number
  label?: string
}

/** Cell i is revealed once progress passes i/n. Pure: no state, no effects. */
export function Vector({ values, progress, label }: VectorProps) {
  const n = values.length
  return (
    <figure className="vec" aria-label={label}>
      {label && <figcaption>{label}</figcaption>}
      {/* Same grid discipline as Matrix: mono, tabular-nums, right-aligned, fixed
          cell width (`.cell` in globals.css) — a row of numbers a reader can
          actually line up against the row above it. `--cols` lets `.vec-cells`
          scale its type to the column it was given, exactly as Matrix does: a
          16-dimensional vector is as wide as a 16-column matrix. */}
      <div
        className="vec-cells"
        style={{ display: 'flex', '--cols': n } as CSSProperties}
      >
        {values.map((v, i) => {
          const revealed = progress >= (i + 1) / n
          const cell = formatCell(v)
          // Same masked/invalid treatment as Matrix (see formatCell.ts):
          // ±∞ is a legitimate, expected value that should read as "masked",
          // NaN is a real bug and should stand out instead of blending in.
          const style: CSSProperties = {
            opacity: revealed ? (cell.masked ? 0.35 : 1) : 0,
            transform: revealed ? 'translateY(0)' : 'translateY(4px)',
            transition: 'opacity 180ms var(--ease-out), transform 180ms var(--ease-out)',
            color: cell.invalid ? 'var(--error)' : undefined,
          }
          return (
            <span
              key={i}
              data-revealed={revealed}
              data-masked={cell.masked || undefined}
              data-invalid={cell.invalid || undefined}
              style={style}
              className="cell"
            >
              {cell.text}
            </span>
          )
        })}
      </div>
    </figure>
  )
}
