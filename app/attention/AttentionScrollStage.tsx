'use client'
import type { ReactNode } from 'react'
import { ScrollStage } from '../../components/lesson/ScrollStage'
import { AttentionFigure } from './AttentionFigure'

/**
 * Thin client-side wrapper around ScrollStage.
 *
 * page.mdx is a Server Component, and the `figure` prop ScrollStage expects
 * is a function — functions cannot be serialized across the server/client
 * boundary. Creating the closure here, inside a Client Component, means the
 * MDX file only ever needs to pass `children` (JSX), which React supports
 * natively for Server → Client composition.
 */
export function AttentionScrollStage({ children }: { children: ReactNode }) {
  return (
    <ScrollStage figure={state => <AttentionFigure {...state} />}>
      {children}
    </ScrollStage>
  )
}
