import { asEventId } from '../engine'
import { contentPin } from '../content'
import { deserialize, InvalidSavedGame, migrate, SAVED_VERSION, serialize } from './saved'
import { append, boardOf, openSession, undo } from './session'

// Version 14 has notes but no way to rewrite one.
const previousFormat = {
  version: 14, id: 'gnotes0001', createdAt: 1000, updatedAt: 2000,
  content: contentPin, script: 'tb', mode: 'free', playTime: [],
  log: [
    { id: 0, audience: 'storyteller', manual: true, kind: 'addSeat', seat: 'a', name: 'Alice', at: 0, character: 'imp', alignment: 'evil' },
    { id: 1, audience: 'storyteller', manual: true, kind: 'placeToken', seat: 'a', token: ['note', ''], note: 'Poisond?' },
    { id: 2, audience: 'storyteller', manual: true, kind: 'placeToken', seat: 'a', token: ['poisoner', 'Poisoned'] },
  ],
}

const notesOn = (session: ReturnType<typeof openSession>) => boardOf(session).seats[0]!.tokens.map(token => token.note ?? token.def[1])

test('version 14 migration preserves the log', () => {
  const saved = migrate(previousFormat)
  expect(saved.version).toBe(SAVED_VERSION)
  expect(saved.log).toEqual(previousFormat.log)
})

test('a rewritten note keeps its place in the stack, survives reload and undoes in one step', () => {
  const original = openSession(migrate(previousFormat))
  const edited = append(original, { kind: 'setNote', placedBy: asEventId(1), note: 'Poisoned?' }, 3000)
  expect(notesOn(edited)).toEqual(['Poisoned?', 'Poisoned'])
  expect(notesOn(openSession(deserialize(serialize(edited.game))))).toEqual(['Poisoned?', 'Poisoned'])
  expect(notesOn(undo(edited, 4000))).toEqual(['Poisond?', 'Poisoned'])
})

test('a blank rewrite or one naming a character reminder changes nothing', () => {
  const original = openSession(migrate(previousFormat))
  const blank = append(original, { kind: 'setNote', placedBy: asEventId(1), note: '  ' }, 3000)
  const reminder = append(original, { kind: 'setNote', placedBy: asEventId(2), note: 'Drunk' }, 3000)
  expect(notesOn(blank)).toEqual(notesOn(original))
  expect(notesOn(reminder)).toEqual(notesOn(original))
})

test('saved rewrites name an earlier event and carry text', () => {
  const base = migrate(previousFormat)
  for (const [placedBy, note] of [[undefined, 'x'], [-1, 'x'], [3, 'x'], [1, ''], [1, ' '], [1, 4]]) {
    expect(() => migrate({ ...base, log: [...base.log, { id: 3, audience: 'storyteller', manual: true, kind: 'setNote', placedBy, note }] })).toThrow(InvalidSavedGame)
  }
})
