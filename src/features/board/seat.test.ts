import { game, grant, kill, setShown, token } from '../../engine/testing/board'
import type { Event, Payload, SeatId } from '../../engine'
import { apply, asEventId } from '../../engine'
import { asCharacterId, registerHomebrew, scriptHomebrew } from '../../content'
import { deserialize, newGame, serialize } from '../../store/saved'
import { appendAll, boardOf, openSession, redo, undo } from '../../store/session'
import { boardView } from './board'
import { bluffChoices, characterGroups, edits, goodInPlay, pickerGroups, reminderGroups, roster, writtenNotes } from './seat'

const characterIds = (...ids: readonly string[]) => ids.map(asCharacterId)
const manual = (payload: Payload): Event => ({ ...payload, id: asEventId(100), audience: 'storyteller', manual: true })

const table = () =>
  game()
    .seat('Ann', 'imp')
    .seat('Bob', 'poisoner')
    .seat('Cat', 'drunk', { shown: 'empath' })
    .seat('Dan', 'chef')
    .seat('Eve', 'washerwoman')


describe('the pickers', () => {
  test('the roster is the script plus its Travellers, grouped by team in the fixed order', () => {
    const ids = roster('tb')
    expect(ids).toContain('imp')
    expect(ids).toContain('scapegoat')
    expect(ids).not.toContain('angel')
    const groups = characterGroups('tb')
    expect(groups.map((g) => g.team)).toEqual(['townsfolk', 'outsider', 'minion', 'demon', 'traveller'])
  })

  test('an id this build does not know is not offered', () => {
    const script = { kind: 'custom', name: 'Later', items: [{ id: '_meta', name: 'Later' }, 'imp', 'nightowl', 'chef'] } as const
    expect(roster(script)).toEqual(['imp', 'chef'])
  })

  test('picker groups follow the team order, drop empty teams and build each row', () => {
    const colors = { townsfolk: 'blue', outsider: 'blue', minion: 'red', demon: 'red', traveller: 'purple', fabled: 'gold', loric: 'green' }
    const groups = pickerGroups(characterIds('imp', 'chef', 'scapegoat', 'poisoner', 'washerwoman'), (team) => team.toUpperCase(), colors,
      (id, team) => `${team}:${id}`)
    expect(groups).toEqual([
      { key: 'townsfolk', label: 'TOWNSFOLK', color: 'blue', rows: ['townsfolk:chef', 'townsfolk:washerwoman'] },
      { key: 'minion', label: 'MINION', color: 'red', rows: ['minion:poisoner'] },
      { key: 'demon', label: 'DEMON', color: 'red', rows: ['demon:imp'] },
      { key: 'traveller', label: 'TRAVELLER', color: 'purple', rows: ['traveller:scapegoat'] },
    ])
    expect(pickerGroups([], (team) => team, colors, (id) => id)).toEqual([])
  })

  test('reminders separate characters in play from the rest of the script without duplicates', () => {
    const { g } = table().build()
    const groups = reminderGroups(g, 'en')
    expect(groups.map((group) => group.key)).toEqual(['inPlay', 'notInPlay'])
    expect(groups[0]?.entries.map((e) => e.character)).toEqual(['washerwoman', 'washerwoman', 'drunk', 'poisoner', 'imp'])
    const rest = groups[1]!.entries
    expect(rest.some((e) => e.character === 'poisoner')).toBe(false)
    expect(rest.some((e) => e.character === 'baron')).toBe(false)
    expect(rest.some((e) => e.character === 'fortuneteller')).toBe(true)
    const keys = groups.flatMap((group) => group.entries.map((entry) => entry.key))
    expect(new Set(keys).size).toBe(keys.length)
  })

  test('the reminder picker lists the characters in play first', () => {
    const { g } = table().build()
    const groups = reminderGroups(g, 'en')
    expect(groups[0]?.key).toBe('inPlay')
    expect(groups[0]?.entries.map((e) => e.character)).toContain('poisoner')
    expect(groups[0]?.entries.map((e) => e.character)).toContain('washerwoman')
  })

  test('dead characters and granted abilities stay in play, while shown characters do not', () => {
    const { g } = game().seat('Ann', 'drunk', { shown: 'washerwoman' }).seat('Bob', 'poisoner')
      .night(1, [kill('Bob'), grant('Ann', 'monk', 'storyteller')]).build()
    const groups = reminderGroups(g, 'en')
    const playing = groups[0]!.entries.map((entry) => entry.character)
    expect(playing).toContain('poisoner')
    expect(playing).toContain('monk')
    expect(playing).not.toContain('washerwoman')
    expect(groups[1]!.entries.some((entry) => entry.character === 'washerwoman')).toBe(true)
  })

  test('bluffs offer only out-of-play Townsfolk and Outsiders and work without a Demon', () => {
    const { g } = table().build()
    const choices = bluffChoices(g)
    expect(choices).toHaveLength(14)
    expect(choices).toEqual(expect.arrayContaining(['empath', 'monk', 'recluse']))
    for (const occupied of ['chef', 'drunk', 'washerwoman']) expect(choices).not.toContain(occupied)
    for (const excluded of ['poisoner', 'spy', 'scarletwoman', 'baron', 'imp', 'thief', 'bureaucrat', 'gunslinger', 'beggar', 'scapegoat']) expect(choices).not.toContain(excluded)
    const noDemon = game().seat('Dan', 'chef').build()
    expect(bluffChoices(noDemon.g)).not.toContain('chef')
    expect(bluffChoices(noDemon.g)).toContain('monk')
  })

  test('the good characters in play are the ones bluffs leave out', () => {
    const { g } = table().build()
    expect([...goodInPlay(g)].sort()).toEqual(characterIds('chef', 'drunk', 'washerwoman'))
    // Together they are Trouble Brewing's 13 Townsfolk and 4 Outsiders, each once.
    expect(new Set([...goodInPlay(g), ...bluffChoices(g)]).size).toBe(17)
    expect(goodInPlay(g).length + bluffChoices(g).length).toBe(17)
  })

  test('bluffs exclude dead characters and ability annotations but allow shown characters', () => {
    const { g } = game().seat('Ann', 'drunk', { shown: 'washerwoman' }).seat('Bob', 'chef')
      .night(1, [kill('Bob'), grant('Ann', 'monk', 'storyteller')]).build()
    const choices = bluffChoices(g)
    expect(choices).not.toContain('chef')
    expect(choices).not.toContain('monk')
    expect(choices).toContain('washerwoman')
  })

  test('a Drunk sitting as a Townsfolk under Is The Drunk is in play, and so is that Townsfolk', () => {
    const { g } = game().seat('Ann', 'empath').add(token('storyteller', 'drunk/Is The Drunk', 'Ann')).build()
    const choices = bluffChoices(g)
    expect(choices).not.toContain('drunk')
    expect(choices).not.toContain('empath')
    expect(reminderGroups(g, 'en')[0]?.entries.map(entry => entry.reminder)).toContain('Is The Drunk')
  })

  test('custom-script bluffs respect bundled and homebrew character teams', () => {
    const { g } = game({ kind: 'custom', name: 'Custom bluffs', items: [
      'chef', 'beggar', 'poisoner', 'imp', { id: 'thief' },
      { id: 'guest', name: 'Guest', team: 'traveller', ability: 'A visitor.' },
      { id: 'host', name: 'Host', team: 'townsfolk', ability: 'A local.' },
      { id: 'visitor', name: 'Visitor', team: 'outsider', ability: 'A local outsider.' },
      { id: 'henchman', name: 'Henchman', team: 'minion', ability: 'An evil helper.' },
      { id: 'monster', name: 'Monster', team: 'demon', ability: 'An evil leader.' },
    ] }).build()
    expect(bluffChoices(g)).toEqual(['chef', 'host', 'visitor'])
  })
})

