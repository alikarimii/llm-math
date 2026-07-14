import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { expect } from 'vitest'

/**
 * Guards the core architectural constraint of every figure: output must be a
 * pure function of the current `progress` prop alone, never of the path
 * taken to reach it.
 *
 * A component that ratchets forward (e.g. `useState` tracking the maximum
 * progress ever seen) renders identically on two independent fresh mounts —
 * so a naive "render twice, compare innerHTML" test cannot catch it. This
 * helper instead scrubs a SINGLE mounted instance forward then backward via
 * `rerender()`, and checks that landing back on an earlier progress value
 * reproduces exactly what a fresh mount at that same value would produce.
 *
 * @param renderAtProgress builds the element for a given progress value.
 */
export function expectPureInProgress(renderAtProgress: (progress: number) => ReactElement) {
  const { container: scrubbed, rerender } = render(renderAtProgress(0))
  rerender(renderAtProgress(0.8))
  rerender(renderAtProgress(0.3))

  const { container: fresh } = render(renderAtProgress(0.3))

  expect(scrubbed.innerHTML).toBe(fresh.innerHTML)
}
