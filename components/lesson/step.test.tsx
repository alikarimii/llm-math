import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Step } from './Step'

describe('Step', () => {
  /**
   * jsdom does no layout: it cannot tell us whether the prose actually stays
   * pinned on screen as the section scrolls past. What IS honestly assertable
   * from a render is that the DOM carries the declarations sticky pinning
   * depends on — an inner wrapper pinned with `position: sticky; top: 0` at a
   * full `height: 100vh`, its content centered inside that reserved space
   * with flexbox — wrapping the section's children, while the outer
   * `[data-step]` section keeps the `min-height: 100vh` that both
   * ScrollStage's spacer math and useProgress's step mapping assume.
   *
   * The wrapper must NOT use `transform: translateY(...)` to center itself:
   * that was the bug (a transform doesn't reserve layout space, so the box
   * painted above its own section and collided with whatever preceded it).
   * `top: 0` + a real `height` + flexbox centering is what fixes it, and this
   * test pins those exact styles so the bug can't quietly come back.
   *
   * A visual check in a real browser is the only way to confirm the pinning
   * itself.
   */
  it('wraps its children in a sticky inner wrapper, without disturbing the outer scroll-budget section', () => {
    const { container } = render(
      <Step>
        <p data-testid="prose">hello</p>
      </Step>
    )

    const section = container.firstElementChild as HTMLElement
    expect(section.tagName).toBe('SECTION')
    expect(section.hasAttribute('data-step')).toBe(true)
    expect(section.style.minHeight).toBe('100vh')

    const wrapper = section.firstElementChild as HTMLElement
    expect(wrapper.style.position).toBe('sticky')
    expect(wrapper.style.top).toBe('0px')
    expect(wrapper.style.height).toBe('100vh')
    expect(wrapper.style.transform).toBe('')
    expect(wrapper.style.display).toBe('flex')
    expect(wrapper.style.flexDirection).toBe('column')
    expect(wrapper.style.justifyContent).toBe('center')
    expect(wrapper.style.overflowY).toBe('auto')
    expect(wrapper.querySelector('[data-testid="prose"]')).toBeTruthy()
  })
})
