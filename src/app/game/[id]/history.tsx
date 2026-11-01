// Existing replay links open the board's timeline.
import { Redirect, useLocalSearchParams } from 'expo-router'

export default function HistoryRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <Redirect href={`/game/${id}?replay=1`} />
}
