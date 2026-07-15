# llm_math

**Live demo: https://llm-math.llmmath.workers.dev/**

Scroll-driven lessons on the math behind large language models — built around a
**real transformer that we actually trained**, not a diagram of one.

The governing rule of the whole site: *every number a reader sees is real.* The
hero grid on the homepage, the attention weights, the probability distributions,
the logits behind `temperature: 0.7` — all of it is produced by running the
trained model's weights through a forward pass at build time. Nothing is staged
for effect.

## The lessons

- **`/attention` — How a word decides what to look at.** A scroll-driven walk
  through self-attention: embeddings → Q/K/V → scores → mask → softmax → the
  weighted sum, one operation per step, each step's figure driven by the real
  trace.
- **`/probability` — Where the numbers come from.** What `temperature` actually
  divides, and the payoff: the model's next-word odds turn out to be the
  empirical frequencies of its own training corpus. Ends in a temperature +
  sampling playground.
- **`/model` — The transformer we trained.** What the model is, what it was fed,
  and how to rebuild it from scratch in about a minute.

## How it works

A tiny transformer (`train/model.py`: `d_model=16`, `2` heads, context `6`, a
16-word vocabulary) is trained in PyTorch on 18 hand-designed sentences. Its
weights are exported to JSON, and a TypeScript re-implementation of the forward
pass (`lib/transformer/`) reruns the model at build time so the lessons render
from live numbers.

```
train/corpus.py ──┐
                  ├─► train/train.py ─► train/model.pt ─► train/export.py ─┐
train/model.py ───┘                                                        │
                                                                           ▼
                              public/model/{weights,fixtures,corpus}.json
                                                                           │
                              lib/transformer/forward.ts (same math, in TS)│
                                                                           ▼
                                        Next.js static export ─► out/
```

The corpus lives in exactly one place — `train/corpus.py` — and is shipped to
the browser as `public/model/corpus.json`. It is never transcribed into
TypeScript by hand, because the `/probability` lesson proves the model's output
probabilities equal these sentences' frequencies; the two must not be able to
drift apart. (See the design notes at the top of `train/corpus.py` for why the
corpus is shaped the way it is — the sentence set is load-bearing, not filler.)

## Tech stack

- **Next.js 16** (App Router, `output: 'export'` → fully static)
- **React 19** + **MDX** for the lessons, **KaTeX** for math
- **TypeScript**, **Vitest** + Testing Library for the test suite
- **PyTorch** for training only (not a runtime dependency)
- Deployed to **Cloudflare** via **Wrangler**

## Getting started

```bash
npm install
npm run dev        # local dev server at http://localhost:3000
```

### Test / build / deploy

```bash
npm test           # vitest run — the full suite
npm run build      # static export to out/
npm run deploy     # build, then wrangler deploy
```

### Retraining the model

Only needed if you change the architecture or the corpus. Requires Python with
`torch` (see `train/requirements.txt`):

```bash
cd train
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python train.py     # trains, writes model.pt
python export.py    # writes public/model/*.json
```

## Project structure

```
app/                  Next.js routes — one folder per lesson (page.mdx + figures)
  page.tsx            homepage (real forward pass in the hero)
  globals.css         all styling; globals.test.ts guards CSS custom properties
components/
  figures/            pure, stateless visual components (Matrix, AttentionGrid, …)
  lesson/             scroll-stage machinery (ScrollStage, Step, useProgress)
lib/
  transformer/        the forward pass in TypeScript (forward, ops, types)
  corpus.ts           reads corpus.json; next-token counts & frequencies
  claim.test.ts       pins the lesson's numbers to the real model (the gate)
public/model/         exported weights, fixtures, and corpus
train/                PyTorch model, training, and export scripts
```

## Glossary

The specialized terms used above and in the lessons. The lessons themselves
define each one in plain language at first use; this is the quick reference.

**Model anatomy**

- **Token** — one input/output unit. Here a token is a whole word (the vocab is
  words, not subword pieces).
- **Vocabulary** — the fixed set of tokens the model knows; here the 16 words in
  `train/vocab.json`.
- **Embedding** — the vector of numbers that stands in for a token. Here 16
  numbers per token.
- **`d_model`** — the width of those vectors (16).
- **Position embedding** — extra numbers added to an embedding so the model
  knows *where* in the sequence the token sits.
- **Context (`n_ctx`)** — how many tokens the model can see at once (6 here).
- **Q / K / V (query, key, value)** — three different linear projections of each
  token's vector. Attention compares queries against keys to decide how much of
  each value to mix in.
- **Attention / self-attention** — the step where each token looks back at
  earlier tokens and pulls in a weighted blend of their values.
- **Head / multi-head** — a parallel slice of attention over part of the vector
  (2 heads × 8 numbers here), letting the model attend for several reasons at
  once. See the longer explanation in *How it works*.
- **Causal mask** — the rule that forces each token to look only at itself and
  earlier tokens, never the future.
- **Residual stream** — the running vector each token carries through the model;
  each sub-layer adds its output back into it.
- **Weights** — the learned matrices that define the model; the numbers training
  adjusts.
- **Forward pass** — running inputs through all the model's math once to get
  outputs.

**Turning vectors into words**

- **Unembed** — the final matrix that turns a token's vector back into one score
  per vocabulary word.
- **Logits** — those raw, unnormalized per-word scores.
- **Softmax** — turns a row of logits into probabilities that sum to 1.
- **Probability distribution** — the resulting per-word odds for the next token.
- **Temperature** — a number the logits are divided by before softmax; below 1
  sharpens the distribution, above 1 flattens it.
- **Sampling** — drawing the next word at random according to the distribution.
- **Top-k / top-p (nucleus)** — restrict sampling to the *k* most likely words,
  or to the smallest set of words whose probabilities sum to *p*.

**Measuring the distribution**

- **Cross-entropy** — the training loss: how surprised the model is by the true
  next word.
- **Perplexity** — `exp(cross-entropy)`; read as "the effective number of words
  the model is choosing between."
- **KL divergence** — how far one distribution is from another. The
  `/probability` lesson uses it to show the model's odds match the corpus
  frequencies.

## A note on the tests

The suite does more than check that functions return the right thing — several
tests exist to keep the "every number is real" invariant honest: `claim.test.ts`
asserts the lesson's probabilities match a real forward pass within tolerance,
`no-imperative-animation.test.ts` and `globals.test.ts` guard the rendering
layer, and the scroll-stage tests pin the figure-to-prose synchronization. If
you touch the model, the corpus, or a lesson's numbers, expect these to be what
tells you something drifted.
