'use client'
import type { ReactNode } from 'react'

export interface StepProps {
  /**
   * The OPERATION this step performs, e.g. `q · k` or `÷ √dₖ`.
   *
   * Steps are deliberately not numbered 01/02/03. A number tells the reader
   * only where they are in a list; the operation tells them what the model is
   * doing, and read down the page the eight eyebrows are the forward pass
   * itself — `X = E + P` · `Q, K, V = X·W` · `q · k` · `QKᵀ` · `÷ √dₖ` ·
   * `softmax` · `A` · `A·V → + x`. The structure of the page IS the math. That
   * is the point, and it is why this is a label and not an index.
   */
  label?: string
  children: ReactNode
}

/**
 * One unit of scroll height. Each step occupies one viewport of scrolling.
 *
 * `data-step` is how ScrollStage finds and measures its steps, and its
 * `min-height: 100vh` IS the scroll budget: ScrollStage's trailing spacer and
 * the step-mapping math in useProgress both assume one step = one viewport of
 * scroll. That has to stay on the outer <section>.
 *
 * The prose itself lives in an inner `position: sticky` wrapper so it stays
 * on screen for the section's ENTIRE scroll, not just its first viewport.
 * Without this, a step's prose — vertically centered but scrolling normally —
 * has scrolled off the top well before the step's own scroll budget (and the
 * figure animating beside it) is spent: the reader watches the figure's
 * payoff arrive after the paragraph describing it is gone.
 *
 * The wrapper is pinned with `top: 0; height: 100vh` (a full viewport, sitting
 * flush at the top of the viewport) rather than the classic `top: 50%` +
 * `translateY(-50%)` centering trick. That trick shifts the box with a
 * transform, and a transform never affects layout — nothing reserves the
 * space it moves into, so when the step is at the top of the scroll region
 * the box paints above its own section's top edge and collides with whatever
 * precedes it in the document. Pinning the box itself to a real `100vh` means
 * it always occupies genuine layout space; `justify-content: center` (the
 * flex vertical-centering trick) then centers the *content inside* that
 * space, landing in the same visual spot without ever painting outside the
 * section. This matches how the figure beside it is centered in
 * `.stage-figure` (see globals.css) — same trick, same reason.
 *
 * `overflow-y: auto` plus the `justify-content: safe center` progressive
 * enhancement in globals.css (inline styles can't express the "center, but
 * fall back to start if that would clip content" fallback in one property) is
 * what keeps a step honest when its content — e.g. an expanded <Aside> — is
 * taller than the viewport: centering alone would push the top of that
 * content above the sticky box and off-screen, unreachable by scrolling.
 * `safe center` degrades to start-alignment once content overflows, and
 * `overflow-y: auto` makes the excess reachable by scroll instead of letting
 * it bleed into whatever comes after.
 *
 * A lesson author never writes any of this — they write <Step> and nothing
 * more.
 */
export function Step({ label, children }: StepProps) {
  return (
    <section data-step="" style={{ minHeight: '100vh' }}>
      <div
        className="step-prose"
        style={{
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        {label && <p className="eyebrow" data-role="step-label">{label}</p>}
        {children}
      </div>
    </section>
  )
}
