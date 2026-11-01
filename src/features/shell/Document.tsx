import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html'
import { cloneElement } from 'react'
import type { PropsWithChildren } from 'react'

import { t as translate } from '../../content'
import type { Translate } from '../../content'
import { motion } from '../../ui/theme'
import { homeOf } from './homePages'
import { pageTags } from './pageTags'

// Every control dips at once under a finger and eases back on release, a token's press scale
// included; reduced motion keeps the colour and opacity and drops the scale. :where keeps the
// rule below any transition a piece sets itself.
const release = `${motion.duration.mark}ms ${motion.css.ease}`
const pressCss = `
:where([role="button"]) {
  transition: opacity ${release}, background-color ${release}, box-shadow ${release}, border-color ${release}, transform ${release};
}
:where([role="button"]):active { transition-duration: 0ms; }
@media (prefers-reduced-motion: reduce) {
  :where([role="button"]) { transition-property: opacity, background-color, box-shadow, border-color; }
}
`
// A board menu fades out when it closes by any path, a tap outside and Escape included, which no
// script sees. It opens by script, so only the way out is here, and a closing menu takes no taps.
// A browser without discrete transitions hides it at once.
const fade = `${motion.duration.fade}ms ${motion.css.easeIn}`
const popoverCss = `
[popover] { transition: opacity ${fade}, overlay ${fade} allow-discrete, display ${fade} allow-discrete; }
[popover]:not(:popover-open) { opacity: 0; pointer-events: none; }
`

// The exported page, before the store loads: a Home reads in its own language and every other
// route in English. Every bundled language reads left to right. The page tags carry the mark Head
// puts on its own, so the navigator's Head takes them over after load instead of adding a second
// set. The context's nodes hold the bundle, its styles and the hydration flag.
export const Document = ({ children, pathname = '' }: PropsWithChildren<{ readonly pathname?: string }>) => {
  const { htmlAttributes, bodyAttributes, headNodes, bodyNodes } = useServerDocumentContext()
  const locale = homeOf(pathname) ?? 'en'
  const t: Translate = (key, values) => translate(locale, key, values)
  return (
    <html {...htmlAttributes} lang={locale} dir="ltr">
      <head>
        <meta charSet="utf-8" />
        {/* The keyboard shrinks only the visible view, so the page and the seating ring keep their size. */}
        <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, viewport-fit=cover, interactive-widget=resizes-visual" />
        <meta name="theme-color" content="#121614" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        {/* Search results show a site icon only at a multiple of 48 pixels, which the favicon is not. */}
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
        <ScrollViewStyleReset />
        {/* Edge controls must not enlarge the mobile viewport. Content scrolls inside the app.
            Manipulation stops a quick second tap on a stepper from zooming the page, while pinch
            zoom still works. A drag or long press would otherwise select headings and labels like
            a web page, so only text fields keep selection. */}
        <style>{`
          html { overflow: hidden; background: #121614; }
          body { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
          input, textarea { -webkit-user-select: text; user-select: text; -webkit-touch-callout: default; }
          * { scrollbar-width: none !important; }
          *::-webkit-scrollbar { display: none; }
          :where([role="button"], button, label, input, select, textarea, a) { touch-action: manipulation; }
        ${pressCss}${popoverCss}`}</style>
        {pageTags(pathname, t).map((tag) => cloneElement(tag, { 'data-rh': 'true' }))}
        {headNodes}
      </head>
      <body {...bodyAttributes}>{children}{bodyNodes}</body>
    </html>
  )
}
