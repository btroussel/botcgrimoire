import { useRouter } from 'expo-router'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'

import type { SavedGame } from '../../store'
import { useStore } from '../../store'
import { replayStart } from '../../store/replay'

// Resume and Replay, from the list and from a game's page: the game is opened if another one is
// in the session, then the board is shown live or at the start of its replay.
export const useLaunch = () => {
  const store = useStore()
  const router = useRouter()
  const [openingId, setOpeningId] = useState<string>()
  const [failedId, setFailedId] = useState<string>()

  const openGame = async (game: SavedGame, replay: boolean) => {
    if (openingId) return
    setFailedId(undefined)
    setOpeningId(game.id)
    try {
      if (store.session?.game.id !== game.id && !await store.open(game.id)) {
        setFailedId(game.id)
        return
      }
      if (replay) {
        store.lookAt(replayStart(game.log))
        router.push(`/game/${game.id}?replay=1`)
      } else {
        store.returnToPresent()
        router.push(`/game/${game.id}`)
      }
    } catch {
      setFailedId(game.id)
    } finally {
      setOpeningId(undefined)
    }
  }

  // The rows get a handler that never changes; launching reads this render's session through a ref.
  const latest = useRef(openGame)
  useLayoutEffect(() => { latest.current = openGame })
  const launch = useCallback((game: SavedGame, replay: boolean) => void latest.current(game, replay), [])
  return { launch, openingId, failedId }
}
