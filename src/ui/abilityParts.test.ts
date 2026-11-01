import { abilityParts } from './abilityParts'

test('the bracketed setup change is set apart with its brackets and the wording survives', () => {
  expect(abilityParts('There are extra Outsiders in play. [+2 Outsiders]')).toEqual([
    { setup: false, text: 'There are extra Outsiders in play. ' },
    { setup: true, text: '[+2 Outsiders]' },
  ])
  expect(abilityParts('[No Demon] then [X Outsiders].')).toEqual([
    { setup: true, text: '[No Demon]' }, { setup: false, text: ' then ' },
    { setup: true, text: '[X Outsiders]' }, { setup: false, text: '.' },
  ])
  expect(abilityParts('Each night*, choose a player: they die.')).toEqual([{ setup: false, text: 'Each night*, choose a player: they die.' }])
  expect(abilityParts('A missing opening bracket stays plain.]')).toEqual([{ setup: false, text: 'A missing opening bracket stays plain.]' }])
  expect(abilityParts('An unclosed [bracket stays plain.')).toEqual([{ setup: false, text: 'An unclosed [bracket stays plain.' }])
  expect(abilityParts('')).toEqual([])
})
