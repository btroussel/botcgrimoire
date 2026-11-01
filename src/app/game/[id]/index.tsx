import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { BoardScreen } from '../../../features/board/BoardScreen'
import { DayPanel } from '../../../features/day/DayPanel'
import { DayTimerSummary } from '../../../features/day/DayTimer'
import { SetupPanel } from '../../../features/setup/SetupPanel'
import { DiscoveryScreen } from '../../../features/setup/DiscoveryScreen'
import { DrawScreen } from '../../../features/setup/DrawScreen'

const panels = { setup: <SetupPanel />, night: null, day: <DayPanel />, over: null }
export default function GameRoute() {
  const { id, replay, discovery, draw, setup, deal } = useLocalSearchParams<{
    id: string; replay?: string; discovery?: string; draw?: string; setup?: string; deal?: string
  }>()
  const router = useRouter()
  // A new game with a bag opens on the setup window that deals it, and a finished draw opens on
  // the deal. The flags leave the address at once, so a reload opens the board as it stands.
  const [openSetup, setOpenSetup] = useState(setup === '1')
  const [dealing, setDealing] = useState(deal === '1')
  useEffect(() => { if (setup || deal) router.setParams({ setup: undefined, deal: undefined }) }, [setup, deal, router])
  // Discovery and the draw begin from the setup window, so leaving one lands back there, unless
  // the draw ended in the deal.
  const away = discovery || draw
  const [shown, setShown] = useState(away)
  if (shown !== away) {
    setShown(away)
    setOpenSetup(!!shown && !away && deal !== '1')
    setDealing(!away && deal === '1')
  }
  if (discovery) return <DiscoveryScreen key={id} id={id} cursor={discovery} />
  if (draw) return <DrawScreen key={id} id={id} cursor={draw} />
  return <BoardScreen key={id} id={id} replay={replay === '1'} openSetup={openSetup} deal={dealing} panels={panels} timer={<DayTimerSummary />} />
}
