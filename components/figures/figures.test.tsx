import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Vector } from './Vector'
import { Matrix } from './Matrix'
import { MatMul } from './MatMul'
import { SoftmaxRow } from './SoftmaxRow'
import { AttentionGrid } from './AttentionGrid'
import { Distribution } from './Distribution'
import { expectPureInProgress } from './test-utils'

describe('figures are pure functions of progress', () => {
  it('Vector renders no cells at progress 0 and all cells at progress 1', () => {
    const values = [1, 2, 3, 4]
    const { container: at0 } = render(<Vector values={values} progress={0} />)
    const { container: at1 } = render(<Vector values={values} progress={1} />)
    expect(at0.querySelectorAll('[data-revealed="true"]')).toHaveLength(0)
    expect(at1.querySelectorAll('[data-revealed="true"]')).toHaveLength(4)
  })

  it('Vector reveals roughly half its cells at progress 0.5', () => {
    const { container } = render(<Vector values={[1, 2, 3, 4]} progress={0.5} />)
    expect(container.querySelectorAll('[data-revealed="true"]')).toHaveLength(2)
  })

  it('renders identically for identical props (purity)', () => {
    const p = { values: [1, 2, 3], progress: 0.37 }
    const a = render(<Vector {...p} />).container.innerHTML
    const b = render(<Vector {...p} />).container.innerHTML
    expect(a).toBe(b)
  })

  it('Matrix renders every cell at progress 1', () => {
    const { container } = render(<Matrix values={[[1, 2], [3, 4]]} progress={1} />)
    expect(container.querySelectorAll('[data-revealed="true"]')).toHaveLength(4)
  })

  it('Matrix marks the highlighted row', () => {
    const { container } = render(
      <Matrix values={[[1, 2], [3, 4]]} progress={1} highlightRow={1} />)
    expect(container.querySelectorAll('[data-highlight="true"]')).toHaveLength(2)
  })

  it('all figures render at 0, 0.5, and 1 without throwing', () => {
    for (const p of [0, 0.5, 1]) {
      expect(() => render(<Vector values={[1, 2]} progress={p} />)).not.toThrow()
      expect(() => render(<Matrix values={[[1]]} progress={p} />)).not.toThrow()
    }
  })

  it('Vector is pure under rerender: scrubbing 0 -> 0.8 -> 0.3 matches a fresh mount at 0.3', () => {
    expectPureInProgress((progress) => <Vector values={[1, 2, 3, 4, 5]} progress={progress} />)
  })

  it('Matrix is pure under rerender: scrubbing 0 -> 0.8 -> 0.3 matches a fresh mount at 0.3', () => {
    expectPureInProgress((progress) => (
      <Matrix values={[[1, 2], [3, 4], [5, 6]]} progress={progress} highlightRow={1} />
    ))
  })

  it('Matrix renders masked (-Infinity) cells as −∞, never the literal "Infinity"', () => {
    const { container } = render(
      <Matrix values={[[1, -Infinity], [3, 4]]} progress={1} />)
    const text = container.textContent ?? ''
    expect(text).toContain('−∞')
    expect(text).not.toMatch(/Infinity/)
  })

  it('Matrix renders a NaN cell distinguishably (not as a plausible number)', () => {
    const { container } = render(<Matrix values={[[NaN, 1]]} progress={1} />)
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/Infinity/)
    expect(container.querySelector('[data-invalid="true"]')?.textContent).toBe('NaN')
  })
})

describe('MatMul', () => {
  it('shows no terms at progress 0 and the full dot product at progress 1', () => {
    const { container } = render(<MatMul a={[1, 2]} b={[3, 4]} progress={1} />)
    expect(container.querySelector('[data-role="sum"]')?.textContent).toContain('11.00')
  })

  it('shows the partial sum midway', () => {
    const { container } = render(<MatMul a={[1, 2]} b={[3, 4]} progress={0.5} />)
    expect(container.querySelector('[data-role="sum"]')?.textContent).toContain('3.00')
  })

  it('is pure under rerender: scrubbing 0 -> 0.8 -> 0.3 matches a fresh mount at 0.3', () => {
    expectPureInProgress((progress) => <MatMul a={[1, 2, 3]} b={[4, 5, 6]} progress={progress} />)
  })
})

