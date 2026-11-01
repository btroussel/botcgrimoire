import type { ReactNode } from 'react'

import { focusRing, motion, palette, radius } from './theme'

// The official shop, where the support copy sends players for a physical Grimoire.
export const shop = 'https://bloodontheclocktower.com/pages/buy'

// The links sit inside their sentences, so each language places them where its grammar wants.
export const withLink = (sentence: string, link: ReactNode) => {
  const [before, after] = sentence.split('{link}')
  return <>{before}{link}{after}</>
}

interface TextLinkProps {
  readonly href: string
  readonly external?: boolean
  readonly surface: 'paper' | 'felt'
  readonly children: ReactNode
}

// An underlined phrase in the ink of the surface it sits on; the underline turns brass on hover.
export const TextLink = ({ href, external, surface, children }: TextLinkProps) => (
  <>
    <style href="grimoire-text-link" precedence="default">{css}</style>
    <a href={href} className={`grimoire-link grimoire-link-${surface}`} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>
      {children}
    </a>
  </>
)

const css = `
  .grimoire-link { text-underline-offset: 3px; overflow-wrap: anywhere; transition: text-decoration-color ${motion.duration.mark}ms ${motion.css.ease}; }
  .grimoire-link:hover { text-decoration-color: ${palette.accent}; }
  .grimoire-link:focus-visible { outline: ${focusRing.width}px solid; outline-offset: ${focusRing.offset}px; border-radius: ${radius.chipLabel}px; }
  .grimoire-link-paper { color: ${palette.ink}; text-decoration-color: ${palette.inkMuted}; }
  .grimoire-link-felt { color: ${palette.text}; text-decoration-color: ${palette.muted}; }
  @media (prefers-reduced-motion: reduce) { .grimoire-link { transition: none; } }
`
