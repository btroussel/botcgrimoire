// Each player draws their own token from the face-down bag, so nobody can feel the Storyteller
// chose for them. The device goes round in seating order; the Storyteller then deals what was
// drawn, and the board opens on the deal.
import { useKeepAwake } from 'expo-keep-awake'
import { useIsFocused, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { StyleSheet, Text } from 'react-native'

import type { GameId } from '../../store'
import { useStore } from '../../store'
import { listed } from '../../store/scriptSheet'
import { Button } from '../../ui/Button'
import { Screen } from '../../ui/Screen'
import { palette, type } from '../../ui/theme'
import { discoveryName } from './discovery'
import { Handoff, Player } from './DiscoveryScreen'
import { dealDraw, drawPlayer, drawRunsShort, nextDrawer, takeToken } from './draw'
import { askForShakes } from './shake'

export const DrawScreen = ({ id, cursor }: { readonly id: string; readonly cursor: string }) => {
  const store = useStore()
  const router = useRouter()
  const focused = useIsFocused()
  const [missing, setMissing] = useState(false)
  const [returning, setReturning] = useState(false)
  const open = store.session?.game.id === id
  const { open: openGame, t } = store
  const locale = store.settings.locale
  useKeepAwake(undefined, { suppressDeactivateWarnings: true })
  useEffect(() => {
    if (open || !focused) return
    let active = true
    void openGame(id as GameId).then(found => { if (active) setMissing(!found) })
    return () => { active = false }
  }, [id, open, focused, openGame])

  const leave = () => router.setParams({ draw: '' })
  const header = { title: t('setup.draw'), contentMax: 800 }
  const board = open ? store.board : undefined
  const draw = open ? store.session?.game.draw : undefined
  const permitted = board && draw && store.session?.lookingAt === undefined && board.clock.phase === 'setup' ? { board, draw } : undefined
  const roles = permitted ? listed(permitted.board.script, locale) : []
  const player = permitted ? drawPlayer(permitted.board, permitted.draw, cursor, locale, roles) : undefined
  const first = permitted ? nextDrawer(permitted.board, permitted.draw) : undefined
  const short = permitted ? drawRunsShort(permitted.board, permitted.draw) : false
  const deal = () => {
    if (!permitted) return
    store.appendAll(dealDraw(permitted.board, permitted.draw, Math.random, roles))
    store.setDraw(undefined)
    router.setParams({ draw: '', deal: '1' })
  }

  // Only the Storyteller holds the device here, so this is the one screen with a way straight back.
  if (permitted && cursor === 'ready' && first) return <Screen {...header} onBack={leave} backLabel={t('setup.discoveryBack')}>
    <Handoff key="ready">
      <Text accessibilityRole="header" style={[type.display.title, styles.center, { color: palette.text }]}>{t('setup.discoveryReady')}</Text>
      <Text style={[type.text.body, styles.center, { color: palette.text }]}>{t('setup.drawIntro')}</Text>
      <Button label={t('setup.discoveryStart', { name: permitted.board.seats.find(seat => seat.id === first)?.name ?? '' })}
        variant="primary" onPress={() => { askForShakes(); router.setParams({ draw: first }) }} />
    </Handoff>
  </Screen>

  // A player may still hold the device, so the board opens only from a button that warns them.
  if (permitted && (cursor === 'done' || (cursor === 'ready' && !first))) return <Screen {...header}>
    <Handoff key="done">
      <Text accessibilityRole="header" style={[type.display.title, styles.center, { color: palette.text }]}>{t(short ? 'setup.drawEmptied' : 'setup.drawComplete')}</Text>
      <Text style={[type.text.body, styles.center, { color: palette.text }]}>{short ? `${t('setup.drawDealHelp')} ${t('setup.drawEmptySeats')}` : t('setup.drawDealHelp')}</Text>
      <Button label={t('setup.drawDeal')} onPress={deal} variant="primary" />
    </Handoff>
  </Screen>

  if (permitted && returning) return <Screen {...header}>
    <Handoff key="return">
      <Text accessibilityRole="header" style={[type.display.title, styles.center, { color: palette.text }]}>{t('setup.discoveryReturn')}</Text>
      <Text style={[type.text.body, styles.center, { color: palette.text }]}>{t('setup.drawReturnHelp')}</Text>
      <Button label={t('setup.manualOpen')} onPress={leave} variant="primary" />
      {player ? <Button label={t('setup.drawResume')} onPress={() => setReturning(false)} variant="text" /> : null}
    </Handoff>
  </Screen>

  if (!permitted || !player) return <Screen {...header}>
    <Handoff key="unavailable">
      <Text style={[type.display.title, styles.center, { color: palette.text }]}>{
        missing ? t('board.missing') : !board ? t('common.loading') : t('setup.drawUnavailable')
      }</Text>
      <Button label={t('setup.discoveryBack')} onPress={leave} variant="primary" />
    </Handoff>
  </Screen>

  return <Player key={`${player.id}:${locale}`} player={player} title={t('setup.draw')} t={t}
    bag={{ free: player.free, onTake: at => {
      const next = takeToken(permitted.board, permitted.draw, player.id, at)
      if (next) store.setDraw(next)
      return !!next
    } }}
    onBack={() => setReturning(true)}
    onName={draft => { const event = discoveryName(player.id, player.name, draft); if (event) store.append(event) }}
    onNext={() => router.setParams({ draw: player.next ?? 'done' })} />
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
})
