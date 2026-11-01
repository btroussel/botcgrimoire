import type { CustomScript } from '../content'
import { contentPin } from '../content'
import { reduce } from '../engine'
import { game as buildGame, token } from '../engine/testing/board'
import { contentMismatch, deserialize, InvalidSavedGame, migrate, newGame, SAVED_VERSION, serialize } from './saved'

// One fixture per format version, written by the app of that version and never edited: a small
// but real game, two seats through the first night.
const fixtures: Readonly<Record<number, unknown>> = {
  1: {
    version: 1,
    id: 'gfixture001',
    createdAt: 1000,
    updatedAt: 1007,
    content: { release: 'aaaaaaa', translations: 'bbbbbbb' },
    script: 'tb',
    log: [
      { id: 0, audience: 'storyteller', kind: 'addSeat', seat: 'sa1', name: 'Ann', at: 0, character: 'imp', alignment: 'evil' },
      { id: 1, audience: 'storyteller', kind: 'addSeat', seat: 'sb2', name: 'Bob', at: 1, character: 'chef', alignment: 'good' },
      { id: 2, audience: 'storyteller', kind: 'phase', to: 'night', night: 1 },
      { id: 3, audience: 'storyteller', kind: 'wake', seat: 'sb2', step: 20 },
      { id: 4, audience: 'storyteller', kind: 'choice', seat: 'sa1', picks: [{ kind: 'seat', seat: 'sb2' }] },
      {
        id: 5,
        audience: 'storyteller',
        kind: 'info',
        to: ['sb2'],
        told: { kind: 'number', value: 0 },
        truth: { kind: 'number', value: 0 },
        malfunctioned: false,
      },
      { id: 6, audience: 'storyteller', kind: 'kill', seat: 'sb2', cause: 'demon' },
      { id: 7, audience: 'storyteller', kind: 'phase', to: 'day' },
    ],
  },
  2: {
    version: 2, id: 'gfixture002', createdAt: 1000, updatedAt: 8000,
    content: { release: 'aaaaaaa', translations: 'bbbbbbb' }, script: 'tb',
    log: [
      { id: 0, audience: 'storyteller', recordedAt: 2000, kind: 'addSeat', seat: 'sa1', name: 'Ann', at: 0, character: 'imp', alignment: 'evil' },
      { id: 1, audience: 'storyteller', recordedAt: 2000, kind: 'addSeat', seat: 'sb2', name: 'Bob', at: 1, character: 'chef', alignment: 'good' },
      { id: 2, audience: 'storyteller', recordedAt: 3000, kind: 'phase', to: 'night', night: 1 },
      { id: 3, audience: 'storyteller', recordedAt: 8000, kind: 'phase', to: 'over' },
    ],
  },
  4: {
    version: 4, id: 'gfixture004', createdAt: 1000, updatedAt: 8000,
    content: { release: 'aaaaaaa', translations: 'bbbbbbb' }, script: 'tb', playTime: [],
    log: [
      { id: 0, audience: 'storyteller', kind: 'addSeat', seat: 'sa1', name: 'Ann', at: 0, character: 'imp', alignment: 'evil' },
      { id: 1, audience: 'storyteller', kind: 'addSeat', seat: 'sb2', name: 'Bob', at: 1, character: 'chef', alignment: 'good' },
      { id: 2, audience: 'storyteller', kind: 'renameSeat', seat: 'sa1', name: 'Alice' },
    ],
  },
  3: {
    version: 3, id: 'gfixture003', createdAt: 1000, updatedAt: 8000,
    content: { release: 'aaaaaaa', translations: 'bbbbbbb' }, script: 'tb',
    playTime: [{ start: 3000, end: 4000 }, { start: 7000, end: 8000 }],
    log: [
      { id: 0, audience: 'storyteller', recordedAt: 2000, kind: 'addSeat', seat: 'sa1', name: 'Ann', at: 0, character: 'imp', alignment: 'evil' },
      { id: 1, audience: 'storyteller', recordedAt: 2000, kind: 'addSeat', seat: 'sb2', name: 'Bob', at: 1, character: 'chef', alignment: 'good' },
      { id: 2, audience: 'storyteller', recordedAt: 3000, kind: 'phase', to: 'night', night: 1 },
      { id: 3, audience: 'storyteller', recordedAt: 8000, kind: 'phase', to: 'over' },
    ],
  },
}

