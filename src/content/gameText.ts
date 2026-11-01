// Game text in the chosen language: character names, abilities, reminders and edition blurbs
// from upstream's translations, English filled in wherever the translation is missing.
import { englishNightText } from './generated/nightText'
import { homebrew } from './homebrew'
import { t, type Locale } from './i18n'
import { editions } from './scripts'
import type { CharacterId } from './types'
import { rawJinxes, rawRoles, rawTranslations } from './upstream'

// Upstream keys a translated reminder by its name lowercased with everything but letters and
// digits removed, so "Red Herring" is "redherring".
const reminderKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '')

const english = new Map(rawRoles.map((r) => [r.id, r]))

// Upstream keys a translated jinx by its two ids joined with a hyphen, in either order.
const englishJinx = (a: string, b: string) => rawJinxes.find((row) => row.id === a)?.jinx.find((j) => j.id === b)?.reason ?? ''

export const gameText = (locale: Locale) => {
  const tr = rawTranslations[locale]
  return {
    nightMarker: (id: string, phase: 'first' | 'other') => {
      const key = id.toLowerCase()
      if (phase === 'first' && (key === 'minioninfo' || key === 'demoninfo')) {
        return t(locale, `night.instruction${key}`)
      }
      return tr?.roles[key]?.[phase] ?? englishNightText[key]?.[phase] ?? ''
    },
    role: (id: CharacterId) => {
      const en = english.get(id)
      // A homebrew character is written in one language, its author's.
      const own = en ? undefined : homebrew(id)
      if (own) {
        return {
          name: own.name,
          ability: own.ability,
          firstNight: own.firstNightReminder ?? '',
          otherNight: own.otherNightReminder ?? '',
        }
      }
      const tx = tr?.roles[id]
      return {
        name: tx?.name ?? en?.name ?? id,
        ability: tx?.ability ?? en?.ability ?? '',
        firstNight: tx?.first ?? en?.firstNightReminder ?? '',
        otherNight: tx?.other ?? en?.otherNightReminder ?? '',
      }
    },
    reminder: (name: string) => tr?.reminders[reminderKey(name)] ?? name,
    jinx: (a: CharacterId, b: CharacterId) => tr?.jinxes[`${a}-${b}`] ?? tr?.jinxes[`${b}-${a}`] ?? englishJinx(a, b),
    edition: (id: string) => {
      const en = editions.find((e) => e.id === id)
      const tx = tr?.editions[id]
      return { name: tx?.name ?? en?.name ?? id, description: tx?.description ?? en?.description ?? '' }
    },
  }
}
