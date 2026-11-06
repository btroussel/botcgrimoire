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
  browser: navigator.userAgent,
})

// A mailto body breaks lines with CRLF (RFC 6068). The blank lines on top are where the message
// goes, since a mail app puts the cursor there; the details sit below a signature rule.
export const feedbackMail = (t: Translate, device: Device): string => {
  const details = t('common.feedbackDetails', {
    version: device.version ?? t('common.unknown'),
    language: device.locale,
    screen: `${device.width} x ${device.height}`,
    opened: t(device.installed ? 'common.feedbackInstalled' : 'common.feedbackTab'),
    browser: device.browser,
  })
  const body = ['', '', '', '-- ', ...details.split('\n')].join('\r\n')
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
