import { useKeepAwake } from 'expo-keep-awake'
import { useIsFocused, useRouter } from 'expo-router'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native'
import type { TextInputInstance, ViewInstance } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { character } from '../../content'
import { tokenArt } from '../../content/generated/art'
import type { GameId } from '../../store'
import { useStore } from '../../store'
import { Button, focusStyle, isFocused } from '../../ui/Button'
import { artFor } from '../../ui/CharacterIcon'
import { Enter } from '../../ui/Enter'
import { domElement, useFocusVisible } from '../../ui/focus'
import { Icon } from '../../ui/icons'
import { useReducedMotion } from '../../ui/motion'
import { preloadImage } from '../../ui/preloadArt'
import { Screen } from '../../ui/Screen'
import { motion, palette, radius, space, tabular, touch, type } from '../../ui/theme'
import { Token } from '../../ui/Token'
import { TokenBack } from './TokenBack'
import { TokenFlip } from './TokenFlip'
import { useLayoutViewport, useViewport } from '../../ui/Viewport'
import { canDiscover, discoveryName, discoveryPlayer } from './discovery'
import type { DiscoveryPlayer } from './discovery'
import { Spread } from './Spread'
import type { Lift } from './Spread'

export const DiscoveryScreen = ({ id, cursor }: { readonly id: string; readonly cursor: string }) => {
  const store = useStore()
  const router = useRouter()
  const focused = useIsFocused()
  const [missing, setMissing] = useState(false)
  const [returning, setReturning] = useState(false)
  const open = store.session?.game.id === id
  const { open: openGame, t } = store
  useKeepAwake(undefined, { suppressDeactivateWarnings: true })
  useEffect(() => {
    if (open || !focused) return
    let active = true
    void openGame(id as GameId).then(found => { if (active) setMissing(!found) })
    return () => { active = false }
  }, [id, open, focused, openGame])

  const leave = () => router.setParams({ discovery: '' })
  const header = { title: t('setup.discovery'), contentMax: 800 }
  const board = open ? store.board : undefined
  const permitted = board && store.session?.lookingAt === undefined && canDiscover(board)
  const player = permitted ? discoveryPlayer(board, cursor, store.settings.locale) : undefined

  // Only the Storyteller holds the device here, so this is the one screen with a way straight back.
  if (permitted && cursor === 'ready') return <Screen {...header} onBack={leave} backLabel={t('setup.discoveryBack')}>
    <Handoff key="ready">
      <Text accessibilityRole="header" style={[type.display.title, styles.center, { color: palette.text }]}>{t('setup.discoveryReady')}</Text>
      <Text style={[type.text.body, styles.center, { color: palette.text }]}>{t('setup.discoveryIntro')}</Text>
      <Button label={t('setup.discoveryStart', { name: board.seats[0]!.name })} variant="primary" onPress={() => router.setParams({ discovery: board.seats[0]!.id })} />
    </Handoff>
  </Screen>

  // A player may still hold the device, so the grimoire opens only from the button that warns them.
  if (permitted && (returning || cursor === 'done')) return <Screen {...header}>
    <Handoff key="return">
      <Text accessibilityRole="header" style={[type.display.title, styles.center, { color: palette.text }]}>{t(cursor === 'done' ? 'setup.discoveryComplete' : 'setup.discoveryReturn')}</Text>
      <Text style={[type.text.body, styles.center, { color: palette.text }]}>{t('setup.discoveryReturnHelp')}</Text>
      <Button label={t('setup.manualOpen')} onPress={leave} variant="primary" />
      {returning && player ? <Button label={t('setup.discoveryResume')} onPress={() => setReturning(false)} variant="text" /> : null}
    </Handoff>
  </Screen>

  if (!player) return <Screen {...header}>
    <Handoff key="unavailable">
      <Text style={[type.display.title, styles.center, { color: palette.text }]}>{
        missing ? t('board.missing') : !board ? t('common.loading') : t('setup.discoveryUnavailable')
      }</Text>
      <Button label={t('setup.discoveryBack')} onPress={leave} variant="primary" />
    </Handoff>
  </Screen>

  // A changed identity remounts covered; an ordinary rename preserves the current turn.
  return <Player key={`${player.id}:${player.character}:${player.alignment}:${store.settings.locale}`} player={player}
    title={t('setup.discovery')} t={t} onBack={() => setReturning(true)}
    onName={draft => { const event = discoveryName(player.id, player.name, draft); if (event) store.append(event) }}
    onNext={() => router.setParams({ discovery: player.next ?? 'done' })} />
}

// A phone on its side has no room for the token above the name, so the two sit side by side.
// The page decides: the keyboard shrinks only the visible view, and must not turn a portrait
// phone sideways. The window stands in until the page is first measured.
const useWide = () => {
  const window = useWindowDimensions()
  const page = useLayoutViewport()
  const width = page.width || window.width
  const height = page.height || window.height
  return { wide: width > height && height < 560, width, height }
}

