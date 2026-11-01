export interface Counts {
  readonly townsfolk: number
  readonly outsiders: number
  readonly minions: number
  readonly demon: number
}

// The base table, five to fifteen players, travellers not counted. Outsiders cycle 0, 1, 2 as
// the count grows, Townsfolk take the rest, and a Minion joins every third player from ten.
export const baseCounts = (players: number): Counts | undefined => {
  if (!Number.isInteger(players) || players < 5 || players > 15) return undefined
  if (players < 7) return { townsfolk: 3, outsiders: players - 5, minions: 1, demon: 1 }
  const minions = Math.floor((players - 7) / 3) + 1
  const outsiders = (players - 7) % 3
  return { townsfolk: players - outsiders - minions - 1, outsiders, minions, demon: 1 }
}
