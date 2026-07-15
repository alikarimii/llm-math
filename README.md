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

## A note on the tests

The suite does more than check that functions return the right thing — several
tests exist to keep the "every number is real" invariant honest: `claim.test.ts`
asserts the lesson's probabilities match a real forward pass within tolerance,
`no-imperative-animation.test.ts` and `globals.test.ts` guard the rendering
layer, and the scroll-stage tests pin the figure-to-prose synchronization. If
you touch the model, the corpus, or a lesson's numbers, expect these to be what
tells you something drifted.