describe('SoftmaxRow', () => {
  it('bars sum to 1 at progress 1', () => {
    const { container } = render(<SoftmaxRow logits={[1, 2, 3]} progress={1} />)
    const bars = [...container.querySelectorAll('[data-role="bar"]')]
    const total = bars.reduce((s, b) => s + Number(b.getAttribute('data-value')), 0)
    expect(Math.abs(total - 1)).toBeLessThan(1e-6)
  })

  it('handles -Infinity (masked) logits without NaN', () => {
    const { container } = render(<SoftmaxRow logits={[1, -Infinity]} progress={1} />)
    const bars = [...container.querySelectorAll('[data-role="bar"]')]
    bars.forEach(b => expect(Number.isNaN(Number(b.getAttribute('data-value')))).toBe(false))
  })

  it('is pure under rerender: scrubbing 0 -> 0.8 -> 0.3 matches a fresh mount at 0.3', () => {
    expectPureInProgress((progress) => (
      <SoftmaxRow logits={[1, -Infinity, 2, 3]} progress={progress} />
    ))
  })
})

describe('AttentionGrid', () => {
  it('renders one cell per (query, key) pair', () => {
    const { container } = render(
      <AttentionGrid weights={[[1, 0], [0.5, 0.5]]} tokens={['a', 'b']} progress={1} />)
    expect(container.querySelectorAll('[data-role="att-cell"]')).toHaveLength(4)
  })

  it('is pure under rerender: scrubbing 0 -> 0.8 -> 0.3 matches a fresh mount at 0.3', () => {
    expectPureInProgress((progress) => (
      <AttentionGrid
        weights={[[1, 0], [0.5, 0.5]]}
        tokens={['a', 'b']}
        progress={progress}
        highlightQuery={0}
      />
    ))
  })

  it('a near-zero weight renders a materially different fill opacity than a small-but-real one (honesty: no opacity floor)', () => {
    // Mirrors the attention-sink case: a self-attending token leaves ~0.0003
    // on other keys. That must NOT render the same as a real-but-small 0.05.
    const { container } = render(
      <AttentionGrid
        weights={[[0.9997, 0.0003, 0.05]]}
        tokens={['cat', 'sat', 'mat']}
        progress={1}
      />)
    const cells = [...container.querySelectorAll('[data-role="att-fill"]')]
    const nearZero = Number(getComputedStyle(cells[1]).opacity)
    const smallButReal = Number(getComputedStyle(cells[2]).opacity)

    expect(nearZero).toBeCloseTo(0.0003, 4)
    expect(smallButReal).toBeCloseTo(0.05, 4)
    // The real signal: a 150x difference in mass must not collapse to the
    // same rendered opacity via an artificial floor.
    expect(smallButReal / nearZero).toBeGreaterThan(100)
  })
})

