import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Equation } from './Equation'

describe('Equation', () => {
  it('renders KaTeX markup for the given TeX', () => {
    const { container } = render(<Equation tex="a^2 + b^2 = c^2" />)
    expect(container.querySelector('.katex')).toBeTruthy()
  })

  it('respects displayMode', () => {
    const { container } = render(<Equation tex="x = y" display />)
    expect(container.querySelector('.katex-display')).toBeTruthy()
  })
})
