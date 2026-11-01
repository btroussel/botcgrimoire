// Bundled reference content. Ability text and reminders carry no executable rules.
export type CharacterId = string & { readonly __brand: 'CharacterId' }
export type Team = 'townsfolk' | 'outsider' | 'minion' | 'demon' | 'traveller' | 'fabled' | 'loric'
export type Alignment = 'good' | 'evil'

// Every team, in the order the player sheet prints them.
export const teams: readonly Team[] = ['townsfolk', 'outsider', 'minion', 'demon', 'traveller', 'fabled', 'loric']

// The side a team plays. Fabled and Loric have none. A Traveller has no side of its own until
// the Storyteller gives one, so on its own it reads as good, the way the sheet prints it.
export const teamSide = (team: Team): Alignment | undefined =>
  team === 'minion' || team === 'demon' ? 'evil' : team === 'fabled' || team === 'loric' ? undefined : 'good'
export type TokenRef = readonly [string, string]

export interface Reminder {
  readonly name: string
  readonly count: number
  readonly global: boolean
}

export interface Character {
  readonly id: CharacterId
  readonly team: Team
  readonly edition: string
  readonly name: string
  readonly ability: string
  readonly firstNightReminder?: string
  readonly otherNightReminder?: string
  readonly setupFlag: boolean
  readonly ordinals: { readonly first?: number; readonly other?: number }
  readonly reminders: readonly Reminder[]
}

// A character a custom script defines itself, in the official schema's shape so a file written
// by another tool reads here and ours reads there. The night numbers are positions on our night
// sheets: 23.5 wakes between the entries at 23 and 24, and 0 or none does not wake.
export interface Homebrew {
  readonly id: string
  readonly name: string
  readonly team: Team
  readonly ability: string
  readonly image?: string | readonly string[] // one icon, or the schema's set of up to three
  readonly flavor?: string
  readonly firstNight?: number
  readonly firstNightReminder?: string
  readonly otherNight?: number
  readonly otherNightReminder?: string
  readonly reminders?: readonly string[]
  readonly remindersGlobal?: readonly string[]
  readonly setup?: boolean
  readonly jinxes?: readonly HomebrewJinx[] // with other characters, shown when both are on the script
  readonly special?: readonly HomebrewSpecial[] // other apps' integration features, kept, never run; a card's text is shown
  readonly edition?: string
}

export interface HomebrewJinx {
  readonly id: string // the other character
  readonly reason: string
}

export interface HomebrewSpecial {
  readonly type: string
  readonly name: string
  readonly value?: string | number
  readonly time?: string
  readonly global?: string
}

export interface Edition {
  readonly id: string
  readonly name: string
  readonly description?: string
}

export interface Jinx {
  readonly a: CharacterId
  readonly b: CharacterId
  readonly reason: string
}
