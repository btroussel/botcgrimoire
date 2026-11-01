import { useContext, useState } from 'react'
import { useRouter } from 'expo-router'
import { isEmptySeat } from '../../content'
import { useStore } from '../../store'
import { listed } from '../../store/scriptSheet'
import { Button } from '../../ui/Button'
import { Panel, PanelVisibilityContext } from '../../ui/Panel'
import { BagPicker } from './BagPicker'
import { canDiscover } from './discovery'
import { bagContents, dealDraw, dealTaken, drawTurns, nextDrawer, refillBag } from './draw'

export const SetupPanel = () => {
  const { board, session, settings, t, appendAll, setDraw } = useStore()
  const visibility = useContext(PanelVisibilityContext)
  const router = useRouter()
  const [picking, setPicking] = useState(false)
  if (!board) return null
  const roles = listed(board.script, settings.locale)
  const empty = board.seats.filter(s => isEmptySeat(s.character))
  const ready = canDiscover(board)
  const live = session?.lookingAt === undefined
  const draw = live ? session?.game.draw : undefined
  // A bag waits until the seats it could fill are gone.
  const bag = draw && drawTurns(board, draw).length > 0 ? draw : undefined
  const started = bag ? nextDrawer(board, bag) !== drawTurns(board, bag)[0] : false
  const { taken, faceDown } = bag ? bagContents(board, bag) : { taken: [], faceDown: [] }
  // A refill leaves the players' own tokens alone, so it fills only the seats that have none.
  const room = empty.length - taken.length
  const status = t('setup.assignedCount', { have: board.seats.length - empty.length, of: board.seats.length })
  return <Panel title={t('board.setup')} status={status}
    footer={<Button surface="paper" variant="primary" label={t('setup.startFirstNight')} disabled={!live}
      onPress={() => {
        appendAll([...(draw ? dealTaken(board, draw, roles) : []), { kind: 'phase', to: 'night', night: 1 }])
        if (draw) setDraw(undefined)
      }} />}>
    {bag ? <>
      <Button surface="paper" icon="players" label={t(started ? 'setup.drawResume' : 'setup.drawBegin')}
        onPress={() => router.setParams({ draw: 'ready' })} />
      {/* The window steps aside so the Storyteller watches the tokens land. */}
      <Button surface="paper" icon="shuffle" label={t('setup.dealRandom')} onPress={() => {
        appendAll(dealDraw(board, bag, Math.random, roles))
        setDraw(undefined)
        visibility?.onClose()
      }} />
    </> : null}
    {room > 0 ? <Button surface="paper" icon="character" label={t('setup.fillBag')} onPress={() => setPicking(true)} /> : null}
    {!bag ? <Button surface="paper" icon="show" label={t('setup.discoveryBegin')} disabled={!ready} explanation={t('setup.discoveryUnavailable')}
      onPress={() => router.setParams({ discovery: 'ready' })} /> : null}
    <BagPicker visible={picking} onClose={() => setPicking(false)} script={board.script} count={room}
      selected={faceDown.map(token => token.character)}
      onFill={characters => { setDraw(refillBag(board, bag, characters, roles)); setPicking(false) }} />
  </Panel>
}