describe('migrate', () => {
  test('version 2 freezes its previous wall-clock span at the last save', () => {
    expect(migrate(fixtures[2]).playTime).toEqual([{ start: 1000, end: 8000 }])
  })

  test('play intervals survive export and reject malformed or overlapping spans', () => {
    const game = migrate(fixtures[3])
    expect(deserialize(serialize(game))).toEqual(game)
    for (const playTime of [undefined, [{ start: -1, end: 2 }], [{ start: 2, end: 1 }], [{ start: 0, end: Infinity }], [{ start: 0, end: 3 }, { start: 2, end: 4 }]]) {
      expect(() => migrate({ ...game, playTime })).toThrow(InvalidSavedGame)
    }
  })

  test('version 1 preserves its log without fabricating event times', () => {
    const game = migrate(fixtures[1])
    expect(game.log.every((event) => event.recordedAt === undefined)).toBe(true)
    expect(game.createdAt).toBe(1000)
    expect(game.updatedAt).toBe(1007)
  })

  test('timestamped logs survive file round trips and reject invalid times', () => {
    const game = migrate(fixtures[2])
    expect(deserialize(serialize(game))).toEqual(game)
    for (const recordedAt of [-1, NaN, Infinity, 'yesterday']) {
      expect(() => migrate({ ...game, log: game.log.map((event) => ({ ...event, recordedAt })) })).toThrow(InvalidSavedGame)
    }
  })

  test.each(Object.keys(fixtures).map(Number))('a version %i game opens at the current version', (version) => {
    const game = migrate(fixtures[version])
    expect(game.version).toBe(SAVED_VERSION)
    expect(game.log.map((e) => e.id)).toEqual(game.log.map((_, i) => i))
    expect(reduce(game.script, game.log).seats.length).toBe(2)
  })

  test('the current version passes through unchanged', () => {
    const game = newGame('tb', 1)
    expect(migrate(JSON.parse(JSON.stringify(game)))).toEqual(game)
  })

  test('version 4 retires board notes and their removals without changing event references', () => {
    const base = migrate(fixtures[4])
    const original = { id: 3, audience: 'storyteller', recordedAt: 4000, kind: 'placeToken', token: ['note', ''], note: 'Remember this' }
    const removal = { id: 4, audience: 'storyteller', kind: 'removeToken', placedBy: 3 }
    const ordinary = { id: 5, audience: 'storyteller', kind: 'placeToken', token: ['poisoner', 'Poisoned'], source: 'sb2' }
    const saved = migrate({ ...base, version: 4, log: [...base.log, original, removal, ordinary] })
    expect(saved.log.slice(3).map((event) => event.kind)).toEqual(['override', 'override', 'override'])
    expect(saved.log[3]).toMatchObject({ id: 3, audience: 'storyteller', recordedAt: 4000, note: 'Retired board reminder: note: Remember this' })
    expect(saved.log[4]).toMatchObject({ id: 4, note: 'Removed board reminder: note: Remember this' })
    expect(saved.log[5]).toMatchObject({ note: 'Retired board reminder: poisoner / Poisoned' })
    expect(saved.log.map((event) => event.id)).toEqual([0, 1, 2, 3, 4, 5])
    const board = reduce(saved.script, saved.log)
    expect(board).not.toHaveProperty('board')
    expect(board.seats.every((seat) => seat.tokens.length === 0)).toBe(true)
    expect(deserialize(serialize(saved))).toEqual(saved)
  })

  test('version 4 moves ability markers to their source, keeping their placement and removal ids', () => {
    const built = buildGame('bmr').seat('Ann', 'minstrel').seat('Bob', 'fanggu').night(1, [
      token('Ann', 'minstrel/Everyone Is Drunk', 'Ann'), token('Bob', 'fanggu/Once', 'Bob'),
    ]).build()
    const legacy = built.log.map((event) => {
      if (event.kind !== 'placeToken') return event
      const { seat: _seat, ...rest } = event
      return rest
    })
    const saved = migrate({ ...newGame('bmr', 0), version: 4, log: legacy })
    expect(saved.log.map(({ decisionsHandled: _handled, ...event }) => event)).toEqual(built.log)
    const board = reduce(saved.script, saved.log)
    expect(board.seats[0]?.tokens).toMatchObject([{ def: ['minstrel', 'Everyone Is Drunk'], placedBy: 3 }])
    expect(board.seats[1]?.tokens).toMatchObject([{ def: ['fanggu', 'Once'], placedBy: 4 }])
    const removed = migrate({ ...saved, version: 4, log: [...legacy, { id: 5, audience: 'storyteller', kind: 'removeToken', placedBy: 3 }] })
    expect(reduce(removed.script, removed.log).seats[0]?.tokens).toEqual([])
    expect(reduce(saved.script, saved.log.slice(0, 3)).seats.every((seat) => seat.tokens.length === 0)).toBe(true)
  })

  test('a version 10 game opens at the current version with its log untouched', () => {
    const log = [
      { id: 0, audience: 'storyteller', kind: 'addSeat', seat: 'sa1', name: 'Ann', at: 0, character: 'poisoner', alignment: 'evil' },
      { id: 1, audience: 'storyteller', kind: 'addSeat', seat: 'sb2', name: 'Bob', at: 1, character: 'chef', alignment: 'good' },
    ]
    const saved = migrate({ ...newGame('tb', 1), version: 10, log })
    expect(saved.version).toBe(SAVED_VERSION)
    expect(saved.log).toEqual(log)
  })

  test('current saves cannot place a reminder without a player', () => {
    for (const seat of [undefined, '', 'storyteller', null]) {
      expect(() => migrate({ ...newGame('tb', 0), log: [{ id: 0, audience: 'storyteller', kind: 'placeToken', token: ['note', ''], seat }] })).toThrow(InvalidSavedGame)
    }
  })

  test('a newer version is refused', () => {
    expect(() => migrate({ ...newGame('tb', 1), version: SAVED_VERSION + 1 })).toThrow(InvalidSavedGame)
  })

  test('a malformed log is refused', () => {
    const game = newGame('tb', 1)
    expect(() => migrate({ ...game, log: [{ id: 3, kind: 'phase', to: 'night', audience: 'storyteller' }] })).toThrow(InvalidSavedGame)
    expect(() => migrate({ ...game, log: [{ id: 0, audience: 'storyteller' }] })).toThrow(InvalidSavedGame)
    expect(() => migrate({ ...game, log: 'phase' })).toThrow(InvalidSavedGame)
    expect(() => migrate('not a game')).toThrow(InvalidSavedGame)
  })

  test('a night progress event names a known marker, and a silent step its seat', () => {
    const game = newGame('tb', 1)
    const progress = (extra: object) => ({ ...game, log: [{ id: 0, audience: 'storyteller', kind: 'nightProgress', ...extra }] })
    expect(migrate(progress({ marker: 'step', seat: 'sa1', step: 12 })).log).toHaveLength(1)
    expect(() => migrate(progress({ marker: 'seat' }))).toThrow(InvalidSavedGame)
    expect(() => migrate(progress({ marker: 'step', seat: '' }))).toThrow(InvalidSavedGame)
    expect(() => migrate(progress({ marker: 'step', step: 'twelve' }))).toThrow(InvalidSavedGame)
  })

  test('a script is an edition id or a whole custom script', () => {
    const game = newGame('tb', 1)
    expect(() => migrate({ ...game, script: { kind: 'custom', items: [] } })).toThrow(InvalidSavedGame)
    expect(() => migrate({ ...game, script: 7 })).toThrow(InvalidSavedGame)
  })
})

