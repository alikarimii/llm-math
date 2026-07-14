import weightsJson from '../../public/model/weights.json'
import { dot, linear, softmax } from './ops'
import type { ForwardTrace, Matrix, Model, Tensor3 } from './types'

const model = weightsJson as unknown as Model

export const loadModel = (): Model => model

/** Split [T, d_model] into n_heads x [T, d_k]. */
const heads = (x: Matrix, nHeads: number, dK: number): Tensor3 =>
  Array.from({ length: nHeads }, (_, h) =>
    x.map(row => row.slice(h * dK, (h + 1) * dK)))

export function forward(tokens: string[], opts: { scale?: boolean } = {}): ForwardTrace {
  const scale = opts.scale ?? true
  const { d_model, n_heads, d_k } = model.config
  const T = tokens.length

  const embedded: Matrix = tokens.map((tok, pos) => {
    const id = model.vocab.indexOf(tok)
    if (id === -1) throw new Error(`token not in vocab: ${tok}`)
    return model.embed[id].map((e, i) => e + model.pos[pos][i])
  })

  const q = heads(linear(embedded, model.wq), n_heads, d_k)
  const k = heads(linear(embedded, model.wk), n_heads, d_k)
  const v = heads(linear(embedded, model.wv), n_heads, d_k)

  const scores: Tensor3 = q.map((qh, h) =>
    qh.map(qRow => k[h].map(kRow => dot(qRow, kRow))))

  const denom = scale ? Math.sqrt(d_k) : 1
  const scaled: Tensor3 = scores.map(head =>
    head.map((row, i) => row.map((s, j) => (j > i ? -Infinity : s / denom))))

  const weights: Tensor3 = scaled.map(head => head.map(softmax))

  const perHead: Tensor3 = weights.map((wh, h) =>
    wh.map(wRow =>
      Array.from({ length: d_k }, (_, c) =>
        wRow.reduce((s, a, j) => s + a * v[h][j][c], 0))))

  const concat: Matrix = Array.from({ length: T }, (_, t) =>
    perHead.flatMap(head => head[t]))

  const projected = linear(concat, model.wo)
  const output: Matrix = embedded.map((row, t) =>
    row.map((e, i) => e + projected[t][i]))

  return { embedded, q, k, v, scores, scaled, weights, output }
}
