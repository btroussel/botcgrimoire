import { readFileSync } from 'node:fs'

import { t } from '../../content'
import type { Device } from './feedback'
import { browserName, bugReport, feedbackMail, shortVersion } from './feedback'

const phone: Device = { version: '64d1dcc', locale: 'fr', installed: true, width: 390, height: 844, browser: 'Safari 18, iOS' }
const fr = (key: string, values?: Parameters<typeof t>[2]) => t('fr', key, values)
const en = (key: string, values?: Parameters<typeof t>[2]) => t('en', key, values)

const mail = (link: string) => {
  const url = new URL(link)
  return { to: url.pathname, subject: url.searchParams.get('subject'), body: url.searchParams.get('body') ?? '' }
}

describe('feedback', () => {
  test('the email leaves room to write on top and puts the device on one line below, in the app language', () => {
    const { to, subject, body } = mail(feedbackMail(fr, phone))
    expect(to).toBe('contact@botcgrimoire.com')
    expect(subject).toBe('Retour sur Grimoire BotC')
    expect(body.split('\r\n')).toEqual(['', '', '', '-- ', 'Version 64d1dcc · fr · Safari 18, iOS · 390×844 · appli installée'])
  })

  test('a tab no worker controls yet leaves out the version and says nothing of installation', () => {
    const { version: _, ...tab } = phone
    const { body } = mail(feedbackMail(en, { ...tab, locale: 'en', installed: false }))
    expect(body.split('\r\n').at(-1)).toBe('en · Safari 18, iOS · 390×844')
  })

  test('the browser is named with its major version and system', () => {
    const agents: Record<string, string> = {
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36': 'Chrome 157, macOS',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1': 'Safari 18, iOS',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.7339.122 Mobile/15E148 Safari/604.1': 'Chrome 140, iOS',
      'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36': 'Samsung Internet 28, Android',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0': 'Edge 140, Windows',
      'Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0': 'Firefox 143, Linux',
      'SomethingNew/1.0': 'SomethingNew/1.0',
    }
    for (const [agent, name] of Object.entries(agents)) expect(browserName(agent)).toBe(name)
  })

  test('the bug form link fills the fields bug_report.yml names', () => {
    const fields = new URL(bugReport(phone, 'Français')).searchParams
    expect(Object.fromEntries(fields)).toEqual({
      template: 'bug_report.yml',
      version: '64d1dcc',
      device: 'Installed app, 390 x 844, Safari 18, iOS',
      language: 'Français',
    })
    const form = readFileSync(new URL('../../../.github/ISSUE_TEMPLATE/bug_report.yml', import.meta.url), 'utf8')
    for (const id of ['version', 'device', 'language']) expect(form).toMatch(new RegExp(`^    id: ${id}$`, 'm'))
    // Before the page is live it is the plain form, as the export drew it.
    expect(bugReport()).toBe('https://github.com/btroussel/botcgrimoire/issues/new?template=bug_report.yml')
  })

  test('the version is the first seven characters of the build the worker names', () => {
    expect(shortVersion('botc-grimoire-64d1dcc36328166d3161')).toBe('64d1dcc')
    expect(shortVersion('botc-grimoire-v2')).toBe('v2')
    expect(shortVersion('botc-grimoire-')).toBeUndefined()
    expect(shortVersion('another-cache')).toBeUndefined()
  })
})