describe('serialize and deserialize', () => {
  const script: CustomScript = {
    kind: 'custom',
    name: 'Two of ours',
    items: [{ id: '_meta', name: 'Two of ours' }, 'imp', 'chef', { id: 'lamplighter', name: 'Lamplighter', team: 'townsfolk', ability: 'You know things.' }],
  }

  test('a game round-trips through its file form, custom script embedded whole', () => {
    const game = newGame(script, 1)
    const back = deserialize(serialize(game))
    expect(back).toEqual(game)
    expect(back.script).toEqual(script)
  })

  test('the deletion flag stays behind', () => {
    const game = { ...newGame('tb', 1), deletedAt: 5 }
    expect(deserialize(serialize(game))).not.toHaveProperty('deletedAt')
  })

  test('a file that is not JSON or not a game is refused', () => {
    expect(() => deserialize('{')).toThrow(InvalidSavedGame)
    expect(() => deserialize('[]')).toThrow(InvalidSavedGame)
    expect(() => deserialize(JSON.stringify({ ...newGame('tb', 1), version: SAVED_VERSION + 1 }))).toThrow(InvalidSavedGame)
  })
})

describe('contentMismatch', () => {
  test('a game on the bundled content reports nothing', () => {
    expect(contentMismatch(newGame('tb', 1))).toBeUndefined()
  })

  test('a game on other content reports both pins', () => {
    const saved = { release: 'old', translations: contentPin.translations }
    expect(contentMismatch({ ...newGame('tb', 1), content: saved })).toEqual({ saved, current: contentPin })
  })
})
