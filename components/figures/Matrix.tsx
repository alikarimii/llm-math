'use client'
import type { CSSProperties } from 'react'
import type { Matrix as MatrixValues } from '../../lib/transformer/types'
import { formatCell } from './formatCell'

export interface MatrixProps {
  values: MatrixValues
  progress: number
  highlightRow?: number
  highlightCol?: number
  label?: string
}

/** Cells reveal in row-major order as progress goes 0 → 1. Pure. */
export function Matrix({ values, progress, highlightRow, highlightCol, label }: MatrixProps) {
  const rows = values.length
  const cols = values[0]?.length ?? 0
  const total = rows * cols
  return (
    <figure className="mat" aria-label={label}>
      {label && <figcaption>{label}</figcaption>}
      {/*
        A matrix must read as a grid, not as prose. Three things do that, and all
        three live in the `.cell` / `.mat-grid` chrome (globals.css): a mono face
        with `tabular-nums` so every digit is the same width, right alignment so
        the decimal points stack, and a fixed cell width so the columns are
        columns even when a cell holds "0.05" and its neighbour holds "-0.48".
        Set in proportional serif with no alignment, a 6×16 matrix reads as
        run-on text and a reader cannot scan a column at all.

        `--cols` is passed down because the chrome needs it: `.mat-grid` sizes its
        type from the width of the column it was given divided by the number of
        cells that must fit across it. Without it a 16-wide matrix cannot know it
        has to shrink.

        The track is `minmax(0, var(--cell-w))`, not `minmax(var(--cell-w), 1fr)`.
        A zero minimum is what allows the grid to be narrower than its content
        would like; the old floor is what let a 6×16 matrix push past its column
        and paint over the prose.
      */}
      <div
        className="mat-grid"
        style={
          {
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, minmax(0, var(--cell-w)))`,
            '--cols': cols,
          } as CSSProperties
        }
      >
        {values.flatMap((row, r) =>
          row.map((v, c) => {
            const idx = r * cols + c
            const revealed = progress >= (idx + 1) / total
            const highlight = r === highlightRow || c === highlightCol
            const cell = formatCell(v)
            // Masked (±∞) cells read as "this is masked out", not "a number
            // to interpret" — muted via reduced opacity, the same mechanism
            // already used for the reveal animation, so no new CSS property
            // or animation path is introduced. Invalid (NaN) cells are the
            // opposite: they indicate a real bug, so they stay full-opacity
            // and are colored to stand out rather than blend in.
            const style: CSSProperties = {
              opacity: revealed ? (cell.masked ? 0.35 : 1) : 0,
              transition: 'opacity 180ms var(--ease-out)',
              fontWeight: highlight ? 600 : 400,
              color: cell.invalid ? 'var(--error)' : undefined,
            }
            return (
              <span
                key={`${r}-${c}`}
                data-revealed={revealed}
                data-highlight={highlight || undefined}
                data-masked={cell.masked || undefined}
                data-invalid={cell.invalid || undefined}
                style={style}
                className="cell"
              >
                {cell.text}
              </span>
            )
          })
        )}
      </div>
    </figure>
  )
}