describe('the edits', () => {
  test('a note is a token with nothing behind it, on a seat', () => {
    expect(edits.placeNote('Claimed Chef', 'x' as SeatId)).toEqual({ kind: 'placeToken', token: ['note', ''], note: 'Claimed Chef', seat: 'x' })
  })

  test('the picker offers each written note once, newest first, with only its latest text', () => {
    const log: Event[] = []
    const add = (payload: Payload) =>
      log.push({ ...payload, id: asEventId(log.length), audience: 'storyteller', manual: true })
    add(edits.placeNote('Poisond?', 'a' as SeatId))
    add(edits.placeReminder({ character: 'poisoner' as never, reminder: 'Poisoned' }, 'a' as SeatId))
    add(edits.placeNote('Mad as Chef', 'b' as SeatId))
    add(edits.placeNote(' Poisond? ', 'b' as SeatId))
    expect(writtenNotes(log)).toEqual(['Poisond?', 'Mad as Chef'])
    add(edits.setNote(asEventId(0), 'Poisoned?'))
    add(edits.removeToken(asEventId(2)))
    // A removed note is still offered, and the first note now offers only its new text.
    expect(writtenNotes(log)).toEqual(['Poisoned?', 'Poisond?', 'Mad as Chef'])
  })

  test('a reminder placed from the picker names its character and the seat it goes on, and no source', () => {
    expect(edits.placeReminder({ character: 'poisoner' as never, reminder: 'Poisoned' }, 'a' as SeatId)).toEqual({
      kind: 'placeToken',
      token: ['poisoner', 'Poisoned'],
      seat: 'a',
    })
  })

  test('moving a reminder lands it on the other seat as it was, survives a reload, and one undo puts it back', () => {
    const table = game().seat('Ann', 'poisoner').seat('Bob', 'monk').seat('Cat', 'chef')
      .night(1, [token('Ann', 'poisoner/Poisoned', 'Bob'), token('Bob', 'monk/Safe', 'Bob')])
      .add(id => edits.placeNote('Claimed Chef', id('Bob'))).build()
    const before = openSession({ ...newGame('tb', 1000), log: table.log })
    const board = boardOf(before)
    const [poisoned, safe, note] = board.seats[1]!.tokens
    const moved = appendAll(before, edits.moveToken(board, poisoned!.placedBy, table.id('Cat')), 1001)
    const after = boardOf(moved)
    expect(after.seats[1]!.tokens).toEqual([safe, note])
    expect(after.seats[2]!.tokens).toEqual([{ ...poisoned, placedBy: moved.game.log.at(-1)!.id }])
    expect(boardOf(openSession(deserialize(serialize(moved.game))))).toEqual(after)

    const undone = undo(moved, 1002)
    expect(undone.game.log).toEqual(before.game.log)
    expect(boardOf(undone)).toEqual(board)
    expect(boardOf(redo(undone, 1003))).toEqual(after)

    const noted = boardOf(appendAll(before, edits.moveToken(board, note!.placedBy, table.id('Ann')), 1001))
    expect(noted.seats[0]!.tokens).toEqual([{ ...note, placedBy: asEventId(before.game.log.length + 1) }])
    // Dropped where it already sits, or naming nothing on the board, a move records nothing.
    expect(edits.moveToken(board, poisoned!.placedBy, table.id('Bob'))).toEqual([])
    expect(edits.moveToken(board, asEventId(999), table.id('Cat'))).toEqual([])
    expect(edits.moveToken(board, poisoned!.placedBy, 'nobody' as SeatId)).toEqual([])
  })

  test('a death by hand is the Storyteller\'s, and bluff selection does not tell the Demon', () => {
    expect(edits.kill('a' as SeatId)).toEqual({ kind: 'kill', seat: 'a', cause: 'storyteller' })
    const told = edits.setBluffs(['monk', 'chef'] as never)
    expect(told).toMatchObject({ kind: 'setBluffs', characters: ['monk', 'chef'] })
  })

  test('a new seat is minted with its place in the ring', () => {
    const e = edits.addSeat('Zed', 3, 'scapegoat' as never, 'evil')
    expect(e).toMatchObject({ kind: 'addSeat', name: 'Zed', at: 3, character: 'scapegoat', alignment: 'evil' })
    expect(e.kind === 'addSeat' && e.seat.startsWith('s')).toBe(true)
  })

  test('turning the ring keeps every neighbour and moves who sits at the top', () => {
    const { g } = table().build()
    const ids = g.seats.map((s) => s.id)
    const names = (payload: Payload | undefined) => apply(g, manual(payload!)).seats.map((s) => s.name)
    expect(names(edits.turnSeats(ids, 'clockwise'))).toEqual([g.seats.at(-1)!.name, ...g.seats.slice(0, -1).map((s) => s.name)])
    expect(names(edits.turnSeats(ids, 'counterclockwise'))).toEqual([...g.seats.slice(1).map((s) => s.name), g.seats[0]!.name])
    expect(edits.turnSeats(ids.slice(0, 1), 'clockwise')).toBeUndefined()
  })

  test('clearing the belief leaves the seat with no shown character', () => {
    const { g, id } = table().night(1, [setShown('Cat')]).build()
    expect(g.seats.find((s) => s.id === id('Cat'))?.shown).toBeUndefined()
  })
})

