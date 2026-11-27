import { useLocalSearchParams } from 'expo-router'

import { GameScreen } from '../../features/history/GameScreen'

// One saved game on its own page, at the address older detail links already use.
export default function GameRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <GameScreen key={id} id={id} />
}
