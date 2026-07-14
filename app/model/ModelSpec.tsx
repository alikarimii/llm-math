import { loadModel } from '../../lib/transformer/forward'

/**
 * The whole model, as a table.
 *
 * Every figure here is *derived from the shipped weights*, never typed in. The
 * parameter count in particular: an article about a model is the easiest place
 * in the project to publish a number that was true once and quietly stopped
 * being true. Counting the rows and columns of the matrices we actually ship
 * means retraining at a different width updates this page by itself, and a wrong
 * number here would require the weights themselves to be wrong.
 *
 * A Server Component: this runs at build time and ships as static HTML.
 */
export function ModelSpec() {
  const m = loadModel()
  const { d_model, n_heads, d_k, n_ctx } = m.config

  const matrices: [string, number[][]][] = [
    ['embed', m.embed],
    ['pos', m.pos],
    ['wq', m.wq],
    ['wk', m.wk],
    ['wv', m.wv],
    ['wo', m.wo],
    ['unembed', m.unembed],
  ]
  const params = matrices.reduce((n, [, w]) => n + w.length * (w[0]?.length ?? 0), 0)

  const rows: [string, string, string][] = [
    ['vocabulary', String(m.vocab.length), 'words — the entire language it knows'],
    ['d_model', String(d_model), 'numbers per word'],
    ['heads', String(n_heads), `× ${d_k} numbers each, side by side`],
    ['context', String(n_ctx), 'words it can see at once'],
    ['parameters', params.toLocaleString('en-US'), 'every weight, counted'],
  ]

  return (
    <div className="spec">
      <dl>
        {rows.map(([term, value, gloss]) => (
          <div key={term} className="spec-row">
            <dt>{term}</dt>
            <dd>
              <span className="spec-value">{value}</span>
              <span className="spec-gloss">{gloss}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
