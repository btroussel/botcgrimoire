import { memo } from 'react'
import { Image } from 'react-native'

import type { Translate } from '../../content'
import type { SavedGame } from '../../store'
import type { GameRow } from '../../store/gameSummary'
import { Icon } from '../../ui/icons'
import { listedLogo } from '../../ui/ScriptListRow'
import { palette } from '../../ui/theme'

interface Props {
  readonly game: SavedGame
  readonly row: GameRow
  readonly t: Translate
  readonly busy: boolean // this game is being opened
  readonly failed: boolean // the last attempt to open this game failed
  // The handlers take the game, so the screen passes the same ones to every row and a row whose
  // game did not change skips the render when the board behind it records an edit.
  readonly onOpen: (id: SavedGame['id']) => void
  readonly onLaunch: (game: SavedGame, replay: boolean) => void
}

export const rowId = (id: string) => `history-row-${id}`
export const gamePath = (id: string) => `/history/${id}`

// A game in the list: a link to its page and, beside it, the one thing it is most opened for,
// Resume while it runs and Replay once it is over. Two controls side by side, never a button
// inside the link. The names tell two nights of the same script apart.
export const GameHistoryRow = memo(function GameHistoryRow({ game, row, t, busy, failed, onOpen, onLaunch }: Props) {
  const resume = !row.over
  const launch = t(resume ? 'history.resumeGame' : 'history.replayGame', { name: row.name })
  const winnerColor = row.winner === 'good' ? palette.goodOnPaper : row.winner === 'evil' ? palette.evilOnPaper : undefined

  return (
    <li id={rowId(game.id)} className="history-row">
      <a className="history-row-link" href={gamePath(game.id)} aria-label={row.a11y}
        onClick={(event) => {
          // A modified click keeps the browser's own meaning, a new tab for one.
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
          event.preventDefault()
          onOpen(game.id)
        }}>
        <Image source={listedLogo(game.script)} style={{ width: 40, height: 44 }} resizeMode="contain" accessible={false} />
        <span className="history-row-text">
          <span className="history-row-title">{row.name}</span>
          <span className="history-row-line">
            <span className="history-row-state" data-progress={winnerColor === undefined} style={winnerColor ? { color: winnerColor } : undefined}>{row.phase}</span>
            <span className="history-row-when">{row.day} · {row.duration}</span>
          </span>
          <span className="history-row-names">{row.players} · {row.names}</span>
        </span>
      </a>
      {resume || game.log.length > 0 ? (
        <button type="button" className="history-launch" data-primary={resume} disabled={busy} aria-label={launch} title={launch}
          onClick={() => onLaunch(game, !resume)}>
          <Icon name={resume ? 'play' : 'history'} size={20} color={resume ? palette.parchment : palette.ink} />
        </button>
      ) : null}
      {failed ? <p role="alert" className="history-failed">{t('history.openFailed')}</p> : null}
    </li>
  )
})
