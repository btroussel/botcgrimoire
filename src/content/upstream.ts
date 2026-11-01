// The only hand-written app file that reads the raw upstream dumps. It gives them types and
// nothing else; the join in index.ts is where they meet our records. The translations arrive
// through the generated locale registry. English stays out of the bundle: tools/build-content.mjs
// reads en.json at generation time for the night sheet's marker text.
import rolesJson from '../../assets/data/raw/release/roles.json'
import nightsheetJson from '../../assets/data/raw/release/nightsheet.json'
import jinxesJson from '../../assets/data/raw/release/jinxes.json'
import pin from '../../assets/upstream.json'
import { gameTranslations } from './generated/locales'
import type { Team } from './types'

export interface RawRole {
  readonly id: string
  readonly name: string
  readonly team: Team
  readonly edition: string
  readonly ability: string
  readonly firstNightReminder?: string
  readonly otherNightReminder?: string
  readonly reminders: readonly string[]
  readonly remindersGlobal?: readonly string[]
  readonly setup: boolean
}

export interface RawJinx {
  readonly id: string
  readonly jinx: readonly { readonly id: string; readonly reason: string }[]
}

// One language of game text. Every map is partial: the join falls back to English.
export interface RawTranslation {
  readonly roles: Readonly<
    Record<
      string,
      {
        readonly name?: string
        readonly ability?: string
        readonly first?: string
        readonly other?: string
      }
    >
  >
  readonly editions: Readonly<Record<string, { readonly name?: string; readonly description?: string }>>
  readonly reminders: Readonly<Record<string, string>>
  readonly jinxes: Readonly<Record<string, string>>
}

export const rawRoles = rolesJson as readonly RawRole[]
export const rawNightsheet = nightsheetJson as {
  readonly firstNight: readonly string[]
  readonly otherNight: readonly string[]
}
export const rawJinxes = jinxesJson as readonly RawJinx[]
export const rawTranslations: Readonly<Record<string, RawTranslation>> = gameTranslations

// The upstream commits the bundled content came from, saved with every game (docs/store.md).
export const contentPin = {
  release: pin['botc-release'].revision,
  translations: pin['botc-translations'].revision,
} as const
