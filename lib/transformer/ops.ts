import type { Matrix, Vector } from './types'

export const dot = (a: Vector, b: Vector): number =>
  a.reduce((s, x, i) => s + x * b[i], 0)

/** PyTorch nn.Linear stores weight as [out, in], so y = x @ W^T. */
export const linear = (x: Matrix, w: Matrix): Matrix =>
  x.map(row => w.map(wRow => dot(row, wRow)))

export const softmax = (row: Vector): Vector => {
  const finite = row.filter(Number.isFinite)
  const max = finite.length ? Math.max(...finite) : 0
  const exps = row.map(v => (Number.isFinite(v) ? Math.exp(v - max) : 0))
  const sum = exps.reduce((a, b) => a + b, 0)
  return exps.map(e => (sum === 0 ? 0 : e / sum))
}
