'use client'
import { useMemo, useState } from 'react'
import { forward, loadModel } from '../../lib/transformer/forward'
import { softmax, temper, sampleFrom } from '../../lib/transformer/ops'
import { Distribution } from '../../components/figures/Distribution'

const CONTEXT = ['the', 'cat']

/**
 * Temperature is clamped above zero: T = 0 is a division by zero. The limit as
 * T approaches 0 is greedy decoding — always take the likeliest word — which is
 * what the slider approaches at its left edge without ever reaching.
 */
const MIN_T = 0.1
const MAX_T = 4

export function Playground() {
  const [t, setT] = useState(1)
  const [draws, setDraws] = useState<string[]>([])

  const model = loadModel()

  // The forward pass runs once, not on every slider tick: temperature acts on
  // the logits, and the logits do not depend on it.
  const logits = useMemo(() => {
    const { logits } = forward(CONTEXT)
    return logits[logits.length - 1]
  }, [])

  /**
   * Bar order is fixed at T = 1 and never recomputed, so raising the
   * temperature reshapes the bars in place instead of making them swap
   * positions underneath the reader's cursor.
   */
  const order = useMemo(() => {
    const p = softmax(logits)
    return model.vocab
      .map((word, i) => ({ word, i }))
      .sort((a, b) => p[b.i] - p[a.i])
      .slice(0, 6)   // the 4 legal words plus 2 of the tail, so the cliff shows
  }, [logits, model.vocab])

  const probs = softmax(temper(logits, t))
  const shown = order.map(({ i }) => probs[i])
  const labels = order.map(({ word }) => word)

  const draw = () => {
    // The ONLY randomness in the lesson, and it lives here rather than inside
    // sampleFrom — which is what keeps every op in ops.ts pure and exactly
    // testable.
    const i = sampleFrom(probs, Math.random())
    setDraws(d => [...d, model.vocab[i]])
  }

  return (
    <div className="playground">
      <label className="playground-controls">
        <span>temperature</span>
        <input
          type="range"
          min={MIN_T}
          max={MAX_T}
          step={0.05}
          value={t}
          aria-label="temperature"
          onChange={e => setT(Number(e.target.value))}
        />
        <output>{t.toFixed(2)}</output>
      </label>

      <Distribution
        probs={shown}
        labels={labels}
        progress={1}
        label={`P(next word | "${CONTEXT.join(' ')}")`}
      />

      <div className="playground-controls">
        <button type="button" onClick={draw}>sample a token</button>
        {draws.length > 0 && (
          <button type="button" onClick={() => setDraws([])}>clear</button>
        )}
      </div>

      {draws.length > 0 && (
        <p className="playground-note">
          {draws.map((w, i) => (
            <span key={i} data-draw={i}>{w}</span>
          ))}
        </p>
      )}
    </div>
  )
}
