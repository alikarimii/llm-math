import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { Playground } from './Playground'

describe('Playground', () => {
  it('opens at T = 1 showing the model\'s honest distribution', () => {
    const { getByLabelText, getByText } = render(<Playground />)
    expect((getByLabelText(/temperature/i) as HTMLInputElement).value).toBe('1')
    expect(getByText('quickly')).toBeTruthy()
    expect(getByText('0.551')).toBeTruthy()
  })

  it('turning the temperature down sharpens the distribution', () => {
    const { getByLabelText, getByText } = render(<Playground />)
    fireEvent.change(getByLabelText(/temperature/i), { target: { value: '0.25' } })
    // At T = 0.25 the model claims 98% certainty about a word that is
    // genuinely only 50% likely. That is the point of the lesson.
    expect(getByText('0.984')).toBeTruthy()
  })

  it('turning it up flattens the distribution toward a coin flip', () => {
    const { getByLabelText, getByText } = render(<Playground />)
    fireEvent.change(getByLabelText(/temperature/i), { target: { value: '4' } })
    expect(getByText('0.224')).toBeTruthy()
  })

  it('drawing a token adds a word to the list of draws', () => {
    const { getByRole, container } = render(<Playground />)
    const before = container.querySelectorAll('[data-draw]').length
    fireEvent.click(getByRole('button', { name: /sample/i }))
    expect(container.querySelectorAll('[data-draw]')).toHaveLength(before + 1)
  })

  it('samples the exact word implied by u, including a word from the tail', () => {
    // draw() calls sampleFrom(probs, Math.random()) where `probs` is the FULL
    // 16-word softmax(temper(logits, t)) vector in vocab (index) order — NOT
    // the 6-word, likeliest-first `order`/`shown` used only for display. So the
    // u thresholds below are cumulative sums over the model's real T = 1
    // distribution walked in vocab order, computed straight from
    // forward(['the', 'cat']):
    //
    //   idx  word      prob        cumulative
    //   0    ate       0.163048    0.163048
    //   1    barked    0.000023    0.163071
    //   2    bird      0.000261    0.163331   <- tail word
    //   3    bread     0.000038    0.163369
    //   4    cat       0.000247    0.163616
    //   5    chirped   0.000048    0.163664
    //   6    dog       0.000233    0.163896
    //   7    drank     0.136854    0.300750
    //   8    food      0.000006    0.300756
    //   9    found     0.147911    0.448667
    //   10   it        0.000538    0.449205
    //   11   purred    0.000091    0.449296
    //   12   quickly   0.550621    0.999916
    //   13   so        0.000012    0.999929
    //   14   the       0.000037    0.999966
    //   15   water     0.000034    1.000000
    //
    // sampleFrom returns the first index whose cumulative sum exceeds u, so:
    //   u = 0.05   lands before 0.163048 (ate's cumulative)      -> "ate"
    //   u = 0.20   lands in (0.163896, 0.300750]                 -> "drank"
    //   u = 0.35   lands in (0.300756, 0.448667]                 -> "found"
    //   u = 0.90   lands in (0.449296, 0.999916]                 -> "quickly"
    //   u = 0.1632 lands in (0.163071, 0.163331]                 -> "bird" (tail)
    //
    // The tail draw is the point of the lesson: sampling — unlike argmax — can
    // and does surface a word the model considers unlikely. If it never did,
    // it would not be sampling.
    const { getByRole, container } = render(<Playground />)
    const draws = [0.05, 0.2, 0.35, 0.9, 0.1632]
    const expected = ['ate', 'drank', 'found', 'quickly', 'bird']

    const spy = vi.spyOn(Math, 'random')
    try {
      for (const u of draws) {
        spy.mockReturnValueOnce(u)
        fireEvent.click(getByRole('button', { name: /sample/i }))
      }
    } finally {
      vi.restoreAllMocks()
    }

    const drawn = [...container.querySelectorAll('[data-draw]')].map(n => n.textContent)
    expect(drawn).toEqual(expected)
    expect(drawn).toContain('bird')
  })
})
