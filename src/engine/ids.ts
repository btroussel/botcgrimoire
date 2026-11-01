// Branded ids (docs/engine.md). A seat id is minted when the seat is added and never reused
// within a game; an event id is the event's index in the log. A character id is content's.
export type SeatId = string & { readonly __brand: 'SeatId' }
export type EventId = number & { readonly __brand: 'EventId' }

export const asSeatId = (id: string): SeatId => id as SeatId
export const asEventId = (index: number): EventId => index as EventId

// A prefix and random lowercase letters and digits, which an address and the script schema's
// ids both accept.
export const randomId = (prefix: string, length: number): string => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let out = prefix
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

// Seat ids are short random strings rather than a counter so that two seats added after an undo
// and a redo can never collide with one the log already names.
export const mintSeatId = (): SeatId => randomId('s', 6) as SeatId
