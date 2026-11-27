import { Fragment } from 'react'
import { Image } from 'react-native'

import type { CharacterId, Locale, Translate, Values } from '../../content'
import { gameText, isEmptySeat, seatName } from '../../content'
import { genericArt } from '../../content/generated/art'
import { isNote } from '../../engine'
import type { Chapter, Fact, Hand, Player, Reminded, Side } from '../../store/chronicle'
import { CharacterIcon } from '../../ui/CharacterIcon'
import { Icon } from '../../ui/icons'
import { palette } from '../../ui/theme'
import { railMarker, voteToken } from './HistoryStyles'

type Nomination = Extract<Fact, { kind: 'nomination' }>
// What a line tells: a recorded fact, or an execution and the death recorded right after it,
// which are one thing to a reader. An execution that kills nobody keeps its own line.
type Told = Fact | { readonly kind: 'executedDies'; readonly player: Player }

const told = (facts: readonly Fact[]): readonly Told[] => facts.flatMap((fact, i): Told[] => {
  const before = facts[i - 1]
  const after = facts[i + 1]
  if (fact.kind === 'dies' && before?.kind === 'executed' && before.player.id === fact.player.id) return []
  if (fact.kind === 'executed' && after?.kind === 'dies' && after.player.id === fact.player.id) return [{ kind: 'executedDies', player: fact.player }]
  return [fact]
})

interface Line {
  readonly text: string
  readonly names: readonly string[] // set in bold
  readonly icon: Player | 'skull'
}

// The sentence split around the names it mentions, longest name first so "Ann" never cuts "Anna".
const runs = (text: string, strong: readonly string[]): readonly { readonly s: string; readonly bold: boolean }[] => {
  const names = [...new Set(strong.filter((n) => n.length > 0))].sort((a, b) => b.length - a.length)
  if (names.length === 0) return [{ s: text, bold: false }]
  const out: { s: string; bold: boolean }[] = []
  let rest = text
  while (rest.length > 0) {
    let at = -1
    let hit = ''
    for (const n of names) {
      const i = rest.indexOf(n)
      if (i !== -1 && (at === -1 || i < at)) {
        at = i
        hit = n
      }
    }
    if (at === -1) {
      out.push({ s: rest, bold: false })
      break
    }
    if (at > 0) out.push({ s: rest.slice(0, at), bold: false })
    out.push({ s: hit, bold: true })
    rest = rest.slice(at + hit.length)
  }
  return out
}

// One sentence per fact that is not a vote.
const lineOf = (fact: Exclude<Told, Nomination>, locale: Locale, t: Translate): Line => {
  const name = (player: Player) => seatName(locale, player.name)
  const role = (player: Player) => gameText(locale).role(player.character).name
  const about = (key: string, player: Player, values: Values = {}): Line =>
    ({ text: t(key, { name: name(player), ...values }), names: [name(player)], icon: player })
  switch (fact.kind) {
    case 'dies':
      return about('history.dies', fact.player)
    case 'revives':
      return about('history.revive', fact.player)
    case 'becomes':
      return about('history.setCharacter', fact.player, { character: role(fact.player) })
    case 'turns':
      return about(fact.player.alignment === 'good' ? 'history.setAlignmentGood' : 'history.setAlignmentEvil', fact.player)
    case 'joins':
      return isEmptySeat(fact.player.character) ? about('history.addSeatEmpty', fact.player) : about('history.addSeat', fact.player, { character: role(fact.player) })
    case 'leaves':
      return about('history.removeSeat', fact.player)
    case 'executed':
      return about('history.execute', fact.player)
    case 'executedDies':
      return about('history.executeDies', fact.player)
    case 'exiled':
      return about('history.exile', fact.player)
    case 'onBlock':
      return { ...about('history.onBlock', fact.player), icon: 'skull' }
  }
}

const Bold = ({ text, names }: { readonly text: string; readonly names: readonly string[] }) =>
  runs(text, names).map((run, k) => (run.bold ? <strong key={k}>{run.s}</strong> : <Fragment key={k}>{run.s}</Fragment>))

const HandToken = ({ hand: { player, ghost }, size }: { readonly hand: Hand; readonly size: number }) => (
  <span className="history-hand-token" data-ghost={ghost} aria-hidden="true">
    {isEmptySeat(player.character) ? <Icon name="player" size={size - 2} color={palette.inkMuted} />
      : <CharacterIcon id={player.character} size={size} tint={player.alignment} lazy />}
  </span>
)

// A vote is one line, as in the day window: who nominated whom, the voters' tokens so the sides
// show at a glance, and the tally. The names keep their room and the tokens take what is left of
// the line, so a narrow column shows fewer of them and never a clipped one; the tally says how
// many there were. The voters' names open under the line on a tap, so a day of many votes stays
// a short list. A vote with no recorded hand has nothing to open.
const Vote = ({ fact, locale, t }: { readonly fact: Nomination; readonly locale: Locale; readonly t: Translate }) => {
  const side = (s: Side) => (s === 'storyteller' ? t('board.storyteller') : seatName(locale, s.name))
  const by = side(fact.by)
  const of = side(fact.of)
  const count = fact.count
  // An exile records no caller, so it names only the Traveller.
  const said = fact.exile ? t('day.manualExile', { of, count }) : t('day.manualNomination', { by, of, count })
  const line = (
    <>
      <span className="history-vote-names">
        {fact.exile ? <Bold text={t('day.exileOf', { of })} names={[of]} /> : <><strong>{by}</strong>{' → '}<strong>{of}</strong></>}
      </span>
      <span className="history-vote-tokens" aria-hidden="true">
        {fact.hands.map(hand => <HandToken key={hand.player.id} hand={hand} size={voteToken} />)}
      </span>
      <span className="history-vote-count"><strong>{count}</strong>{t('day.votesLabel', { count })}</span>
    </>
  )
  if (fact.hands.length === 0) return <div className="history-vote history-vote-line" role="group" aria-label={said}>{line}</div>
  return (
    <details className="history-vote">
      <summary className="history-vote-line" aria-label={said}>
        {line}
        <span className="history-vote-chevron" aria-hidden="true"><Icon name="chevronDown" size={16} color={palette.inkMuted} /></span>
      </summary>
      <Hands hands={fact.hands} locale={locale} t={t} />
    </details>
  )
}

