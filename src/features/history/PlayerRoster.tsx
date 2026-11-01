import type { CharacterId, Locale, Translate } from '../../content'
import { gameText, isEmptySeat } from '../../content'
import type { Grimoire, Seat, SeatId } from '../../engine'
import { isNote } from '../../engine'
import type { PlayerStory } from '../../store/chronicle'
import { CharacterIcon } from '../../ui/CharacterIcon'
import { Icon } from '../../ui/icons'
import { palette } from '../../ui/theme'
import { Token } from '../../ui/Token'
import { playersOn } from './players'

interface Props {
  readonly seats: Grimoire['seats']
  readonly bluffs: readonly CharacterId[]
  readonly loose: readonly CharacterId[]
  readonly stories: ReadonlyMap<SeatId, PlayerStory>
  readonly locale: Locale
  readonly t: Translate
}

// The reminders and notes still on the seat when the game was left, as the grimoire shows them:
// a Drunk sits as the Townsfolk they believe in, under Is The Drunk.
const SeatTokens = ({ seat, locale, t }: { readonly seat: Seat; readonly locale: Locale; readonly t: Translate }) => {
  const text = gameText(locale)
  if (seat.tokens.length === 0) return null
  return (
    <ul className="history-reminders" aria-label={t('scripts.characterReminders')}>
      {seat.tokens.map(({ def: [id, name], note, placedBy }) => {
        if (isNote([id, name], note)) {
          return (
            <li key={placedBy} className="history-reminder history-note">
              <Icon name="edit" size={14} color={palette.inkMuted} />
              <span>{note}</span>
            </li>
          )
        }
        const reminder = note ? `${text.reminder(name)}: ${note}` : text.reminder(name)
        const label = `${reminder}, ${text.role(id as CharacterId).name}`
        return (
          <li key={placedBy} className="history-reminder" aria-label={label} title={label}>
            <CharacterIcon id={id} size={18} />
            <span>{reminder}</span>
          </li>
        )
      })}
    </ul>
  )
}

export const PlayerRoster = ({ seats, bluffs, loose, stories, locale, t }: Props) => {
  const text = gameText(locale)
  const sides = (['good', 'evil'] as const).map((alignment) => ({
    alignment,
    players: playersOn(seats, alignment),
  }))
  const splitGood = sides.some(({ alignment, players }) => alignment === 'good' && players.length >= 5)
  const characterName = (id: CharacterId) => (isEmptySeat(id) ? t('common.unknown') : text.role(id).name)
  const died = (story: PlayerStory | undefined) => {
    const when = story?.died
    if (when?.phase !== 'night' && when?.phase !== 'day') return t('board.dead')
    return `${t('board.dead')} · ${t(`board.${when.phase}`, { n: when.night })}`
  }

  return (
    <div className="history-roster" data-split-good={splitGood}>
      {sides.map(({ alignment, players }) => (
        <section key={alignment} className="history-side" aria-label={t(`board.${alignment}`)}>
          <h3 className="history-side-title" style={{ color: alignment === 'good' ? palette.goodOnPaper : palette.evilOnPaper }}>
            {t(`board.${alignment}`)}
          </h3>
          {players.length === 0 ? <p className="history-muted">{t('history.noAlignmentPlayers')}</p> : (
            <ul className="history-players">
              {players.map((seat) => {
                const story = stories.get(seat.id)
                const lifeColor = seat.alive ? palette.aliveOnPaper : palette.deadOnPaper
                return (
                  <li key={seat.id} className="history-player">
                    <div aria-hidden="true">
                      <Token {...(isEmptySeat(seat.character) ? {} : { character: seat.character })} size={44} alignment={seat.alignment} dead={!seat.alive} />
                    </div>
                    <div className="history-player-text">
                      <span className="history-player-name">{seat.name}</span>
                      <span className="history-character-name">{characterName(seat.character)}</span>
                      <span className="history-life" style={{ color: lifeColor }}>
                        <span className="history-life-dot" aria-hidden="true" />
                        {seat.alive ? t('board.alive') : died(story)}
                      </span>
                      {seat.shown ? <span className="history-player-fact">{t('history.believes', { character: characterName(seat.shown) })}</span> : null}
                      {story?.startedAs ? <span className="history-player-fact">{t('history.startedAs', { character: characterName(story.startedAs) })}</span> : null}
                      {story?.startedOn ? <span className="history-player-fact">{t(story.startedOn === 'good' ? 'history.startedGood' : 'history.startedEvil')}</span> : null}
                    </div>
                    <SeatTokens seat={seat} locale={locale} t={t} />
                  </li>
                )
              })}
            </ul>
          )}
          {alignment === 'evil' ? (
            <div className="history-bluffs">
              <h4 className="history-bluffs-title">{t('board.bluffsTitle')}</h4>
              {bluffs.length > 0 ? (
                <ul className="history-bluff-tokens">
                  {bluffs.map((id, index) => (
                    <li key={`${id}-${index}`} className="history-bluff">
                      <div aria-hidden="true"><Token character={id} size={48} alignment="good" /></div>
                      <span>{text.role(id).name}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="history-muted">{t('history.noBluffs')}</p>}
            </div>
          ) : null}
        </section>
      ))}
      {loose.length > 0 ? (
        <section className="history-loose" aria-label={t('board.looseTitle')}>
          <h4 className="history-bluffs-title">{t('board.looseTitle')}</h4>
          <ul className="history-bluff-tokens">
            {loose.map((id) => (
              <li key={id} className="history-bluff">
                <div aria-hidden="true"><Token character={id} size={48} /></div>
                <span>{text.role(id).name}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
