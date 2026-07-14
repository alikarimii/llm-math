import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Aside } from './Aside'

describe('Aside', () => {
  it('keeps children mounted in the DOM when closed', () => {
    render(
      <Aside kind="primer" title="Refresher">
        <p data-testid="payload">figure state lives here</p>
      </Aside>
    )
    // <details> is closed by default: the summary is visible, but the
    // payload must still be present in the DOM (not conditionally
    // rendered away), so a wrapped figure never loses state.
    const details = screen.getByText('Refresher').closest('details')
    expect(details?.open).toBeFalsy()
    expect(screen.getByTestId('payload')).toBeTruthy()
  })

  it('renders the primer/deep copy and title', () => {
    render(
      <Aside kind="deep" title="The proof">
        <p>details</p>
      </Aside>
    )
    expect(screen.getByText(/Go deeper:/)).toBeTruthy()
    expect(screen.getByText('The proof')).toBeTruthy()
  })
})
