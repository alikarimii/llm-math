'use client'
import { useMemo, useState } from 'react'
import { forward, loadModel } from '../../lib/transformer/forward'
import { AttentionGrid } from '../../components/figures/AttentionGrid'

export interface PlaygroundProps { mode: 'scaling' | 'sentence' }

export const DEFAULT_PROMPT = ['the', 'dog', 'drank', 'water', 'so', 'it']

export function Playground({ mode }: PlaygroundProps) {
  const model = loadModel()
  const [scale, setScale] = useState(true)
  const [tokens, setTokens] = useState<string[]>(DEFAULT_PROMPT)

  const trace = useMemo(() => {
    try {
      return forward(tokens, { scale })
    } catch {
      return null
    }
  }, [tokens, scale])

  if (!trace) return <p>Those tokens aren&apos;t in this model&apos;s vocabulary.</p>

  const head0 = trace.weights[0]

  return (
    <div className="playground">
      {mode === 'scaling' && (
        <label className="playground-controls">
          <input
            type="checkbox"
            checked={scale}
            onChange={e => setScale(e.target.checked)}
          />
          <span>divide by √d<sub>k</sub></span>
        </label>
      )}

      {mode === 'sentence' && (
        <div className="playground-controls">
          {tokens.map((tok, i) => (
            <select
              key={i}
              value={tok}
              aria-label={`token ${i + 1} of ${tokens.length}`}
              onChange={e => {
                const next = [...tokens]
                next[i] = e.target.value
                setTokens(next)
              }}
            >
              {model.vocab.map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          ))}
        </div>
      )}

      <AttentionGrid weights={head0} tokens={tokens} progress={1} />

      {mode === 'scaling' && !scale && (
        <p className="playground-note">
          Without the √d<sub>k</sub> divisor the scores grow with dimension, softmax
          saturates, and attention collapses onto a single token.
        </p>
      )}
    </div>
  )
}
