// Feedback goes by email, which needs no account, or to the GitHub bug form for those who have
// one. Both carry what a report needs: the build, the language and the device. The app sends
// nothing itself: the mail app or GitHub shows every word before it leaves (docs/app.md).
import { useEffect, useState } from 'react'

import type { Locale, Translate } from '../../content'

export const contactAddress = 'contact@botcgrimoire.com'
export const repository = 'https://github.com/btroussel/botcgrimoire'

// What the device says about itself when the person writes.
export interface Device {
  readonly version?: string
  readonly locale: Locale
  readonly installed: boolean
  readonly width: number
  readonly height: number
  readonly browser: string
}

// Read when the person presses, so the size is the window's at that moment. The installed app
// runs standalone; iPhone also flags a page opened from the home screen.
export const thisDevice = (locale: Locale, version: string | undefined): Device => ({
  ...(version ? { version } : {}),
  locale,
  installed: window.matchMedia('(display-mode: standalone)').matches || (navigator as { readonly standalone?: boolean }).standalone === true,
  width: window.innerWidth,
  height: window.innerHeight,
  browser: browserName(navigator.userAgent),
})

// The person reads the details before sending, so the browser is a name, a major version and a
// system rather than the whole user agent. First match wins: Edge and every iPhone browser also
// claim Chrome or Safari, and Android claims Linux. An agent none of these know stays whole.
const browsers: readonly (readonly [string, RegExp])[] = [
  ['Edge', /Edg(?:A|iOS)?\/(\d+)/],
  ['Samsung Internet', /SamsungBrowser\/(\d+)/],
  ['Firefox', /(?:Firefox|FxiOS)\/(\d+)/],
  ['Chrome', /(?:Chrome|CriOS)\/(\d+)/],
  ['Safari', /Version\/(\d+).*Safari/],
]
const systems: readonly (readonly [string, RegExp])[] = [
  ['iOS', /iPhone|iPad|iPod/],
  ['Android', /Android/],
  ['ChromeOS', /CrOS/],
  ['macOS', /Mac OS X/],
  ['Windows', /Windows/],
  ['Linux', /Linux/],
]
export const browserName = (agent: string): string => {
  const browser = browsers.map(([name, pattern]) => [name, pattern.exec(agent)?.[1]] as const).find(([, major]) => major)
  if (!browser) return agent
  const system = systems.find(([, pattern]) => pattern.test(agent))?.[0]
  return [`${browser[0]} ${browser[1]}`, system].filter(Boolean).join(', ')
}

// A mailto body breaks lines with CRLF (RFC 6068). The blank lines on top are where the message
// goes, since a mail app puts the cursor there; the details sit below a signature rule, on one
// line so they read as a footnote rather than a form. Installed is said only when it is true.
export const feedbackMail = (t: Translate, device: Device): string => {
  const details = [
    device.version ? t('common.version', { version: device.version }) : undefined,
    device.locale,
    device.browser,
    `${device.width}×${device.height}`,
    device.installed ? t('common.feedbackInstalled') : undefined,
  ].filter(Boolean).join(' · ')
  const body = ['', '', '', '-- ', details].join('\r\n')
  return `mailto:${contactAddress}?subject=${encodeURIComponent(t('common.feedbackSubject'))}&body=${encodeURIComponent(body)}`
}

// GitHub fills an issue form's fields from query parameters named by their ids, which
// .github/ISSUE_TEMPLATE/bug_report.yml sets. The form is in English, so these values are too.
export const bugReport = (device?: Device, languageName?: string): string => {
  const fields = new URLSearchParams({ template: 'bug_report.yml' })
  if (device) {
    if (device.version) fields.set('version', device.version)
    fields.set('device', `${device.installed ? 'Installed app' : 'Browser tab'}, ${device.width} x ${device.height}, ${device.browser}`)
    if (languageName) fields.set('language', languageName)
  }
  return `${repository}/issues/new?${fields}`
}

// The running build is the one its service worker precached, and the worker names it on request
// (tools/service-worker.js). Its first seven characters tell builds apart, as a short commit
// hash does. A page no worker controls yet, such as the first load or the development server,
// has no version.
const cachePrefix = 'botc-grimoire-'
export const shortVersion = (cache: string): string | undefined =>
  cache.startsWith(cachePrefix) && cache.length > cachePrefix.length ? cache.slice(cachePrefix.length, cachePrefix.length + 7) : undefined

export const useBuildVersion = (): string | undefined => {
  const [version, setVersion] = useState<string>()
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return
    const workers = navigator.serviceWorker
    const heard = (event: MessageEvent) => {
      const data: unknown = event.data
      if (typeof data !== 'object' || data === null) return
      const { type, version } = data as { readonly type?: unknown; readonly version?: unknown }
      if (type === 'UPDATE_VERSION' && typeof version === 'string') setVersion(shortVersion(version))
    }
    // The first visit's worker takes over the page once it has downloaded everything.
    const ask = () => workers.controller?.postMessage('GET_UPDATE_VERSION')
    workers.addEventListener('message', heard)
    workers.addEventListener('controllerchange', ask)
    workers.startMessages()
    ask()
    return () => {
      workers.removeEventListener('message', heard)
      workers.removeEventListener('controllerchange', ask)
    }
  }, [])
  return version
}
