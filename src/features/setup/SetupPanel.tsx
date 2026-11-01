import { useContext, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import type { CharacterId } from '../../content'
import { isEmptySeat } from '../../content'
import { useStore } from '../../store'
import { listed } from '../../store/scriptSheet'
import { Button } from '../../ui/Button'
import { Panel, PanelVisibilityContext } from '../../ui/Panel'
import { Token } from '../../ui/Token'
import { space, touch } from '../../ui/theme'
import { BagPicker, ShownPicker } from './BagPicker'
import { canDiscover } from './discovery'
import { bagContents, bagDisguises, dealDraw, dealTaken, drawTurns, nextDrawer, refillBag, showAs } from './draw'

export const SetupPanel = () => {
  const { board, session, settings, t, appendAll, setDraw } = useStore()
  const visibility = useContext(PanelVisibilityContext)
  const router = useRouter()
  const [picking, setPicking] = useState(false)
  // The token whose shown character is being chosen, kept while its picker closes.
  const [choosing, setChoosing] = useState<{ readonly at: number; readonly open: boolean }>()
  if (!board) return null
  const roles = listed(board.script, settings.locale)
  const nameOf = (id: CharacterId) => roles.find(role => role.id === id)?.name ?? id
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
  const disguises = bag ? bagDisguises(board, bag, roles).filter(open => open.choices.length > 0) : []
  const editing = disguises.find(open => open.at === choosing?.at)
  const choose = (to: CharacterId | undefined) => {
    const next = bag && editing ? showAs(board, bag, editing.at, to, roles) : undefined
    if (next) setDraw(next)
    setChoosing(current => current && { ...current, open: false })
  }
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
    {/* Each disguise in the bag shows a random character unless the Storyteller picks one. */}
    {disguises.map(open => <View key={open.at} style={styles.disguise}>
      <View aria-hidden><Token size={touch} character={open.character} /></View>
      <Button surface="paper" style={styles.grow} onPress={() => setChoosing({ at: open.at, open: true })}
        label={t('setup.disguise', { name: nameOf(open.character), shown: open.chosen ? nameOf(open.chosen) : t('setup.disguiseRandom') })} />
    </View>)}
    <BagPicker visible={picking} onClose={() => setPicking(false)} script={board.script} count={room}
      selected={faceDown.map(token => token.character)}
      onFill={characters => { setDraw(refillBag(board, bag, characters, roles)); setPicking(false) }} />
    <ShownPicker visible={!!choosing?.open && !!editing} name={editing ? nameOf(editing.character) : ''}
      choices={editing ? editing.choices.flatMap(id => roles.find(role => role.id === id) ?? []) : []} chosen={editing?.chosen}
      onClose={() => setChoosing(current => current && { ...current, open: false })} onChoose={choose} />
  </Panel>
}

const styles = StyleSheet.create({
  disguise: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  grow: { flex: 1, minWidth: 0 },
})
