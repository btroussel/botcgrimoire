import { game } from '../../engine/testing/board'
import { playersOn } from './players'

test('good groups Townsfolk before Outsiders and evil groups Demons before Minions', () => {
  const { g } = game().seat('Saint', 'saint').seat('Baron', 'baron').seat('Chef', 'chef').seat('Imp', 'imp').seat('Monk', 'monk').build()
  expect(playersOn(g.seats, 'good').map((seat) => seat.name)).toEqual(['Chef', 'Monk', 'Saint'])
  expect(playersOn(g.seats, 'evil').map((seat) => seat.name)).toEqual(['Imp', 'Baron'])
})

test('changed alignments choose the column, with seating order preserved within a team', () => {
  const { g } = game().seat('Evil Chef', 'chef', { alignment: 'evil' }).seat('Good Imp', 'imp', { alignment: 'good' }).seat('Baron', 'baron').build()
  expect(playersOn(g.seats, 'good').map((seat) => seat.name)).toEqual(['Good Imp'])
  expect(playersOn(g.seats, 'evil').map((seat) => seat.name)).toEqual(['Baron', 'Evil Chef'])
})
