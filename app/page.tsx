import Link from 'next/link'
import { forward } from '../lib/transformer/forward'
import { CausalTriangle } from '../components/figures/CausalTriangle'

const PROMPT = ['the', 'dog', 'drank', 'water', 'so', 'it']

export default function Home() {
  // A real forward pass through the real trained model, run at build time. The
  // hero is not an illustration OF the subject; it IS the subject, and every
  // cell in it is a number the reader can go and watch being built.
  const trace = forward(PROMPT)

  return (
    <main>
      <header className="hero">
        <div>
          <p className="hero-eyebrow">every number here is real</p>
          <h1 className="hero-title">The Math Behind LLMs</h1>
          <p className="hero-lede">
            <Link href="/attention">How a word decides what to look at</Link> — a
            scroll-driven walk through self-attention, using the real numbers of a
            real trained transformer.
          </p>
          <p className="hero-lede">
            <Link href="/model">The transformer we trained</Link> — what the model
            is, what it was fed, and how to rebuild it from nothing in a minute.
          </p>
        </div>

        <div>
          <CausalTriangle weights={trace.weights[0]} tokens={PROMPT} />
          <p className="hero-caption">
            head 0 · {PROMPT.join(' ')} · the lower triangle is what each word is
            allowed to look at, and how much of its attention it spends there
          </p>
        </div>
      </header>
    </main>
  )
}
