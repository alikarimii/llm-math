'use client'
import { useEffect, useState } from 'react'

/** The bit of a DOMRect the stage mapping actually depends on. */
export interface StepRect { top: number; height: number }

/** Which step the reader is on, and how far through that step they are. */
export interface StageState {
  /** Index of the step currently filling the viewport. */
  step: number
  /** Progress within that step alone, 0 → 1. */
  progress: number
}

/**
 * Maps the measured geometry of a stage's steps onto (step index, local progress).
 *
 * A step "arrives" when its top edge reaches the top of the viewport — for a
 * 100vh step that is exactly the moment it fills the screen. The active step is
 * therefore the last one whose top has crossed 0, and its local progress is how
 * far it has since travelled through its own height. Local progress hits 1 just
 * as the next step arrives, so the handoff is seamless and, crucially, the
 * figure for step k animates while step k's prose is the prose being read.
 *
 * Deriving the step index from the steps themselves — rather than slicing a
 * global scalar into a hardcoded number of bands — is what makes it impossible
 * for a figure to drift out of step with the prose when a lesson author adds or
 * removes a <Step>.
 *
 * Pure, and total: no NaN, no Infinity, no divide-by-zero. Before the stage it
 * reports (0, 0); after it, (last, 1); a zero-height or absent step degrades to
 * a defined value rather than a division by zero.
 */
export function stageState(steps: StepRect[]): StageState {
  if (steps.length === 0) return { step: 0, progress: 0 }

  let step = -1
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].top <= 0) step = i
  }
  // No step has reached the viewport top yet: the stage is still below us.
  if (step === -1) return { step: 0, progress: 0 }

  const { top, height } = steps[step]
  // A zero-height step has no interval to be part-way through; it is either
  // entirely ahead of us (progress 0) or entirely behind us (progress 1).
  const progress = height > 0 ? Math.min(1, Math.max(0, -top / height)) : 1
  return { step, progress }
}

/**
 * Measures the `[data-step]` elements inside `ref` on every scroll frame and
 * returns the stage state. Reads are batched into one rAF, so a fast scroll
 * costs one layout read per frame, not one per event.
 */
export function useStageState(ref: React.RefObject<HTMLElement | null>): StageState {
  const [state, setState] = useState<StageState>({ step: 0, progress: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let frame = 0
    const update = () => {
      frame = 0
      const steps = [...el.querySelectorAll('[data-step]')].map(node => {
        const rect = node.getBoundingClientRect()
        return { top: rect.top, height: rect.height }
      })
      const next = stageState(steps)
      setState(prev =>
        prev.step === next.step && prev.progress === next.progress ? prev : next)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [ref])

  return state
}
