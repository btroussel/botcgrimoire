import { memo, useMemo } from 'react'
import { Image, StyleSheet } from 'react-native'

import type { Locale, Translate } from '../../content'
import { gameText, isEmptySeat } from '../../content'
import { editionArt } from '../../content/generated/art'
import type { SavedGame } from '../../store'
import { boardOf, inLocale } from '../../store'
import { bluffsOf } from '../../store/bluffs'
import { chronicleOf } from '../../store/chronicle'
import type { GameRow } from '../../store/gameSummary'
import { Button } from '../../ui/Button'
import { CharacterIcon } from '../../ui/CharacterIcon'
import { Icon } from '../../ui/icons'
import { PaperTexture } from '../../ui/PaperTexture'
import { palette, radius, space } from '../../ui/theme'
import { GameChronicle } from './GameChronicle'
import { PlayerRoster } from './PlayerRoster'
import { playersOn } from './players'

interface Props {
  readonly game: SavedGame
  readonly row: GameRow
  readonly locale: Locale
  readonly t: Translate
  readonly expanded: boolean
  readonly busy: boolean // this game is being opened
  readonly failed: boolean // the last attempt to open this game failed
  // The handlers take the game, so the screen passes the same ones to every card and a card
  // whose game did not change skips the render when the board behind it records an edit.
  readonly onToggle: (id: SavedGame['id']) => void
  readonly onDelete: (id: SavedGame['id']) => void
  readonly onLaunch: (game: SavedGame, replay: boolean) => void
}

export const cardId = (id: string) => `history-card-${id}`

export const GameHistoryRow = memo(function GameHistoryRow({ game, row, locale, t, expanded, busy, failed, onToggle, onDelete, onLaunch }: Props) {
  const board = useMemo(() => inLocale(boardOf({ game, redo: [] }), locale), [game, locale])
  const sides = useMemo(() => (['good', 'evil'] as const).map((alignment) => ({
    alignment,
    seats: playersOn(board.seats, alignment).filter((seat) => !isEmptySeat(seat.character)),
  })), [board])
  // Replaying the log for its story waits until the card is opened.
  const chronicle = useMemo(() => (expanded ? chronicleOf(game.log, game.script) : undefined), [expanded, game.log, game.script])
  const text = gameText(locale)
  const canResume = board.clock.phase !== 'over'
  const canReplay = game.log.length > 0
  const winnerColor = row.winner === 'good' ? palette.goodOnPaper : row.winner === 'evil' ? palette.evilOnPaper : undefined
  const regionId = `history-details-${game.id}`
  const headingId = `history-heading-${game.id}`
  const summaryId = `history-summary-${game.id}`
  const phaseId = `history-phase-${game.id}`

  return (
    <article id={cardId(game.id)} className="history-card" aria-labelledby={headingId} data-expanded={expanded}>
      <PaperTexture radius={radius.tile} />
      <button type="button" className="history-summary" onClick={() => onToggle(game.id)}
        aria-label={t(expanded ? 'history.collapseDetails' : 'history.expandDetails', { name: row.name })}
        aria-describedby={`${phaseId} ${summaryId}`} aria-expanded={expanded} aria-controls={regionId}>
        <Image source={editionArt[row.logo]} style={{ width: 60, height: 68 }} resizeMode="contain" accessible={false} />
        <span className="history-heading">
          <span className="history-title-line">
            <span className="history-title" id={headingId}>{row.name}</span>
            <span id={phaseId} className="history-phase" style={winnerColor ? { color: winnerColor, backgroundColor: `${winnerColor}12` } : undefined}>
              {row.phase}
            </span>
          </span>
          <span className="history-metadata" id={summaryId}>
            <span>{row.when}</span>
            <span className="history-meta-item"><Icon name="players" size={16} color={palette.inkMuted} />{row.players}</span>
            <span className="history-meta-item"><Icon name="history" size={16} color={palette.inkMuted} />{row.duration}</span>
          </span>
        </span>
        <span className="history-chevron" aria-hidden="true"><Icon name="chevronDown" size={20} color={palette.inkMuted} /></span>
      </button>

      <div className="history-card-footer">
        {/* The open roster shows the same characters in full, so the previews step aside. */}
        <div className="history-previews" hidden={expanded}>
          {sides.filter(({ seats }) => seats.length > 0).map(({ alignment, seats }) => (
            <div key={alignment} role="list" aria-label={t(`board.${alignment}`)} className="history-preview-side">
              {seats.map((seat) => {
                const label = [seat.name, text.role(seat.character).name, ...(seat.alive ? [] : [t('board.dead')])].join(', ')
                return (
                  <div key={seat.id} role="listitem" aria-label={label} title={label} className="history-preview-token" data-dead={!seat.alive}>
                    <CharacterIcon id={seat.character} size={36} tint={seat.alignment} lazy />
                  </div>
                )
              })}
            </div>
          ))}
          {sides.every(({ seats }) => seats.length === 0) ? <span className="history-muted">{t('history.noCharacters')}</span> : null}
        </div>
        {canResume || canReplay ? (
          <div className="history-actions">
            {canReplay ? (
              <Button label={t('history.replay')} accessibilityLabel={t('history.replayGame', { name: row.name })}
                {...(canResume ? {} : { icon: 'history' as const })}
                variant={canResume ? 'secondary' : 'primary'} surface="paper" disabled={busy} onPress={() => onLaunch(game, true)} />
            ) : null}
            {canResume ? (
              <Button label={t('history.resume')} accessibilityLabel={t('history.resumeGame', { name: row.name })} icon="play"
                variant="primary" surface="paper" disabled={busy} onPress={() => onLaunch(game, false)} />
            ) : null}
          </div>
        ) : null}
        {failed ? <p role="alert" className="history-failed">{t('history.openFailed')}</p> : null}
      </div>

      <section id={regionId} aria-label={t('history.details')} hidden={!expanded} className="history-details">
        {chronicle ? (
          <>
            <PlayerRoster seats={board.seats} bluffs={bluffsOf(board, game.log)} loose={board.loose} stories={chronicle.players} locale={locale} t={t} />
            <GameChronicle chapters={chronicle.chapters} locale={locale} t={t} />
            <div className="history-details-footer">
              <Button label={t('history.delete')} accessibilityLabel={t('common.deleteGame', { name: row.name })} icon="trash"
                variant="dangerText" surface="paper" onPress={() => onDelete(game.id)} style={styles.delete} />
            </div>
          </>
        ) : null}
      </section>
    </article>
  )
})

const styles = StyleSheet.create({
  // A text button pads its label; pull it out so the word lines up with the actions above.
  delete: { marginRight: -space.lg },
})
