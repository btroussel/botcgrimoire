// A page's search and sharing tags. The document writes them into the static export, where search
// engines and link previews read them, and the navigator's Head keeps them in step with the chosen
// language and the board's phase after load.
import type { ReactElement } from 'react'

import { locales, t as translate } from '../../content'
import type { Translate } from '../../content'
import { homePath } from '../../ui/homePath'
import { homeOf, searchLanguage, site } from './homePages'

// Search engines show this name for the whole site, from the root's structured data.
const siteData = JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebSite', name: translate('en', 'common.appName'), url: `${site}/` })

// Head takes only plain tags, so this is a list rather than a component. A board in play titles
// the document with its phase.
export const pageTags = (pathname: string, t: Translate, phase?: string): ReactElement<Record<string, unknown>>[] => {
  // Each language's Home is a search entry; every other route is a working screen.
  const page = homeOf(pathname)
  const home = page !== undefined
  const app = t('common.appName')
  const searchTitle = `${app} | ${t('common.tagline')}`
  const title = phase !== undefined ? t('common.documentTitle', { phase, app }) : home ? searchTitle : app
  const description = t('common.seoDescription')
  const url = site + homePath(page ?? 'en')
  return [
    <title key="title">{title}</title>,
    <meta key="description" name="description" content={description} />,
    <meta key="robots" name="robots" content={home ? 'index, follow' : 'noindex, follow'} />,
    ...(home ? [
      <link key="canonical" rel="canonical" href={url} />,
      // Every Home names each language's Home, its own included, and the root for any other.
      ...locales.map((l) => <link key={`alternate-${l}`} rel="alternate" hrefLang={searchLanguage(l)} href={site + homePath(l)} />),
      <link key="alternate-default" rel="alternate" hrefLang="x-default" href={`${site}/`} />,
    ] : []),
    ...(page === 'en' ? [<script key="site" type="application/ld+json">{siteData}</script>] : []),
    <meta key="og:type" property="og:type" content="website" />,
    <meta key="og:site_name" property="og:site_name" content={app} />,
    <meta key="og:title" property="og:title" content={searchTitle} />,
    <meta key="og:description" property="og:description" content={description} />,
    <meta key="og:url" property="og:url" content={url} />,
    // A board in play, at the size link previews draw large.
    <meta key="og:image" property="og:image" content={`${site}/share.jpg`} />,
    <meta key="og:image:width" property="og:image:width" content="1200" />,
    <meta key="og:image:height" property="og:image:height" content="630" />,
    <meta key="og:image:alt" property="og:image:alt" content={app} />,
    <meta key="twitter:card" name="twitter:card" content="summary_large_image" />,
    <meta key="twitter:title" name="twitter:title" content={searchTitle} />,
    <meta key="twitter:description" name="twitter:description" content={description} />,
    <meta key="twitter:image" name="twitter:image" content={`${site}/share.jpg`} />,
    <meta key="twitter:image:alt" name="twitter:image:alt" content={app} />,
  ]
}
