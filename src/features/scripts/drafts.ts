// The editors' unsaved work, kept on the device as it changes (docs/app.md, Scripts), so a
// reload, an automatic update, the browser's Back or a closed tab never loses it. Each editor
// keeps its own: the script composer its draft, the character editor its own, and the screen
// reopens whichever it finds. A record is read back through a shape check, since it may have
// been written by an older version of the app.
import { useEffect, useRef } from 'react'

import type { Homebrew } from '../../content'
import { getDraft, putDraft } from '../../store'
import type { CharacterDraft } from './character'
import type { Draft } from './compose'

export interface KeptScript {
  readonly draft: Draft
  readonly initial: Draft // what it opened as, so Back still asks before discarding
}

export interface KeptCharacter {
  readonly draft: CharacterDraft
  readonly initial?: Homebrew // the saved character being edited
}

export interface Kept {
  readonly script?: KeptScript
  readonly character?: KeptCharacter
}

// A failed write leaves the previous record, and the editor keeps working either way.
export const keepScript = (kept: KeptScript | undefined) => void putDraft('script', kept).catch(() => {})
export const keepCharacter = (kept: KeptCharacter | undefined) => void putDraft('character', kept).catch(() => {})

// Keeps an editor's record while it differs from what it opened as, and clears it once it no
// longer does. An editor that opens unchanged leaves the slot alone, so it never wipes a record
// the screen has not reopened yet.
export const useKept = <T>(keep: (kept: T | undefined) => void, kept: T | undefined) => {
  const holding = useRef(false)
  useEffect(() => {
    if (kept !== undefined) keep(kept)
    else if (holding.current) keep(undefined)
    holding.current = kept !== undefined
  }, [keep, kept])
}

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isStrings = (value: unknown) => Array.isArray(value) && value.every((item) => typeof item === 'string')
const isOptional = (value: unknown, check: (value: unknown) => boolean) => value === undefined || check(value)
const isString = (value: unknown) => typeof value === 'string'
const isNight = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
const isHomebrew = (value: unknown) => isObject(value) && isString(value.id) && isString(value.name) && isString(value.team)

const isDraft = (value: unknown): value is Draft =>
  isObject(value) && isString(value.name) && isString(value.author) && isStrings(value.ids)
  && isOptional(value.id, isString) && isOptional(value.logo, isString)
  && isOptional(value.kept, isObject) && isOptional(value.rules, isStrings)
  && isOptional(value.homebrew, (list) => Array.isArray(list) && list.every(isHomebrew))

const isCharacterDraft = (value: unknown): value is CharacterDraft =>
  isObject(value) && isString(value.name) && isString(value.team) && isString(value.ability)
  && isOptional(value.image, (image) => isString(image) || isStrings(image)) && isStrings(value.reminders)
  && isOptional(value.firstNight, isNight) && isString(value.firstNightReminder)
  && isOptional(value.otherNight, isNight) && isString(value.otherNightReminder) && typeof value.setup === 'boolean'

const scriptOf = (value: unknown): KeptScript | undefined =>
  isObject(value) && isDraft(value.draft) && isDraft(value.initial) ? { draft: value.draft, initial: value.initial } : undefined

const characterOf = (value: unknown): KeptCharacter | undefined =>
  isObject(value) && isCharacterDraft(value.draft) && isOptional(value.initial, isHomebrew)
    ? { draft: value.draft, ...(value.initial ? { initial: value.initial as Homebrew } : {}) }
    : undefined

// Storage that cannot be read, as in some private windows, has nothing to give back.
export const readKept = async (): Promise<Kept> => {
  try {
    const [rawScript, rawCharacter] = await Promise.all([getDraft('script'), getDraft('character')])
    const script = scriptOf(rawScript)
    const character = characterOf(rawCharacter)
    return { ...(script ? { script } : {}), ...(character ? { character } : {}) }
  } catch {
    return {}
  }
}
