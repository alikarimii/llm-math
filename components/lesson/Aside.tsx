'use client'
import type { ReactNode } from 'react'

export interface AsideProps {
  kind: 'primer' | 'deep'
  title: string
  children: ReactNode
}

const COPY = {
  primer: 'New to this? ',
  deep: 'Go deeper: ',
} as const

/**
 * Native <details> — keyboard-accessible and screen-reader-correct for
 * free, and critically: it does NOT unmount its children when closed.
 * An Aside can sit inside a ScrollStage; unmounting on collapse would
 * lose the wrapped figure's state mid-lesson. Do not replace this with
 * a conditional render ({open && <div>...}) — that reintroduces the bug.
 */
export function Aside({ kind, title, children }: AsideProps) {
  return (
    // Achromatic, by law. The green/purple left borders this replaces were
    // chrome wearing colour that never came out of the model — and on this site
    // colour means "this is model output" and nothing else. Primer and deep are
    // told apart by their copy and by the weight of the rule, not by hue.
    <details className="aside" data-kind={kind}>
      <summary>
        <small className="aside-kind">{COPY[kind]}</small>
        <span className="aside-title">{title}</span>
      </summary>
      <div className="aside-body">{children}</div>
    </details>
  )
}