// The voters as the tokens they held, in columns, so a long vote is a small table, not a
// paragraph. A hand raised while dead is greyed under a skull, as a dead player is on the board,
// and says so to a screen reader.
const Hands = ({ hands, locale, t }: { readonly hands: readonly Hand[]; readonly locale: Locale; readonly t: Translate }) => (
  <ul className="history-hands">
    {hands.map((hand) => {
      const { player, ghost } = hand
      const name = seatName(locale, player.name)
      const said = ghost ? t('history.voterGhost', { name }) : name
      return (
        <li key={player.id} className="history-hand" title={said}>
          <HandToken hand={hand} size={18} />
          <span className="history-hand-name" aria-hidden={ghost}>{name}</span>
          {ghost ? <>
            <span className="history-hand-skull" aria-hidden="true"><Icon name="skull" size={13} color={palette.inkMuted} /></span>
            <span className="history-spoken">{said}</span>
          </> : null}
        </li>
      )
    })}
  </ul>
)

// One wrapped row of pills a phase, however many reminders it saw, so they never crowd out the
// votes and deaths: a look at who was poisoned that night finds it under the night's title.
const Reminders = ({ reminders, locale, t }: { readonly reminders: readonly Reminded[]; readonly locale: Locale; readonly t: Translate }) => {
  const text = gameText(locale)
  if (reminders.length === 0) return null
  return (
    <ul className="history-reminders history-placed" aria-label={t('scripts.characterReminders')}>
      {reminders.map(({ player, token: { def: [id, reminder], note, placedBy } }) => {
        const name = seatName(locale, player.name)
        if (isNote([id, reminder], note)) {
          return (
            <li key={placedBy} className="history-reminder history-note">
              <Icon name="edit" size={14} color={palette.inkMuted} />
              <span>{t('history.reminderOn', { reminder: note ?? '', name })}</span>
            </li>
          )
        }
        const label = note ? `${text.reminder(reminder)}: ${note}` : text.reminder(reminder)
        return (
          <li key={placedBy} className="history-reminder" title={text.role(id as CharacterId).name}>
            <CharacterIcon id={id} size={20} lazy />
            <span>{t('history.reminderOn', { reminder: label, name })}</span>
          </li>
        )
      })}
    </ul>
  )
}

const markerArt = { night: genericArt['dusk'], day: genericArt['dawn'] } as const

interface Props {
  readonly chapters: readonly Chapter[]
  // How a finished game ended, as the last line of its story: the winner, in its colour.
  readonly ending?: { readonly label: string; readonly color?: string }
  readonly locale: Locale
  readonly t: Translate
}

export const GameChronicle = ({ chapters, ending, locale, t }: Props) => {
  if (chapters.length === 0) return null
  return (
    <section className="history-chronicle" aria-label={t('history.chronicle')}>
      <h2 className="history-section-title">{t('history.chronicle')}</h2>
      <Chapters chapters={chapters} locale={locale} t={t} {...(ending ? { ending } : {})} />
    </section>
  )
}

export const Chapters = ({ chapters, ending, locale, t }: Props) => (
  <div className="history-chapters">
    {chapters.map((chapter, i) => (
      <section key={i} className="history-chapter">
        <h3 className="history-chapter-title">
          {markerArt[chapter.phase] !== undefined ? <Image source={markerArt[chapter.phase]} style={{ width: railMarker, height: railMarker }} accessible={false} /> : null}
          {t(`board.${chapter.phase}`, { n: chapter.night })}
        </h3>
        <Reminders reminders={chapter.reminders} locale={locale} t={t} />
        <ul className="history-facts">
          {told(chapter.facts).map((fact, j) => {
            if (fact.kind === 'nomination') return <li key={j} className="history-fact" data-vote><Vote fact={fact} locale={locale} t={t} /></li>
            const line = lineOf(fact, locale, t)
            return (
              <li key={j} className="history-fact">
                <span className="history-fact-icon" aria-hidden="true">
                  {typeof line.icon === 'string' ? <Icon name={line.icon} size={20} color={palette.inkMuted} />
                    : isEmptySeat(line.icon.character) ? <Icon name="player" size={20} color={palette.inkMuted} />
                      : <CharacterIcon id={line.icon.character} size={22} tint={line.icon.alignment} lazy />}
                </span>
                <span className="history-fact-text"><Bold text={line.text} names={line.names} /></span>
              </li>
            )
          })}
        </ul>
      </section>
    ))}
    {/* The rail stops on the result, so the story says who won where it ends. */}
    {ending ? (
      <section className="history-chapter history-ending">
        <h3 className="history-chapter-title" style={ending.color ? { color: ending.color } : undefined}>
          <span className="history-flag" aria-hidden="true"><Icon name="flag" size={16} color={palette.parchment} /></span>
          {ending.label}
        </h3>
      </section>
    ) : null}
  </div>
)
