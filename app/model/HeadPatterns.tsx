import { forward } from '../../lib/transformer/forward'
import { CausalTriangle } from '../../components/figures/CausalTriangle'
import { formatSignificant } from '../../components/figures/formatCell'

const PROMPT = ['the', 'dog', 'drank', 'water', 'so', 'it']
const IT = 5

/**
 * What the two heads actually learned, side by side.
 *
 * The claim in the prose — head 0 hunts for the subject, head 1 keeps the word
 * itself — is not asserted here, it is read off a live forward pass: the two
 * weights quoted in the captions come out of the same trace that draws the two
 * triangles. If a retrained model learned something different, this section
 * would say so rather than keep repeating the old story.
 *
 * A Server Component: `forward()` runs at build time.
 */
export function HeadPatterns() {
  const trace = forward(PROMPT)
  const subject = PROMPT.indexOf('dog')

  const heads = [
    {
      i: 0,
      title: 'head 0 — the subject finder',
      body: (
        <>
          Look along the bottom row: <code>it</code> spends{' '}
          <strong>{formatSignificant(trace.weights[0][IT][subject])}</strong> of its
          attention on <code>dog</code>, and essentially none anywhere else. This
          head resolves the pronoun. It is the head the lesson walks through.
        </>
      ),
    },
    {
      i: 1,
      title: 'head 1 — the one that keeps the word',
      body: (
        <>
          The same row in the other head: <code>it</code> puts{' '}
          <strong>{formatSignificant(trace.weights[1][IT][IT])}</strong> on{' '}
          <em>itself</em>. The whole diagonal glows. This head barely moves
          information around — it hands each word its own value back, which is how
          the model keeps a word from being erased by whatever it looked at.
        </>
      ),
    },
  ]

  return (
    <div className="heads">
      {heads.map(h => (
        <figure key={h.i} className="head">
          <CausalTriangle weights={trace.weights[h.i]} tokens={PROMPT} />
          <figcaption>
            <strong className="head-title">{h.title}</strong>
            {h.body}
          </figcaption>
        </figure>
      ))}
    </div>
  )
}