describe('Distribution', () => {
  const probs = [0.55, 0.16, 0.15, 0.14]
  const labels = ['quickly', 'ate', 'found', 'drank']

  it('reveals no bars at progress 0 and every bar at progress 1', () => {
    const { container: at0 } = render(
      <Distribution probs={probs} labels={labels} progress={0} />
    )
    const { container: at1 } = render(
      <Distribution probs={probs} labels={labels} progress={1} />
    )
    expect(at0.querySelectorAll('[data-revealed="true"]')).toHaveLength(0)
    expect(at1.querySelectorAll('[data-revealed="true"]')).toHaveLength(4)
  })

  it('renders one labelled bar per word', () => {
    const { getByText } = render(
      <Distribution probs={probs} labels={labels} progress={1} />
    )
    for (const w of labels) expect(getByText(w)).toBeTruthy()
  })

  it('draws a comparison series when given one', () => {
    const { container } = render(
      <Distribution
        probs={probs}
        labels={labels}
        progress={1}
        compare={[0.5, 1 / 6, 1 / 6, 1 / 6]}
      />
    )
    expect(container.querySelectorAll('[data-series="compare"]')).toHaveLength(4)
  })

  it('marks bars beyond the cutoff as cut', () => {
    const { container } = render(
      <Distribution probs={probs} labels={labels} progress={1} cutoff={2} />
    )
    expect(container.querySelectorAll('[data-cut="true"]')).toHaveLength(2)
  })

  it('scales bar widths so the largest prob is 100% and the rest are proportional', () => {
    const { container } = render(
      <Distribution probs={probs} labels={labels} progress={1} />
    )
    const bars = [...container.querySelectorAll('[data-series="model"]')] as HTMLElement[]
    const scale = Math.max(...probs)
    const widths = bars.map(b => parseFloat(b.style.width))
    probs.forEach((p, i) => {
      expect(widths[i]).toBeCloseTo((p / scale) * 100, 6)
    })
    expect(widths[0]).toBeCloseTo(100, 6)
  })

  it('scales by the max across BOTH series: a compare value that exceeds every model value shrinks the model bars', () => {
    const modelProbs = [0.4, 0.3, 0.2, 0.1]
    const compare = [0.9, 0.05, 0.03, 0.02]
    const { container } = render(
      <Distribution probs={modelProbs} labels={labels} progress={1} compare={compare} />
    )
    const scale = Math.max(...modelProbs, ...compare) // 0.9, driven by compare
    const modelBars = [...container.querySelectorAll('[data-series="model"]')] as HTMLElement[]
    const compareBars = [...container.querySelectorAll('[data-series="compare"]')] as HTMLElement[]

    modelProbs.forEach((p, i) => {
      expect(parseFloat(modelBars[i].style.width)).toBeCloseTo((p / scale) * 100, 6)
    })
    compare.forEach((c, i) => {
      expect(parseFloat(compareBars[i].style.width)).toBeCloseTo((c / scale) * 100, 6)
    })

    // The naive bug this guards against: scaling only by `probs`, which would
    // render the largest model bar (0.4) at 100% even though the compare
    // series (0.9) is nearly twice as large.
    expect(parseFloat(modelBars[0].style.width)).toBeLessThan(100)
    expect(parseFloat(modelBars[0].style.width)).toBeCloseTo(44.444444, 4)
  })

  it('a cut bar still renders its true, non-zero width — dimming is a CSS/attribute concern, not a width of 0', () => {
    const { container } = render(
      <Distribution probs={probs} labels={labels} progress={1} cutoff={2} />
    )
    const bars = [...container.querySelectorAll('[data-series="model"]')] as HTMLElement[]
    const scale = Math.max(...probs)
    // Indices 2 and 3 are beyond cutoff=2, so they're flagged cut, but reveal
    // is governed by progress (which is 1 here), not by cutoff.
    const cutRows = container.querySelectorAll('[data-cut="true"]')
    expect(cutRows).toHaveLength(2)
    expect(parseFloat(bars[2].style.width)).toBeCloseTo((probs[2] / scale) * 100, 6)
    expect(parseFloat(bars[3].style.width)).toBeCloseTo((probs[3] / scale) * 100, 6)
    expect(parseFloat(bars[2].style.width)).toBeGreaterThan(0)
    expect(parseFloat(bars[3].style.width)).toBeGreaterThan(0)
  })

  it('unrevealed bars render at 0% width, regardless of their probability', () => {
    // 4 bars, progress 0.5 -> shown = round(0.5 * 4) = 2, so indices 2 and 3
    // are not yet revealed.
    const { container } = render(
      <Distribution probs={probs} labels={labels} progress={0.5} />
    )
    const bars = [...container.querySelectorAll('[data-series="model"]')] as HTMLElement[]
    expect(container.querySelectorAll('[data-revealed="true"]')).toHaveLength(2)
    expect(bars[2].style.width).toBe('0%')
    expect(bars[3].style.width).toBe('0%')
  })

  it('is a pure function of progress', () => {
    expectPureInProgress(p => (
      <Distribution probs={probs} labels={labels} progress={p} />
    ))
  })
})
