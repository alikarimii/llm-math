import { describe, it, expect } from 'vitest'
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

  it('every drawn word is one the model considers possible', () => {
    const { getByRole, container } = render(<Playground />)
    const legal = ['quickly', 'ate', 'found', 'drank']
    for (let i = 0; i < 20; i++) {
      fireEvent.click(getByRole('button', { name: /sample/i }))
    }
    const drawn = [...container.querySelectorAll('[data-draw]')].map(n => n.textContent)
    expect(drawn).toHaveLength(20)
    // The tail (12 of 16 words) holds 0.16% of the mass; 20 draws hitting it is
    // vanishingly unlikely, and if it happens the model is not what we think.
    for (const w of drawn) expect(legal).toContain(w)
  })
})
