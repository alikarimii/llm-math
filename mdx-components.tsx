import type { MDXComponents } from 'mdx/types'
import { Step } from './components/lesson/Step'
import { Aside } from './components/lesson/Aside'
import { Equation } from './components/figures/Equation'

/**
 * What a lesson author may reach for without an import.
 *
 * Deliberately narrow:
 *
 * - ScrollStage is NOT here. Its `figure` prop is a function, and functions do
 *   not cross the RSC boundary, so `<ScrollStage figure={...}>` in an .mdx file
 *   throws. A lesson wires its own stage in a client component (see
 *   app/attention/AttentionScrollStage.tsx) and imports that.
 * - The raw figures (Vector, Matrix, MatMul, SoftmaxRow, AttentionGrid) are NOT
 *   here either. From MDX the only way to feed one is to type literal numbers
 *   by hand — i.e. to fabricate data, which this project forbids. Figures take
 *   their values from a real forward pass, so they belong in a component that
 *   has one. Leaving them out of scope makes the forbidden thing impossible.
 * - Playground is a lesson's content, not the engine's; app/attention/page.mdx
 *   imports it directly.
 *
 * What remains is the authoring surface: structure (Step, Aside) and typeset
 * math (Equation), none of which can express a fabricated number.
 */
const components: MDXComponents = { Step, Aside, Equation }

export function useMDXComponents(): MDXComponents {
  return components
}
