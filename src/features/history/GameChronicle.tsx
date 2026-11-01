import { Fragment } from 'react'
import { Image } from 'react-native'

import type { Locale, Translate, Values } from '../../content'
import { gameText, isEmptySeat, seatName } from '../../content'
import { genericArt } from '../../content/generated/art'
import type { Chapter, Fact, Player, Side } from '../../store/chronicle'
import { CharacterIcon } from '../../ui/CharacterIcon'
import { Icon } from '../../ui/icons'
import { palette } from '../../ui/theme'

interface Line {
  readonly text: string
  readonly names: readonly string[] // set in bold
  readonly icon: Player | 'skull' | 'nominate'
  readonly hands?: string
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

// One sentence per fact.
const lineOf = (fact: Fact, locale: Locale, t: Translate): Line => {
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
    case 'exiled':
      return about('history.exile', fact.player)
    case 'onBlock':
      return { ...about('history.onBlock', fact.player), icon: 'skull' }
    case 'nomination': {
      const side = (s: Side) => (s === 'storyteller' ? t('board.storyteller') : name(s))
      const by = side(fact.by)
      const of = side(fact.of)
      const hands = fact.hands.map(({ player, ghost }) => (ghost ? t('history.voterGhost', { name: name(player) }) : name(player))).join(', ')
      return { text: t('day.manualNomination', { by, of, count: fact.count }), names: [by, of], icon: fact.of === 'storyteller' ? 'nominate' : fact.of, ...(hands ? { hands } : {}) }
    }
  }
}

const markerArt = { night: genericArt['dusk'], day: genericArt['dawn'] } as const

export const GameChronicle = ({ chapters, locale, t }: { readonly chapters: readonly Chapter[]; readonly locale: Locale; readonly t: Translate }) => {
  if (chapters.length === 0) return null
  return (
    <section className="history-chronicle" aria-label={t('history.chronicle')}>
      <h3 className="history-side-title">{t('history.chronicle')}</h3>
      <div className="history-chapters">
        {chapters.map((chapter, i) => (
          <section key={i} className="history-chapter">
            <h4 className="history-chapter-title">
              {markerArt[chapter.phase] !== undefined ? <Image source={markerArt[chapter.phase]} style={{ width: 22, height: 22 }} accessible={false} /> : null}
              {t(`board.${chapter.phase}`, { n: chapter.night })}
            </h4>
            <ul className="history-facts">
              {chapter.facts.map((fact, j) => {
                const line = lineOf(fact, locale, t)
                return (
                  <li key={j} className="history-fact">
                    <span className="history-fact-icon" aria-hidden="true">
                      {typeof line.icon === 'string' ? <Icon name={line.icon} size={22} color={palette.inkMuted} />
                        : isEmptySeat(line.icon.character) ? <Icon name="player" size={22} color={palette.inkMuted} />
                          : <CharacterIcon id={line.icon.character} size={28} tint={line.icon.alignment} lazy />}
                    </span>
                    <span className="history-fact-text">
                      <span>{runs(line.text, line.names).map((run, k) => (run.bold ? <strong key={k}>{run.s}</strong> : <Fragment key={k}>{run.s}</Fragment>))}</span>
                      {line.hands ? <span className="history-fact-hands">{line.hands}</span> : null}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </section>
  )
}
