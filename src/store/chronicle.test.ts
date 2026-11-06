import type { Payload } from '../engine'
import { asEventId } from '../engine'
import type { Step } from '../engine/testing/board'
import { addTraveller, execute, exile, game, kill, nominate, removeSeat, revive, setAlignment, setCharacter, vote } from '../engine/testing/board'
import type { Fact } from './chronicle'
import { chronicleOf } from './chronicle'

// The edits the day window records around a vote, as the board's own steps do.
const mark = (who: string | null): Step => (id) => ({ kind: 'markForExecution', seat: who === null ? null : id(who) })
const lastNomination = (log: readonly Payload[]) => asEventId(log.findLastIndex(p => p.kind === 'nominate'))
const tally = (total: number): Step => (_, { log }) => ({ kind: 'setVoteTotal', nomination: lastNomination(log), total })
const cancel: Step = (_, { log }) => ({ kind: 'cancelNomination', nomination: lastNomination(log) })
const unvote = (who: string): Step => (id, { log }) => ({ kind: 'unvote', nomination: lastNomination(log), seat: id(who), weight: 1 })
const hand = (who: string) => vote(who, undefined, 1, true)

// Each fact as a short line, so a test reads as the story it checks.
const line = (fact: Fact): string => {
  if (fact.kind !== 'nomination') return `${fact.player.name} ${fact.kind}${fact.kind === 'becomes' ? ` ${fact.player.character}` : ''}`
  const side = (s: typeof fact.by) => (s === 'storyteller' ? 'Storyteller' : s.name)
  return `${fact.exile ? 'exile' : side(fact.by)} → ${side(fact.of)}: ${fact.count} (${fact.hands.map(h => h.player.name + (h.ghost ? '†' : '')).join(', ')})`
}
const story = (b: ReturnType<ReturnType<typeof game>['build']>) =>
  chronicleOf(b.log, 'tb').chapters.map(c => [`${c.phase} ${c.night}`, ...c.facts.map(line)])

const table = () => game().seat('Ann', 'imp').seat('Bob', 'spy').seat('Cat', 'chef').seat('Dan', 'empath').seat('Eve', 'slayer')

