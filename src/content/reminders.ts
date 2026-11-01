import type { Reminder } from './types'

// Upstream lists a token once per copy, so counting the names is how a Pukka gets two Poisoned.
// A homebrew record follows the same schema, so it counts its tokens the same way.
export const expandReminders = (
  names: readonly string[],
  globals: readonly string[],
): Reminder[] => {
  const out = new Map<string, Reminder>()
  const add = (name: string, global: boolean) => {
    const seen = out.get(name)
    if (seen) {
      out.set(name, { ...seen, count: seen.count + 1 })
      return
    }
    out.set(name, {
      name,
      count: 1,
      global,
    })
  }
  names.forEach((n) => add(n, false))
  globals.filter((n) => n !== '').forEach((n) => add(n, true))
  return [...out.values()]
}
