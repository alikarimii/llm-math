import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const css = readFileSync(join(root, 'app/globals.css'), 'utf8')

/**
 * An undefined custom property fails SILENTLY. `margin-right: var(--space-2)`
 * with no `--space-2` anywhere does not warn, does not throw, and does not fall
 * back to a default — the whole declaration is simply invalid at computed-value
 * time and the margin becomes 0. Nothing in the type system, the build, or the
 * test suite notices.
 *
 * It shipped exactly that way: the playground's drawn tokens are `inline-block`
 * (which collapses the whitespace JSX leaves between them), so a dead
 * `margin-right` rendered the sampled words as one run-on string — `bread` and
 * `purred` reading as "breadpurred". A visual bug, invisible to every check we
 * had, caught only because a human looked at the page.
 *
 * So: every custom property this stylesheet *uses* must be one it, or a
 * documented external source, *defines*.
 */

/** Properties supplied from outside globals.css, and by whom. */
const EXTERNAL: Record<string, string> = {
  // next/font emits these onto <html> via the className in app/layout.tsx.
  '--font-newsreader': 'next/font (app/layout.tsx)',
  '--font-plex-mono': 'next/font (app/layout.tsx)',
  // Set inline, per-instance, by the figures that know their own column count.
  '--cols': 'Matrix.tsx / Vector.tsx inline style',
}

const defined = new Set(css.match(/(--[\w-]+)\s*:/g)?.map(m => m.replace(/\s*:$/, '')) ?? [])

/** `var(--x)` with no fallback. `var(--x, 1rem)` is legal even when --x is absent. */
const referencedWithoutFallback = [...new Set(
  [...css.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)].map(m => m[1])
)].sort()

const lineOf = (token: string): number =>
  css.split('\n').findIndex(l => l.includes(`var(${token})`)) + 1

describe('every CSS custom property used is actually defined', () => {
  it.each(referencedWithoutFallback)('%s resolves', token => {
    const ok = defined.has(token) || token in EXTERNAL
    expect(
      ok,
      `globals.css:${lineOf(token)} uses var(${token}), but nothing defines it. ` +
      `An undefined custom property silently invalidates its declaration — the ` +
      `property just doesn't apply. Define it in :root, give it a fallback ` +
      `(var(${token}, <value>)), or add it to EXTERNAL with a note on who supplies it.`
    ).toBe(true)
  })

  // A scan that matches nothing reports green forever. Pin the real tokens.
  it('is not vacuous: it sees the stylesheet it is scanning', () => {
    expect(defined.has('--rule')).toBe(true)
    expect(defined.has('--data')).toBe(true)
    expect(referencedWithoutFallback.length).toBeGreaterThan(10)
  })

  it('keeps the EXTERNAL allowlist honest: every entry is genuinely used', () => {
    // A stale exemption would silently excuse a future typo of the same name.
    for (const token of Object.keys(EXTERNAL)) {
      expect(
        referencedWithoutFallback.includes(token),
        `${token} is exempted but no longer used — remove it from EXTERNAL`
      ).toBe(true)
    }
  })

  it('catches the bug it exists to catch', () => {
    // Proof the detection works, so a green run means something.
    const broken = '.x { margin-right: var(--space-2); }'
    const refs = [...broken.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)].map(m => m[1])
    expect(refs).toEqual(['--space-2'])
    expect(defined.has('--space-2')).toBe(false)
  })
})
