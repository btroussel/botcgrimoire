import type { ReactNode } from 'react'

import { focusRing, motion, palette, radius } from './theme'

// The official shop, where the support copy sends players for a physical Grimoire.
export const shop = 'https://bloodontheclocktower.com/pages/buy'

// The links sit inside their sentences, so each language places them where its grammar wants.
export const withLink = (sentence: string, link: ReactNode) => {
  const [before, after] = sentence.split('{link}')
  return <>{before}{link}{after}</>
}

type TextLinkProps = {
  readonly surface: 'paper' | 'felt'
  readonly children: ReactNode
} & ({ readonly href: string; readonly external?: boolean } | { readonly onPress: () => void })

// An underlined phrase in the ink of the surface it sits on; the underline turns brass on hover.
// Given onPress instead of href, it is a button that looks the same, for an action that sits in a
// line of links and goes nowhere, such as copying an address.
export const TextLink = (props: TextLinkProps) => {
  const className = `grimoire-link grimoire-link-${props.surface}`
  return (
    <>
      <style href="grimoire-text-link" precedence="default">{css}</style>
      {'onPress' in props ? (
        <button type="button" className={`${className} grimoire-link-button`} onClick={props.onPress}>{props.children}</button>
      ) : (
        <a href={props.href} className={className} target={props.external ? '_blank' : undefined} rel={props.external ? 'noopener noreferrer' : undefined}>
          {props.children}
        </a>
      )}
    </>
  )
}

const css = `
  .grimoire-link { text-underline-offset: 3px; overflow-wrap: anywhere; transition: text-decoration-color ${motion.duration.mark}ms ${motion.css.ease}; }
  .grimoire-link-button { appearance: none; background: none; border: 0; padding: 0; margin: 0; font: inherit; text-align: inherit; text-decoration-line: underline; cursor: pointer; }
  .grimoire-link:hover { text-decoration-color: ${palette.accent}; }
  .grimoire-link:focus-visible { outline: ${focusRing.width}px solid; outline-offset: ${focusRing.offset}px; border-radius: ${radius.chipLabel}px; }
  .grimoire-link-paper { color: ${palette.ink}; text-decoration-color: ${palette.inkMuted}; }
  .grimoire-link-felt { color: ${palette.text}; text-decoration-color: ${palette.muted}; }
  @media (prefers-reduced-motion: reduce) { .grimoire-link { transition: none; } }
`
