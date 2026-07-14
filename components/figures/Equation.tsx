'use client'
import katex from 'katex'
import { useMemo } from 'react'

export interface EquationProps { tex: string; display?: boolean }

/**
 * KaTeX rendering for equations built in TSX rather than MDX prose.
 * dangerouslySetInnerHTML is safe here: `tex` is always our own
 * hard-coded TeX from lesson files, never user input.
 */
export function Equation({ tex, display = false }: EquationProps) {
  const html = useMemo(
    () => katex.renderToString(tex, { displayMode: display, throwOnError: true }),
    [tex, display]
  )
  return <span dangerouslySetInnerHTML={{ __html: html }} />
}
