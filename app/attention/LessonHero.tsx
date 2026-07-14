import { forward } from '../../lib/transformer/forward'
import { CausalTriangle } from '../../components/figures/CausalTriangle'

const PROMPT = ['the', 'dog', 'drank', 'water', 'so', 'it']

/**
 * The lesson's first viewport used to be a title and a column of blank space:
 * the scroll stage's figure column has nothing to show until the reader has
 * scrolled into step one. The answer is not decoration — it is the thing the
 * whole page is about, shown up front, unexplained.
 *
 * This is the finished attention pattern, the grid the lesson spends eight steps
 * building. Putting it here first is a promise, and the rest of the page is the
 * proof: the reader ends up back at this exact picture having watched every
 * number in it arrive.
 *
 * A Server Component: `forward()` runs at build time, so this ships as static
 * HTML with no client JS at all.
 */
export function LessonHero() {
  const trace = forward(PROMPT)

  return (
    <header className="hero">
      <div>
        <p className="hero-eyebrow">self-attention, one head, six words</p>
        <h1 className="hero-title">How a word decides what to look at</h1>
        <p className="hero-lede">
          This is where we end up. Every cell is a real weight from a real model —
          and by the bottom of this page you will have watched each one being
          built.
        </p>
      </div>

      <div>
        <CausalTriangle weights={trace.weights[0]} tokens={PROMPT} />
        <p className="hero-caption">
          rows are queries, columns are keys · the void above the diagonal is the
          causal mask: nothing may look forward
        </p>
      </div>
    </header>
  )
}
