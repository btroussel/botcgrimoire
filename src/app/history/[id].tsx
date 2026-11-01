import { useLocalSearchParams } from 'expo-router'

import { GameHistoryScreen } from '../../features/history/GameHistoryScreen'

// Keep existing saved detail links useful while history now expands in place.
export default function GameDetailsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <GameHistoryScreen initialExpandedId={id} />
}