// Above the name field's bottom edge, a portrait turn holds the header, the page and scene
// padding, the gap under the token and the field itself.
const aboveName = 180

// The covered back and the words around a handoff: the introduction, the return and the refusals.
export const Handoff = ({ children }: { readonly children: ReactNode }) => {
  const { wide, height } = useWide()
  return <Enter>
    <View style={[styles.scene, wide && styles.wideScene]}>
      <TokenBack size={wide ? Math.max(120, Math.min(200, height - 160)) : 200} />
      <View style={[styles.details, wide && styles.wideDetails]}>{children}</View>
    </View>
  </Enter>
}

// A turn shows a player's token. In a draw the player has none yet, and picks one from the
// face-down bag first: it rises from its place to full size and turns over.
type Identity = Pick<DiscoveryPlayer, 'character' | 'alignment' | 'roleName' | 'ability'>
export type Turn = Omit<DiscoveryPlayer, keyof Identity> & (Identity | { readonly character?: undefined })

export const Player = ({ player, title, t, onName, onNext, onBack, bag }: {
  readonly player: Turn
  readonly title: string
  readonly t: ReturnType<typeof useStore>['t']
  readonly onName: (name: string) => void
  readonly onNext: () => void
  readonly onBack: () => void
  readonly bag?: { readonly free: readonly boolean[]; readonly onTake: (at: number) => boolean }
}) => {
  const { wide, width, height } = useWide()
  const visible = useViewport().height
  const insets = useSafeAreaInsets()
  const [editing, setEditing] = useState(false)
  const upright = Math.min(360, width - 64, Math.max(280, height - 280))
  // While the name is typed, the token and the bag shrink to stay whole above the field and the
  // keyboard, and no further: a tablet has room for both, and a field that moves under the finger
  // as it is tapped loses the tap. They return to size on blur, before a reveal begins, so a turn
  // never resizes mid-flip.
  const fits = editing && visible > 0 ? visible - insets.top - aboveName : Infinity
  const size = wide ? Math.max(160, Math.min(360, height - 136, (width - 96) / 2)) : Math.max(120, Math.min(upright, fits))
  // A draw turn gives the bag more room than the token when the screen has it, enough to see into
  // it. The token stays centred in that room, so the name below never moves when it rises.
  const room = bag
    ? Math.max(size, wide ? Math.min((width - 96) / 2, height - 136) : Math.min(width - 32, height - 260, 600, fits))
    : size
  const [draft, setDraft] = useState(player.name)
  const savedName = useRef(player.name)
  const [revealed, setRevealed] = useState(false)
  const [settled, setSettled] = useState(false)
  // The token just taken from the bag, turned over once its character arrives.
  const [drawn, setDrawn] = useState<{ readonly at: number; readonly from?: Lift }>()
  const reduced = useReducedMotion()
  const turning = useRef(false)
  const input = useRef<TextInputInstance>(null)
  const token = useRef<ViewInstance>(null)
  const focusVisible = useFocusVisible()
  const face = player.character !== undefined ? player : undefined
  const choosing = !!bag && !face
  const cover = useCallback(() => { turning.current = false; setRevealed(false); setSettled(false); setDrawn(undefined) }, [])
  const didSettle = useCallback(() => { turning.current = false; setSettled(true) }, [])

  const shown = face?.character
  const alignment = face?.alignment
  useEffect(() => {
    // Keep both layers decoded for the flip, without mounting the private face.
    if (!shown || !alignment) return
    const source = artFor(shown, character(shown).team, alignment)
    if (source) void preloadImage(source.uri)
    if (tokenArt.character_bg) void preloadImage(tokenArt.character_bg.uri)
  }, [shown, alignment])

  useEffect(() => {
    const hide = () => cover()
    const visibility = () => { if (document.hidden) hide() }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); hide() } }
    document.addEventListener('visibilitychange', visibility)
    // TextInput stops bubbling key events, including Escape while editing a name.
    document.addEventListener('keydown', escape, true)
    window.addEventListener('pagehide', hide)
    window.addEventListener('pageshow', hide)
    return () => {
      document.removeEventListener('visibilitychange', visibility)
      document.removeEventListener('keydown', escape, true)
      window.removeEventListener('pagehide', hide)
      window.removeEventListener('pageshow', hide)
    }
  }, [cover])

  const saveName = () => {
    const name = draft.trim() || savedName.current
    setDraft(name)
    // Blur and the next-player action can both finish the same edit.
    if (name === savedName.current) return
    savedName.current = name
    onName(name)
  }
  const reveal = () => {
    if (revealed || turning.current || !face) return
    saveName()
    input.current?.blur()
    Keyboard.dismiss()
    turning.current = true
    setSettled(false)
    setRevealed(true)
  }
  const next = () => {
    if (!settled) return
    saveName()
    input.current?.blur()
    Keyboard.dismiss()
    cover()
    onNext()
  }
  const back = () => {
    saveName()
    if (revealed) { cover(); return }
    input.current?.blur()
    Keyboard.dismiss()
    onBack()
  }
  const take = (at: number, from: Lift) => {
    if (drawn || !bag) return
    saveName()
    input.current?.blur()
    Keyboard.dismiss()
    if (bag.onTake(at)) setDrawn(reduced ? { at } : { at, from })
  }
  const revealDrawn = useRef(reveal)
  useLayoutEffect(() => { revealDrawn.current = reveal })
  const hasCharacter = !!face
  useLayoutEffect(() => {
    if (!drawn || !hasCharacter) return
    const element = domElement(token.current)
    const finish = () => { setDrawn(undefined); revealDrawn.current() }
    if (!drawn.from || typeof element?.animate !== 'function') { finish(); return }
    const { x, y, token: small, turn } = drawn.from
    const rise = element.animate([
      { transform: `translate(${x - size / 2}px, ${y - size / 2}px) rotate(${turn}deg) scale(${small / size})` },
      { transform: 'none' },
    ], { duration: motion.duration.lift, easing: motion.css.ease })
    let active = true
    void rise.finished.then(() => { if (active) finish() }).catch(() => { /* A hide cancels the rise. */ })
    return () => { active = false; rise.cancel() }
    // The rise runs once per token taken; a size change mid-flight lands it at the new size.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawn, hasCharacter])

  return <Screen title={title} onBack={back} backLabel={t(revealed ? 'setup.discoveryHide' : 'setup.discoveryReturn')}
    right={<Text style={[type.text.small, tabular, styles.sequence, { color: palette.muted }]}>{t('setup.ofCount', { have: player.number, of: player.total })}</Text>}
    contentMax={800}>
    <Enter>
      <View style={[styles.scene, wide && styles.wideScene]}>
        <View style={{ width: room, height: room, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: size, height: size }}>
            {bag && (choosing || drawn) ? <Spread size={size} room={room} free={bag.free} t={t} onTake={take}
              {...(drawn ? { taken: drawn.at } : {})} /> : null}
            {!choosing ? <Pressable ref={token} accessibilityRole={revealed ? 'image' : 'button'} accessibilityLabel={settled && face ? `${face.roleName}. ${face.ability}` : t('setup.discoveryReveal')}
              disabled={revealed || !!drawn} onPress={reveal} style={state => [{ borderRadius: size / 2 }, focusStyle(palette, isFocused(state) && focusVisible)]}>
              <TokenFlip size={size} revealed={revealed} onSettled={didSettle}>
                {face ? <Token size={size} character={face.character} alignment={face.alignment} name={face.roleName} ability={face.ability} printName markers={false} /> : null}
              </TokenFlip>
            </Pressable> : null}
          </View>
        </View>
        <View style={[styles.details, styles.playerDetails, wide && styles.wideDetails]}>
          <View style={styles.nameField}>
            <TextInput ref={input} value={draft} onChangeText={setDraft} accessibilityLabel={t('setup.discoveryName')}
              placeholder={t('setup.defaultSeat', { n: player.number })} placeholderTextColor={palette.inkMuted}
              autoComplete="off" autoCapitalize="words" returnKeyType="done" selectTextOnFocus
              onFocus={() => setEditing(true)}
              onBlur={() => { setEditing(false); saveName() }}
              onSubmitEditing={() => { saveName(); input.current?.blur(); if (!revealed) domElement(token.current)?.focus() }}
              style={[type.display.title, styles.center, styles.input]} />
            <View pointerEvents="none" accessible={false} style={styles.editIcon}>
              <Icon name="edit" size={18} color={palette.inkMuted} />
            </View>
          </View>
          {/* Reserve the action's actual wrapped height so the token never jumps during a turn. */}
          <div aria-hidden={!settled} inert={!settled} style={{ visibility: settled ? 'visible' : 'hidden' }}>
            <Button label={t(player.next ? 'setup.discoveryNext' : 'setup.discoveryFinish')} variant="primary" onPress={next} disabled={!settled} />
          </div>
        </View>
      </View>
    </Enter>
  </Screen>
}

const styles = StyleSheet.create({
  scene: { flex: 1, flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: space.xl, paddingVertical: space.lg },
  wideScene: { flexDirection: 'row', gap: space.xxl, paddingVertical: space.sm },
  details: { width: '100%', maxWidth: 360, flexShrink: 1, gap: space.lg },
  playerDetails: { minHeight: 112, maxWidth: 320 },
  wideDetails: { width: 'auto', flexBasis: 0, flexGrow: 1 },
  center: { textAlign: 'center' },
  sequence: { paddingHorizontal: space.sm },
  nameField: { position: 'relative', width: '100%' },
  input: { minHeight: touch + space.sm, color: palette.ink, backgroundColor: palette.parchment, borderRadius: radius.control, paddingHorizontal: touch, paddingVertical: space.sm },
  editIcon: { position: 'absolute', right: space.md, top: 0, bottom: 0, justifyContent: 'center' },
})
