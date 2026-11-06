// The contract between the board and whatever renders into its panel. The board screen
// (features/board) provides this context; the day panel (features/day) uses it to choose the
// nominator, open the vote in the ring's centre and draw the count's route, without importing the
// board, and to open a Traveller's exile from the seat menu. The card and seat-pick requests serve the board's own Show a card. It
// lives in ui/ because it is the one shape two features share and neither may import the other
// (docs/app.md); ui/ knows no engine type, so a seat is a plain string id here, and a card is the
// props the Card piece takes and nothing about the event it will append.
//
// A request: `requestSeats` puts the ring in pick mode, with no prompt or phase controls. Only
// `allowed` seats take a tap. The board calls `pickSeat` on a ring tap, which completes the
// request and hands that seat to `onDone`; `cancelRequest` clears it. The board hides the phase
// window while a pick is open, so the whole ring is reachable.
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export type CardKind =
  | 'youAre'
  | 'thisIsTheDemon'
  | 'theseAreYourMinions'
  | 'notInPlay'
  | 'selectedYou'
  | 'thisPlayerIs'
  | 'tokenOnly'
  | 'custom'

// A character on a card: its id for the art and its name in the locale for the arc or the
// caption. The name travels with the id because ui/ has no locale and the card is the one screen
// a player reads, so a French table must never see an English name there.
export interface PrintedCharacter {
  readonly id: string
  readonly name: string
}

// What the Card piece draws: the words in display.hero, the printed tokens under them, the tint
// the player is meant to see (a disguised seat's believed side, never the truth).
export interface CardSpec {
  readonly kind: CardKind
  readonly words: string // empty for the tokens alone
  readonly characters?: readonly PrintedCharacter[] // drawn as printed tokens, left to right
  readonly tint?: 'good' | 'evil'
  readonly caption?: string // a seat's name under the token, for THIS PLAYER IS
}

// One seat to pick from those allowed; the first tap on one completes it.
export interface SeatRequest {
  readonly allowed: readonly string[]
  readonly onDone: (seat: string) => void
}

export interface SeatAction {
  // The phase's default seat tap, overridden temporarily by an explicit pick request.
  readonly allowed: readonly string[]
  readonly marked: readonly string[]
  readonly markedLabel?: string
  readonly onTap: (seat: string) => void
}

// The count on the ring: the route from the nominee round to them again, lit up to the last hand.
export interface VoteArc {
  readonly nominee: string
  readonly reached: string | undefined // the furthest seat round from the nominee with a recorded hand
  readonly label: string
}

export interface BoardInteraction {
  readonly nominate: ((by: string, of: string) => void) | undefined
  readonly setNominate: (handler: ((by: string, of: string) => void) | undefined) => void
  readonly exile: ((of: string) => void) | undefined
  readonly setExile: (handler: ((of: string) => void) | undefined) => void
  readonly centerPanel: ReactNode
  readonly setCenterPanel: (panel: ReactNode) => void
  readonly voteArc: VoteArc | undefined
  readonly setVoteArc: (arc: VoteArc | undefined) => void
  readonly seatAction: SeatAction | undefined
  readonly setSeatAction: (action: SeatAction | undefined) => void
  // The panel side.
  readonly requestSeats: (request: SeatRequest) => void
  readonly cancelRequest: () => void
  readonly showCard: (card: CardSpec) => void
  // The board side.
  readonly pick: SeatRequest | undefined
  readonly pickSeat: (seatId: string) => void
  readonly card: CardSpec | undefined
  readonly closeCard: () => void
}

const Context = createContext<BoardInteraction | undefined>(undefined)

export const BoardInteractionProvider = ({ children }: { readonly children: ReactNode }) => {
  const [nominate, setNominateState] = useState<((by: string, of: string) => void)>()
  const setNominate = useCallback((handler: ((by: string, of: string) => void) | undefined) => setNominateState(() => handler), [])
  const [exile, setExileState] = useState<((of: string) => void)>()
  const setExile = useCallback((handler: ((of: string) => void) | undefined) => setExileState(() => handler), [])
  const [centerPanel, setCenterPanel] = useState<ReactNode>(null)
  const [voteArc, setVoteArc] = useState<VoteArc>()
  const [seatAction, setSeatAction] = useState<SeatAction>()
  // The pick is mirrored in a ref so `onDone` runs once, outside a state updater, which React
  // may call twice in development.
  const [pick, setPickState] = useState<SeatRequest | undefined>(undefined)
  const pickRef = useRef<SeatRequest | undefined>(undefined)
  const setPick = useCallback((next: SeatRequest | undefined) => {
    pickRef.current = next
    setPickState(next)
  }, [])
  const [card, setCard] = useState<CardSpec | undefined>(undefined)

  const requestSeats = useCallback((request: SeatRequest) => setPick(request), [setPick])

  const cancelRequest = useCallback(() => {
    if (pickRef.current) setPick(undefined)
  }, [setPick])

  const pickSeat = useCallback(
    (seatId: string) => {
      const current = pickRef.current
      if (!current || !current.allowed.includes(seatId)) return
      setPick(undefined)
      current.onDone(seatId)
    },
    [setPick],
  )

  const showCard = useCallback((spec: CardSpec) => setCard(spec), [])
  const closeCard = useCallback(() => setCard(undefined), [])

  const value = useMemo<BoardInteraction>(
    () => ({
      nominate, setNominate, exile, setExile, centerPanel, setCenterPanel, voteArc, setVoteArc,
      seatAction,
      setSeatAction,
      requestSeats,
      cancelRequest,
      showCard,
      pick,
      pickSeat,
      card,
      closeCard,
    }),
    [nominate, setNominate, exile, setExile, centerPanel, voteArc, seatAction, requestSeats, cancelRequest, showCard, pick, pickSeat, card, closeCard],
  )

  return <Context.Provider value={value}>{children}</Context.Provider>
}

export const useBoardInteraction = (): BoardInteraction => {
  const value = useContext(Context)
  if (!value) throw new Error('useBoardInteraction needs a BoardInteractionProvider above it')
  return value
}