describe('the chronicle of a game', () => {
  test('tells each night and day: nominations with their hands, the block, deaths and changes', () => {
    const b = table()
      .night(1)
      .day([mark(null), nominate('Cat', 'Dan'), hand('Cat'), hand('Ann'), hand('Bob'), tally(3), mark('Dan'),
        nominate('Eve', 'Bob'), hand('Eve'), tally(1), kill('Dan', 'storyteller')])
      .night(2, [kill('Ann', 'storyteller'), setCharacter('Bob', 'imp')])
      .day([mark(null), nominate('Bob', 'Cat'), hand('Bob'), hand('Dan'), hand('Eve'), tally(3), mark('Cat')])
      .build()
    expect(story(b)).toEqual([
      ['day 1', 'Cat → Dan: 3 (Cat, Ann, Bob)', 'Dan onBlock', 'Eve → Bob: 1 (Eve)', 'Dan dies'],
      ['night 2', 'Ann dies', 'Bob becomes imp'],
      ['day 2', 'Bob → Cat: 3 (Bob, Dan†, Eve)', 'Cat onBlock'],
    ])
    const { players } = chronicleOf(b.log, 'tb')
    expect(players.get(b.id('Dan'))).toEqual({ died: { phase: 'day', night: 1 } })
    expect(players.get(b.id('Ann'))).toEqual({ died: { phase: 'night', night: 2 } })
    expect(players.get(b.id('Bob'))).toEqual({ startedAs: 'spy' })
    expect(players.has(b.id('Cat'))).toBe(false)
  })

  test('a cancelled nomination and a withdrawn hand drop out, and a cleared marker leaves nobody on the block', () => {
    const b = table().night(1)
      .day([mark(null), nominate('Cat', 'Dan'), hand('Cat'), cancel, nominate('Eve', 'Bob'), hand('Eve'), hand('Ann'), unvote('Ann'),
        tally(1), mark('Bob'), mark(null)])
      .build()
    expect(story(b)).toEqual([['day 1', 'Eve → Bob: 1 (Eve)']])
  })

  test('an older day with no marker edit puts its clear vote leader on the block after the nominations', () => {
    const b = table().night(1).day([nominate('Cat', 'Dan'), hand('Cat'), hand('Ann'), hand('Bob'), nominate('Eve', 'Bob'), hand('Eve')]).build()
    expect(story(b)).toEqual([['day 1', 'Cat → Dan: 3 (Cat, Ann, Bob)', 'Eve → Bob: 1 (Eve)', 'Dan onBlock']])
  })

  test('setup and the time after the ending tell no story; a game still in setup has none', () => {
    expect(story(table().add(kill('Cat', 'storyteller'), setCharacter('Ann', 'baron')).build())).toEqual([])
    const ended = table().add(kill('Cat', 'storyteller')).night(1, [kill('Dan', 'storyteller')])
      .add(() => ({ kind: 'endGame', winner: 'good' }), kill('Eve', 'storyteller')).build()
    expect(story(ended)).toEqual([['night 1', 'Dan dies']])
    const { players } = chronicleOf(ended.log, 'tb')
    expect(players.get(ended.id('Cat'))).toEqual({ died: { phase: 'setup', night: 0 } })
    expect(players.get(ended.id('Eve'))).toEqual({ died: { phase: 'over', night: 1 } })
  })

  test('a revived player has no death, and quiet nights leave no chapter', () => {
    const b = table().night(1, [kill('Cat', 'storyteller')]).day().night(2, [revive('Cat')]).day().night(3).build()
    expect(story(b)).toEqual([['night 1', 'Cat dies'], ['night 2', 'Cat revives']])
    expect(chronicleOf(b.log, 'tb').players.has(b.id('Cat'))).toBe(false)
  })

  test('a repeated phase edit keeps its chapter, and a seat dealt during play starts as what it was dealt', () => {
    const b = game().seat('Ann', 'imp').seat('Bob', '_empty').seat('Cat', 'chef')
      .night(1, [setCharacter('Bob', 'spy', 'evil')]).day([mark(null), nominate('Cat', 'Ann'), hand('Cat')]).day([kill('Cat', 'storyteller')])
      .build()
    expect(story(b)).toEqual([['day 1', 'Cat → Ann: 1 (Cat)', 'Cat dies']])
    expect(chronicleOf(b.log, 'tb').players.has(b.id('Bob'))).toBe(false)
    const turned = game().seat('Ann', 'imp').seat('Bob', '_empty').night(1, [setCharacter('Bob', 'spy', 'evil')]).day([setAlignment('Bob', 'good')]).build()
    expect(story(turned)).toEqual([['day 1', 'Bob turns']])
    expect(chronicleOf(turned.log, 'tb').players.get(turned.id('Bob'))).toEqual({ startedOn: 'evil' })
  })

  test('a Traveller joins and leaves, a side change turns, and a legacy execution is told', () => {
    const b = table().night(1)
      .day([addTraveller('Fay', 'beggar', 5, 'good'), setAlignment('Eve', 'evil'), execute('Dan')])
      .night(2, [removeSeat('Fay')])
      .build()
    expect(story(b)).toEqual([['day 1', 'Fay joins', 'Eve turns', 'Dan executed'], ['night 2', 'Fay leaves']])
    expect(chronicleOf(b.log, 'tb').players.get(b.id('Eve'))).toEqual({ startedOn: 'good' })
  })

  test('an exile is told with its hands and puts nobody on the block', () => {
    const b = table().night(1, [kill('Ann', 'storyteller')])
      .day([addTraveller('Fay', 'beggar', 5, 'good'), exile('Fay'), hand('Ann'), hand('Bob'), hand('Cat'), tally(3)])
      .build()
    expect(story(b)).toEqual([['night 1', 'Ann dies'], ['day 1', 'Fay joins', 'exile → Fay: 3 (Ann†, Bob, Cat)']])
  })
})
