import { readFileSync } from 'node:fs'

import { t } from '../../content'
import type { Device } from './feedback'
import { bugReport, feedbackMail, shortVersion } from './feedback'

const phone: Device = { version: '64d1dcc', locale: 'fr', installed: true, width: 390, height: 844, browser: 'Mozilla/5.0 (iPhone)' }
const fr = (key: string, values?: Parameters<typeof t>[2]) => t('fr', key, values)
const en = (key: string, values?: Parameters<typeof t>[2]) => t('en', key, values)

const mail = (link: string) => {
  const url = new URL(link)
  return { to: url.pathname, subject: url.searchParams.get('subject'), body: url.searchParams.get('body') ?? '' }
}

describe('feedback', () => {
  test('the email leaves room to write on top and lists the device below, in the app language', () => {
    const { to, subject, body } = mail(feedbackMail(fr, phone))
    expect(to).toBe('contact@botcgrimoire.com')
    expect(subject).toBe('Retour sur Grimoire BotC')
    const lines = body.split('\r\n')
    expect(lines.slice(0, 4)).toEqual(['', '', '', '-- '])
    expect(lines.slice(4)).toEqual([
      'Ces informations nous aident à trouver le problème :',
      "Version de l'appli : 64d1dcc",
      'Langue : fr',
      'Écran : 390 x 844',
      'Ouverte comme appli installée',
      'Navigateur : Mozilla/5.0 (iPhone)',
    ])
  })

  test('a page no worker controls yet says the version is unknown', () => {
    const { version: _, ...tab } = phone
    const { body } = mail(feedbackMail(en, { ...tab, installed: false }))
    expect(body).toContain('App version: Unknown')
    expect(body).toContain('Opened in a browser tab')
  })

  test('the bug form link fills the fields bug_report.yml names', () => {
    const fields = new URL(bugReport(phone, 'Français')).searchParams
    expect(Object.fromEntries(fields)).toEqual({
      template: 'bug_report.yml',
      version: '64d1dcc',
      device: 'Installed app, 390 x 844, Mozilla/5.0 (iPhone)',
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
