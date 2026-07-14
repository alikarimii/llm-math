import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')

/**
 * Guards the mechanism prefers-reduced-motion relies on (see the `!important`
 * override in app/globals.css): every figure animates ONLY via a CSS
 * `transition` set through an inline style, because an inline `transition` is
 * the one thing that override can suppress without threading a `reducedMotion`
 * prop through every figure and compromising their purity.
 *
 * Nothing in the type system stops a future figure from reaching for
 * `@keyframes`, a CSS `animation` property, an imperative `.animate()` call, or
 * a `requestAnimationFrame` loop instead — none of which the global override
 * catches, silently breaking reduced-motion support for that figure. Whether a
 * figure uses the sanctioned mechanism is a property of its SOURCE, not of any
 * particular render, so it is asserted by scanning source files directly rather
 * than by rendering and inspecting computed styles.
 *
 * Three things this scan is deliberate about:
 *
 *  - It reaches every source that draws a figure, including app/attention,
 *    where AttentionFigure and Playground render figures and so can escape the
 *    switch exactly as easily as the primitives in components/figures can.
 *  - It catches the escape hatches React's inline styles open up. A style
 *    object is JS, not CSS, so the property is spelled `animationName` or
 *    `WebkitAnimation`, and a pattern anchored on `animation:` sails straight
 *    past it.
 *  - It matches against source with comments stripped. The point is what the
 *    code DOES; a doc comment that discusses `animation:` — like this one —
 *    must not fail the build.
 */
const FORBIDDEN: Array<{ name: string; pattern: RegExp; why: string }> = [
  {
    name: 'a CSS `animation` property (in any spelling: `animation:`, `animationName:`, `WebkitAnimation:`)',
    pattern: /\b[A-Za-z]*animation[A-Za-z]*\s*:/i,
    why: 'the global override suppresses transition-duration and animation-duration, but a figure driven by a keyframe animation has no transition to suppress; use an inline `transition` instead',
  },
  {
    name: 'an `@keyframes` rule',
    pattern: /@keyframes/,
    why: 'keyframes run independently of the transition switch',
  },
  {
    name: 'an imperative `.animate(` call (Web Animations API)',
    pattern: /\.animate\s*\(/,
    why: 'WAAPI animations are invisible to CSS and to the reduced-motion override',
  },
  {
    name: 'a `requestAnimationFrame` animation loop',
    pattern: /\brequestAnimationFrame\b/,
    why: 'a rAF loop animates in JS, ignoring both the transition switch and the reader\'s reduced-motion preference; figures must stay pure functions of the progress they are handed',
  },
]

/**
 * The one sanctioned `requestAnimationFrame` in the lesson stack, named rather
 * than pattern-matched so that adding a second one anywhere is a build failure
 * that has to be argued for.
 *
 * useProgress does not animate anything. Its rAF batches the layout READS
 * behind a scroll listener into one per frame; it produces a number, and the
 * figures that consume that number remain pure functions of it, animating (if
 * at all) through the inline transitions this test enforces. Reduced-motion
 * readers must keep receiving real scroll positions — freezing the figure would
 * desync it from the prose they are scrolling through — so this rAF is exactly
 * what should survive the preference, and does.
 */
const EXEMPT = ['components/lesson/useProgress.ts']

/** Source files that render, or feed, the lesson's figures. */
const SCAN_DIRS = ['components/figures', 'components/lesson', 'app/attention']

const sourcesIn = (dir: string): string[] =>
  readdirSync(join(root, dir), { withFileTypes: true }).flatMap(entry => {
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) return sourcesIn(rel) // recurse: figures may be nested
    if (!/\.tsx?$/.test(entry.name)) return []
    if (/\.test\.tsx?$/.test(entry.name)) return [] // tests may say anything
    if (entry.name === 'test-utils.tsx') return []
    return [rel]
  })

const sources = SCAN_DIRS.flatMap(sourcesIn).sort()

/** Strips block and line comments, so prose about animation cannot fail a build. */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

describe('figures only animate via the central CSS transition switch', () => {
  // A scan that silently matches nothing is worse than no scan: it reports
  // green forever. Pin the files that must be in it by name.
  it('scans every source that draws a figure (test is not vacuous)', () => {
    expect(sources).toEqual(
      expect.arrayContaining([
        'components/figures/AttentionGrid.tsx',
        'components/figures/Matrix.tsx',
        'components/figures/MatMul.tsx',
        'components/figures/SoftmaxRow.tsx',
        'components/figures/Vector.tsx',
        'components/lesson/ScrollStage.tsx',
        // The files the old, non-recursive `components/figures/*.tsx` scan
        // never looked at, though both render figures:
        'app/attention/AttentionFigure.tsx',
        'app/attention/Playground.tsx',
      ])
    )
  })

  it.each(sources)('%s does not escape the reduced-motion switch', file => {
    const src = stripComments(readFileSync(join(root, file), 'utf8'))
    for (const { name, pattern, why } of FORBIDDEN) {
      if (pattern.source.includes('requestAnimationFrame') && EXEMPT.includes(file)) continue
      expect(src, `${file} appears to use ${name} — ${why}`).not.toMatch(pattern)
    }
  })

  it('still animates: the figures do use the sanctioned inline transition', () => {
    // The complement of the rule. If a refactor moved every figure's animation
    // into a stylesheet, the FORBIDDEN scan above would go green while
    // reduced-motion support quietly died with it.
    const animated = sources.filter(f =>
      /\btransition\s*:/.test(stripComments(readFileSync(join(root, f), 'utf8')))
    )
    expect(animated.length).toBeGreaterThan(0)
  })

  it('keeps the rAF exemption honest: the exempt file exists and is scanned', () => {
    // If useProgress is renamed or deleted, this fails rather than leaving a
    // dead exemption that would silently excuse some future file.
    for (const file of EXEMPT) {
      expect(sources, `${file} is exempt but no longer scanned`).toContain(file)
      expect(readFileSync(join(root, file), 'utf8')).toContain('requestAnimationFrame')
    }
  })

  it('does not trip on comments that merely discuss animation', () => {
    // The brittleness this replaces: a doc comment containing "animation:" used
    // to fail the build.
    const commentary = `
      /** Suppresses animation: see globals.css. Never call .animate( here. */
      // requestAnimationFrame is not used; @keyframes neither.
      export const x = { transition: 'opacity 180ms' }
    `
    const stripped = stripComments(commentary)
    for (const { pattern } of FORBIDDEN) expect(stripped).not.toMatch(pattern)
  })

  it('catches the escapes it exists to catch', () => {
    // Proof the patterns work, so a green run means something.
    const violations = [
      `<div style={{ animation: 'pulse 1s' }} />`,
      `<div style={{ animationName: 'pulse' }} />`,
      `<div style={{ animationDuration: '1s' }} />`,
      `<div style={{ WebkitAnimation: 'pulse 1s' }} />`,
      `const css = '@keyframes pulse { from { opacity: 0 } }'`,
      `ref.current.animate([{ opacity: 0 }], 200)`,
      `const loop = () => requestAnimationFrame(loop)`,
    ]
    for (const src of violations) {
      expect(
        FORBIDDEN.some(({ pattern }) => pattern.test(src)),
        `${src} should be caught`
      ).toBe(true)
    }
  })
})
