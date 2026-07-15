'use client'
import type { ReactNode } from 'react'
import { ScrollStage } from '../../components/lesson/ScrollStage'
import { ProbabilityFigure } from './ProbabilityFigure'

/**
 * Thin client-side wrapper around ScrollStage.
 *
 * page.mdx is a Server Component, and the `figure` prop ScrollStage expects is
 * a function — functions cannot be serialized across the server/client
 * boundary. Creating the closure here, inside a Client Component, means the
 * MDX file only ever needs to pass `children` (JSX), which React supports
 * natively for Server → Client composition. Same constraint, same solution as
 * app/attention/AttentionScrollStage.tsx.
 */
export function ProbabilityScrollStage({ children }: { children: ReactNode }) {
  return (
    <ScrollStage figure={state => <ProbabilityFigure {...state} />}>
      {children}
    </ScrollStage>
  )
}
