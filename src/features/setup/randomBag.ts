import type { CharacterId, Team } from '../../content'
import { baseCounts } from '../../engine'

export interface BagRole {
  readonly id: CharacterId
  readonly team: Team
}

export const shuffled = <T,>(items: readonly T[], random = Math.random): T[] => {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }
  return result
}

function* combinations<T>(items: readonly T[], count: number, from = 0): Generator<readonly T[]> {
  if (count === 0) { yield []; return }
  for (let i = from; i <= items.length - count; i++) {
    for (const rest of combinations(items, count - 1, i + 1)) yield [items[i]!, ...rest]
  }
}

// A script listing fewer Minions than the setup needs repeats them, as one whose Minions are all
// Witches asks; otherwise each Minion is distinct.
const minionSets = <T,>(minions: readonly T[], count: number): Iterable<readonly T[]> =>
  minions.length >= count ? combinations(minions, count)
    : minions.length > 0 ? [Array.from({ length: count }, (_, i) => minions[i % minions.length]!)] : []

const goodModifiers = new Set(['balloonist', 'huntsman', 'choirboy', 'hermit', 'villageidiot'])
const primaryTeams = new Set<Team>(['townsfolk', 'outsider', 'minion', 'demon'])

// Search only the characters that change selection, then fill from shuffled ordinary roles.
// Trying alternatives, rather than retrying random bags, also works with a constant test RNG
// and finds the remaining legal choice on a script with very few characters.
export const randomBag = (roles: readonly BagRole[], count: number, random = Math.random): readonly CharacterId[] | undefined => {
  if (!Number.isInteger(count) || count < 1 || count > 20) return undefined
  const pool = shuffled([...new Map(roles.map(role => [role.id, role])).values()], random)
  const players = Math.min(count, 15)
  const base = baseCounts(players)
  if (!base) return pool.filter(role => primaryTeams.has(role.team) && role.id !== 'lilmonsta').slice(0, count).map(role => role.id)
  const travellers = pool.filter(role => role.team === 'traveller').slice(0, count - players)
  if (travellers.length !== count - players) return undefined

  const modifiers = pool.filter(role => goodModifiers.has(role.id))
  const selections = shuffled(Array.from({ length: 2 ** modifiers.length }, (_, mask) =>
    modifiers.filter((_, i) => (mask & (1 << i)) !== 0)), random)
  const ordinaryGood = pool.filter(role => (role.team === 'townsfolk' || role.team === 'outsider')
    && !goodModifiers.has(role.id) && role.id !== 'atheist')
  const modes = pool.filter(role => role.team === 'demon' || role.id === 'atheist' || role.id === 'summoner')

  for (const mode of modes) {
    const atheist = mode.id === 'atheist'
    const summoner = mode.id === 'summoner'
    const legion = mode.id === 'legion'
    const monsta = mode.id === 'lilmonsta'
    const kazali = mode.id === 'kazali'
    const typhon = mode.id === 'lordoftyphon'
    const demonCount = atheist || summoner || monsta ? 0 : legion ? players - base.minions - 1 : 1
    const minionCount = atheist || legion || kazali ? 0 : base.minions + (monsta || typhon ? 1 : 0)
    const availableMinions = pool.filter(role => role.team === 'minion' && role.id !== 'summoner'
      // These jinxes introduce the Marionette after a Demon exists and has a neighbour.
      && (!(summoner || monsta) || role.id !== 'marionette'))
    const goodCount = players - demonCount - minionCount
    const variableOutsiders = atheist || legion || kazali || typhon

    for (const otherMinions of minionSets(availableMinions, minionCount - (summoner ? 1 : 0))) {
      const minions = summoner ? [mode, ...otherMinions] : otherMinions
      const hasMinion = (id: string) => minions.some(role => role.id === id)
      for (const selected of selections) {
        const hasGood = (id: string) => selected.some(role => role.id === id)
        const required = [...selected, ...(atheist ? [mode] : [])]
        let missingCompanion = false
        for (const [source, companion] of [['huntsman', 'damsel'], ['choirboy', 'king']] as const) {
          if (!hasGood(source)) continue
          const role = ordinaryGood.find(role => role.id === companion)
          if (role) required.push(role)
          else missingCompanion = true
        }
        if (missingCompanion) continue

        let outsiderCounts: number[]
        if (variableOutsiders || hasMinion('xaan')) {
          // Xaan replaces, rather than adds to, the other Outsider modifiers.
          outsiderCounts = Array.from({ length: goodCount + 1 }, (_, i) => i)
        } else {
          outsiderCounts = [base.outsiders + (hasMinion('baron') ? 2 : 0) + (mode.id === 'fanggu' ? 1 : 0)]
          if (hasMinion('godfather')) outsiderCounts = outsiderCounts.flatMap(n => [n - 1, n + 1])
          if (hasGood('balloonist')) outsiderCounts = outsiderCounts.flatMap(n => [n, n + 1])
          if (hasGood('hermit')) outsiderCounts = outsiderCounts.flatMap(n => [n, n - 1])
          outsiderCounts = outsiderCounts.filter(n => n >= 0)
          // The Vigormortis cannot remove an Outsider when there are none.
          if (mode.id === 'vigormortis') outsiderCounts = outsiderCounts.map(n => Math.max(0, n - 1))
          // A Damsel can occupy an existing Outsider slot or replace another Townsfolk.
          if (hasGood('huntsman')) outsiderCounts = outsiderCounts.flatMap(n => [n, n + 1])
        }

        const requiredTownsfolk = required.filter(role => role.team === 'townsfolk')
        const requiredOutsiders = required.filter(role => role.team === 'outsider')
        const remaining = ordinaryGood.filter(role => !required.includes(role))
        const townsfolk = remaining.filter(role => role.team === 'townsfolk')
        const outsiders = remaining.filter(role => role.team === 'outsider')
        const villageIdiot = selected.find(role => role.id === 'villageidiot')
        for (const outsiderCount of shuffled([...new Set(outsiderCounts)], random)) {
          for (const extras of villageIdiot ? shuffled([0, 1, 2], random) : [0]) {
            const takeTownsfolk = goodCount - outsiderCount - requiredTownsfolk.length - extras
            const takeOutsiders = outsiderCount - requiredOutsiders.length
            if (takeTownsfolk < 0 || takeOutsiders < 0 || takeTownsfolk > townsfolk.length || takeOutsiders > outsiders.length) continue
            return [
              ...required,
              ...Array.from({ length: extras }, () => villageIdiot!),
              ...townsfolk.slice(0, takeTownsfolk),
              ...outsiders.slice(0, takeOutsiders),
              ...minions,
              // Lil' Monsta stays selected as a loose character, outside the player count.
              ...Array.from({ length: monsta ? 1 : demonCount }, () => mode),
              ...travellers,
            ].map(role => role.id)
          }
        }
      }
    }
  }
  return undefined
}
