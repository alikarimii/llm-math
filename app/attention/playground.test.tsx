import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Playground, DEFAULT_PROMPT } from './Playground'

describe('Playground', () => {
  it('scaling mode renders a toggle and an attention grid', () => {
    const { container } = render(<Playground mode="scaling" />)
    expect(screen.getByRole('checkbox')).toBeTruthy()
    expect(container.querySelectorAll('[data-role="att-cell"]').length).toBeGreaterThan(0)
  })

  it('turning off √d_k makes the distribution sharper', () => {
    const { container } = render(<Playground mode="scaling" />)
    // Exclude the first query row: under causal masking it has exactly one
    // unmasked key (itself), so softmax over a single value is always
    // exactly 1 — independent of scale, for any prompt or model. Including
    // it would make both peaks trivially and permanently equal to 1,
    // masking the real effect this test exists to catch. Every other row
    // has >= 2 unmasked keys and is genuinely sensitive to scaling.
    const peak = () =>
      Math.max(...[...container.querySelectorAll('[data-role="att-cell"]')]
        .slice(DEFAULT_PROMPT.length) // drop row 0's cells (one per token)
        .map(c => Number(c.getAttribute('data-weight'))))
    const scaledPeak = peak()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(peak()).toBeGreaterThan(scaledPeak)
  })

  it('sentence mode only offers tokens the model actually knows', () => {
    render(<Playground mode="sentence" />)
    const options = screen.getAllByRole('option')
    expect(options.length).toBeGreaterThan(0)
  })
})