describe('a homebrew character on the board', () => {
  const lamp = { id: 'lampx1', name: 'Lamplighter', team: 'minion', ability: 'Each night, choose a player.', reminders: ['Lit'], firstNight: 20.5 } as const
  const script = { kind: 'custom', name: 'Home', items: [{ id: '_meta', name: 'Home' }, 'chef', 'imp', lamp] } as const

  // The store registers the open game's script; the board reads through the bundled lookups.
  beforeEach(() => registerHomebrew(scriptHomebrew(script)))
  afterEach(() => registerHomebrew([]))

  test('sits with its declared team, carries its words and offers its reminders', () => {
    const { g, log } = game(script).seat('Ann', 'imp').seat('Bob', 'lampx1').seat('Cat', 'chef').build()
    expect(characterGroups(g.script).find((group) => group.team === 'minion')?.ids).toEqual(['lampx1'])
    expect(g.seats.find((s) => s.name === 'Bob')?.alignment).toBe('evil')
    expect(boardView(g, log, 'fr').seats[1]).toMatchObject({ character: 'lampx1', characterName: 'Lamplighter' })
    expect(reminderGroups(g, 'en')[0]?.entries).toContainEqual(expect.objectContaining({ character: 'lampx1', reminder: 'Lit', characterName: 'Lamplighter' }))
  })
})
