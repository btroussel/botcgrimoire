import type { CharacterId, Locale, Translate } from '../../content'
import { gameText, isEmptySeat } from '../../content'
import type { EventId, Grimoire, Seat, SeatId } from '../../engine'
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
  readonly setup: ReadonlySet<EventId>
  readonly locale: Locale
  readonly t: Translate
}

// The marks dealt with the character, beside it: a Drunk sits as the Townsfolk they believe in,
// under Is The Drunk. A reminder placed in play is told by the night or day that placed it, so
// it stays out of here and a row never grows a line that reads as the next player's.
const SetupMarks = ({ seat, setup, locale, t }: { readonly seat: Seat; readonly setup: ReadonlySet<EventId>; readonly locale: Locale; readonly t: Translate }) => {
  const text = gameText(locale)
  const tokens = seat.tokens.filter((token) => setup.has(token.placedBy))
  if (tokens.length === 0) return null
  return (
    <ul className="history-reminders" aria-label={t('scripts.characterReminders')}>
      {tokens.map(({ def: [id, name], note, placedBy }) => {
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
            <CharacterIcon id={id} size={20} />
            <span>{reminder}</span>
          </li>
        )
      })}
    </ul>
  )
}

// Characters not held by a player, as small discs on one line: the Demon's bluffs, the Fabled.
const Spare = ({ title, characters, alignment, locale }: { readonly title: string; readonly characters: readonly CharacterId[]; readonly alignment?: 'good'; readonly locale: Locale }) => (
  <>
    <h3 className="history-bluffs-title">{title}</h3>
    <ul className="history-bluff-tokens">
      {characters.map((id, index) => (
        <li key={`${id}-${index}`} className="history-bluff">
          <div aria-hidden="true"><Token character={id} size={28} {...(alignment ? { alignment } : {})} /></div>
          <span>{gameText(locale).role(id).name}</span>
        </li>
      ))}
    </ul>
  </>
)

// Who played what: one row a player, the same four things in the same places. The token, the
// name, the character, and at the end of the name's line when they died. A death is a skull and
// its phase in ink, and the living carry no label, so nothing is told by red against green.
export const PlayerRoster = ({ seats, bluffs, loose, stories, setup, locale, t }: Props) => {
  const text = gameText(locale)
  const sides = (['good', 'evil'] as const).map((alignment) => ({
    alignment,
    players: playersOn(seats, alignment),
  }))
  const splitGood = sides.some(({ alignment, players }) => alignment === 'good' && players.length >= 5)
  const characterName = (id: CharacterId) => (isEmptySeat(id) ? t('common.unknown') : text.role(id).name)
  const diedIn = (story: PlayerStory | undefined) => {
    const when = story?.died
    return when?.phase === 'night' || when?.phase === 'day' ? t(`board.${when.phase}`, { n: when.night }) : undefined
  }

  return (
    <section className="history-roster" aria-label={t('history.players')}>
      <h2 className="history-section-title">{t('history.players')}</h2>
      <div className="history-sides" data-split-good={splitGood}>
        {sides.map(({ alignment, players }) => (
          <section key={alignment} className="history-side" aria-label={t(`board.${alignment}`)}>
            <h3 className="history-side-title" style={{ color: alignment === 'good' ? palette.goodOnPaper : palette.evilOnPaper }}>
              {t(`board.${alignment}`)}
              <span className="history-side-count">{players.length}</span>
            </h3>
            {players.length === 0 ? <p className="history-muted">{t('history.noAlignmentPlayers')}</p> : (
              <ul className="history-players">
                {players.map((seat) => {
                  const story = stories.get(seat.id)
                  const when = diedIn(story)
                  return (
                    <li key={seat.id} className="history-player">
                      <div aria-hidden="true">
                        <Token {...(isEmptySeat(seat.character) ? {} : { character: seat.character })} size={36} alignment={seat.alignment} dead={!seat.alive} />
                      </div>
                      <div className="history-player-text">
                        <div className="history-player-line">
                          <span className="history-player-name">{seat.name}</span>
                          {seat.alive ? null : (
                            <span className="history-fate">
                              <Icon name="skull" size={16} color={palette.inkMuted} />
                              {when === undefined ? t('board.dead') : <><span className="history-spoken">{t('board.dead')}, </span>{when}</>}
                            </span>
                          )}
                        </div>
                        <div className="history-player-role">
                          <span>{characterName(seat.character)}</span>
                          <SetupMarks seat={seat} setup={setup} locale={locale} t={t} />
                        </div>
                        {seat.shown ? <span className="history-player-fact">{t('history.believes', { character: characterName(seat.shown) })}</span> : null}
                        {story?.startedAs ? <span className="history-player-fact">{t('history.startedAs', { character: characterName(story.startedAs) })}</span> : null}
                        {story?.startedOn ? <span className="history-player-fact">{t(story.startedOn === 'good' ? 'history.startedGood' : 'history.startedEvil')}</span> : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
            {alignment === 'evil' ? (
              <div className="history-bluffs">
                {bluffs.length > 0 ? <Spare title={t('board.bluffsTitle')} characters={bluffs} alignment="good" locale={locale} /> : (
                  <>
                    <h3 className="history-bluffs-title">{t('board.bluffsTitle')}</h3>
                    <p className="history-muted">{t('history.noBluffs')}</p>
                  </>
                )}
              </div>
            ) : null}
          </section>
        ))}
        {loose.length > 0 ? (
          <section className="history-loose" aria-label={t('board.looseTitle')}>
            <Spare title={t('board.looseTitle')} characters={loose} locale={locale} />
          </section>
        ) : null}
      </div>
    </section>
  )
}
