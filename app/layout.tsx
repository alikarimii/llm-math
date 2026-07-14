import 'katex/dist/katex.min.css'
import './globals.css'
import type { ReactNode } from 'react'
import { Newsreader, IBM_Plex_Mono } from 'next/font/google'

/**
 * Both faces are self-hosted at build time by next/font, which is what makes
 * them compatible with `output: 'export'`: the font files are emitted into the
 * static bundle and referenced from our own origin. No CDN request, no
 * render-blocking stylesheet from a third party, nothing for a CSP to forbid.
 *
 * Newsreader carries the prose and the display type. It was chosen because the
 * page is half mathematics: KaTeX sets its notation in Computer Modern, and a
 * transitional serif with open counters and a tall x-height sits beside Computer
 * Modern without either face looking like a guest.
 *
 * IBM Plex Mono carries every number, label, eyebrow and form control — the
 * drafting-table voice. `tabular-nums` (applied in globals.css) is the part that
 * matters most: it is what makes a column of numbers a column.
 */
const newsreader = Newsreader({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-newsreader',
  axes: ['opsz'],
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-plex-mono',
  weight: ['400', '500', '600'],
})

export const metadata = {
  title: 'The Math Behind LLMs',
  description: 'An interactive, step-by-step look at the mathematics of large language models.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${newsreader.variable} ${plexMono.variable}`}>
      <body>
        {/* The shell is what gives every page a measure and a centre; without it
            prose runs the full width of whatever monitor it lands on. */}
        <div className="shell">{children}</div>
      </body>
    </html>
  )
}
