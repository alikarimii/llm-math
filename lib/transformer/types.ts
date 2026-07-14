export type Vector = number[]
export type Matrix = number[][]
export type Tensor3 = number[][][]

export interface ModelConfig { d_model: number; n_heads: number; d_k: number; n_ctx: number }

export interface Model {
  config: ModelConfig
  vocab: string[]
  embed: Matrix; pos: Matrix
  wq: Matrix; wk: Matrix; wv: Matrix; wo: Matrix; unembed: Matrix
}

export interface ForwardTrace {
  embedded: Matrix
  q: Tensor3; k: Tensor3; v: Tensor3
  scores: Tensor3; scaled: Tensor3; weights: Tensor3
  output: Matrix
}
