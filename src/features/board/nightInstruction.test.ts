import { nightInstruction } from './nightInstruction'

test('upstream wording and spaces survive while emphasis and reminder markers retain their positions', () => {
  expect(nightInstruction('Choose. :reminder: :reminder: If yes: show *THIS TOKEN*.')).toEqual([
    { kind: 'text', text: 'Choose. ' }, { kind: 'reminder' }, { kind: 'text', text: ' ' },
    { kind: 'reminder' }, { kind: 'text', text: ' If yes: show ' },
    { kind: 'emphasis', text: 'THIS TOKEN' }, { kind: 'text', text: '.' },
  ])
  expect(nightInstruction('  No formatting.\n')).toEqual([{ kind: 'text', text: '  No formatting.\n' }])
  expect(nightInstruction('An unmatched * stays.')).toEqual([{ kind: 'text', text: 'An unmatched * stays.' }])
})
