// Saved game summaries use the complete log, independent of any replay cursor.
import type { Alignment, Locale, Script, Translate } from '../content'
import type { Clock } from '../engine'
import { isCustom, scriptName } from '../content'
import type { SavedGame } from './saved'
import { boardOf } from './session'
import { gameTiming } from './gameTiming'

export interface GameRow {
  readonly id: SavedGame['id']
  readonly name: string
  readonly logo: string // the key of the script's logo in editionArt: the edition id, or custom
  readonly winner?: Alignment
  readonly phase: string // "Night 3", "Setup", "Game over"
  readonly players: string // "9 players"
  readonly when: string // the creation date in the UI locale
  readonly duration: string
  readonly a11y: string // the row in one sentence, for a screen reader
}

// The art itself is a require() the screen resolves; this module stays loadable without a bundler.
const logoFor = (script: Script): string => (isCustom(script) ? 'custom' : script)

// "Night 2", "Day 2", "Setup", "Game over": for the history rows, the board and the tab title.
export const phaseLabel = (clock: Clock, t: Translate): string => {
  switch (clock.phase) {
    case 'setup':
      return t('board.setup')
    case 'night':
      return t('board.night', { n: clock.night })
    case 'day':
      return t('board.day', { n: clock.night })
    case 'over':
      return t('board.over')
  }
}

// A row is kept for each saved game object. The store swaps in a new object only for the game
// that changed, so every other row keeps its identity and its History card skips the render.
const described = new WeakMap<SavedGame, { readonly t: Translate; readonly locale: Locale; readonly row: GameRow }>()

export const describeGame = (game: SavedGame, t: Translate, locale: Locale): GameRow => {
  const cached = described.get(game)
  if (cached && cached.t === t && cached.locale === locale) return cached.row
  const name = scriptName(game.script)
  const board = boardOf({ game, redo: [] })
  // Older endings saved no verdict. Keep that absence rather than inventing a winner.
  const winner = board.clock.phase === 'over' ? board.result?.winner : undefined
  const phase = winner ? t(winner === 'good' ? 'board.goodWins' : 'board.evilWins') : phaseLabel(board.clock, t)
  const players = t('common.players', { count: board.seats.length })
  const { date: when, duration } = gameTiming(game, t, locale)
  const row = { id: game.id, name, logo: logoFor(game.script), ...(winner ? { winner } : {}), phase, players, when, duration,
    a11y: [name, phase, players, when, duration].join(', ') }
  described.set(game, { t, locale, row })
  return row
}
