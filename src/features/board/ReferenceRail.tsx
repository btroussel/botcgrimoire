import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'

import type { CharacterId, NightMarker, Team } from '../../content'
import { character, gameText, scriptName, scriptRules } from '../../content'
import { useStore } from '../../store'
import { jinxesAmong, listed, nightOrders, sheetTeams, teamLabels } from '../../store/scriptSheet'
import { AbilityText } from '../../ui/AbilityText'
import { focusStyle, isFocused, isHovered } from '../../ui/Button'
import { CharacterIcon } from '../../ui/CharacterIcon'
import { referenceCompactWidth, referenceTabWidth } from './boardLayout'
import { layerAbove, useFocusVisible } from '../../ui/focus'
import { Icon } from '../../ui/icons'
import { nightInstruction } from './nightInstruction'
import { PaperTexture } from '../../ui/PaperTexture'
import { nightMarkerArt } from '../../ui/scriptSheet/Reference'
import { RuleList } from '../../ui/scriptSheet/Rules'
import { Segment } from './Segment'
import { font, palette, space, touch, type } from '../../ui/theme'
import { nightEntries, seatCharacters } from './nightReference'

export type ReferenceTab = 'characters' | 'first' | 'other'

export interface ReferenceRailProps {
  readonly tab: ReferenceTab | null
  readonly onTabChange: (tab: ReferenceTab | null) => void
  readonly width: number
  readonly height: number
  readonly maximumWidth: number
  readonly dragging: boolean
  readonly dragHandlers: HTMLAttributes<HTMLDivElement>
  readonly onResizeKey: HTMLAttributes<HTMLDivElement>['onKeyDown']
  readonly bottomClearance: number // the status plaque floats over the paper's foot
}

const tabKeys = {
  characters: 'board.referenceCharacters', first: 'board.sheetFirstNight', other: 'board.sheetOtherNights',
} as const
const markerKeys = {
  dusk: 'board.markerDusk', dawn: 'board.markerDawn', minionInfo: 'board.markerMinionInfo', demonInfo: 'board.markerDemonInfo',
} as const
const identityWidth = 168
const phoneRoleName = { fontSize: 14, lineHeight: 20 }
// Descriptions begin beyond the compact opening, so the paper's edge reveals them naturally.
const ReferenceDescription = ({ expansion, width, children }: {
  readonly expansion: number; readonly width: number; readonly children: ReactNode
}) => {
  const content = useRef<HTMLDivElement>(null)
  const [heights, setHeights] = useState({ compact: 42, full: 42 })
  useLayoutEffect(() => {
    const text = content.current
    const identity = text?.parentElement?.previousElementSibling
    if (!text || !(identity instanceof HTMLElement)) return
    const measure = () => {
      const compact = Math.max(42, identity.offsetHeight)
      const full = Math.max(compact, text.offsetHeight)
      setHeights(previous => previous.compact === compact && previous.full === full ? previous : { compact, full })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(text)
    observer.observe(identity)
    return () => observer.disconnect()
  }, [])
  // Start at the space the identity already needs. Only the extra description height grows.
  const height = heights.compact + (heights.full - heights.compact) * expansion
  return <div aria-hidden={expansion === 0} style={{ width, boxSizing: 'border-box', flexShrink: 0, minWidth: 0, height,
    position: 'relative', overflow: 'hidden', borderLeft: `1px solid ${expansion > 0 ? palette.parchmentShade : 'transparent'}` }}>
    <div ref={content} style={{ position: 'absolute', top: 0, left: space.sm, right: 0 }}>{children}</div>
  </div>
}

// What every row shares: its place on the fixed sheet and how far the paper has opened.
interface RowLayout {
  readonly phone: boolean
  readonly nameColumnWidth: number
  readonly artSize: number
  readonly expansion: number
  readonly descriptionWidth: number
}

// The sheet stays mounted while closed and its store re-renders it on every edit, so each row
// redraws only when its own text, players or the paper's opening change.
const CharacterRow = memo(function CharacterRow({ id, team, name, ability, rules, rulesLabel, phone, nameColumnWidth, artSize, expansion, descriptionWidth }: RowLayout & {
  readonly id: string
  readonly team: Team
  readonly name: string
  readonly ability: string
  readonly rules?: readonly string[] | undefined // the Bootlegger's homebrew rules, read after its ability as on the sheet
  readonly rulesLabel?: string | undefined
}) {
  return <View style={styles.referenceRow}>
    <View style={[styles.identity, { width: nameColumnWidth }]}>
      <View style={[styles.art, { width: artSize }]}>
        <CharacterIcon id={id} team={team} size={artSize} />
      </View>
      <View style={styles.names}>
        <Text style={[type.text.strong, phone ? phoneRoleName : undefined, { color: palette.teamOnPaper[team] }]}>{name}</Text>
      </View>
    </View>
    <ReferenceDescription expansion={expansion} width={descriptionWidth}>
      <Text style={[type.text.body, styles.ink]}><AbilityText text={ability} /></Text>
      {rules?.length && rulesLabel ? <RuleList label={rulesLabel} rules={rules} text={type.text.body} p={palette} /> : null}
    </ReferenceDescription>
  </View>
})

interface Player {
  readonly id: string
  readonly name: string
  readonly alive: boolean
}

interface NightRowProps extends RowLayout {
  readonly label: string
  readonly character: CharacterId | undefined
  readonly marker: NightMarker | undefined
  readonly instruction: string
  readonly players: readonly Player[] // the seats holding, shown or granted this character
  readonly deadLabel: string
}

const samePlayers = (a: readonly Player[], b: readonly Player[]) =>
  a.length === b.length && a.every((player, i) => player.id === b[i]!.id && player.name === b[i]!.name && player.alive === b[i]!.alive)
const sameNightRow = (a: NightRowProps, b: NightRowProps) =>
  (Object.keys(a) as (keyof NightRowProps)[]).every(key => key === 'players' ? samePlayers(a.players, b.players) : a[key] === b[key])

const NightRow = memo(function NightRow({ label, character: id, marker, instruction, players, deadLabel, phone, nameColumnWidth, artSize, expansion, descriptionWidth }: NightRowProps) {
  const parts = nightInstruction(instruction).filter(part => part.kind !== 'reminder')
  const art = marker !== undefined ? nightMarkerArt[marker] : undefined
  return <View style={[styles.referenceRow, styles.nightRow]}>
    <View style={[styles.identity, { width: nameColumnWidth }]}>
      <View style={[styles.art, { width: artSize }]}>
        {id ? <CharacterIcon id={id} size={artSize} /> : art !== undefined ?
          <Image source={art} style={{ width: artSize, height: artSize }} /> : null}
      </View>
      <View style={styles.names}>
        <Text style={[type.text.strong, phone ? phoneRoleName : undefined, { color: id ? palette.teamOnPaper[character(id).team] : palette.ink }]}>{label}</Text>
        {players.length ? <Text style={[type.text.small, styles.playerNames, styles.muted]}>
          {players.map((seat, index) => <Text key={seat.id}>
            {index ? ', ' : ''}
            <Text style={!seat.alive ? styles.crossed : undefined}
              accessibilityLabel={seat.alive ? seat.name : `${seat.name}, ${deadLabel}`}>
              {seat.name}
            </Text>
          </Text>)}
        </Text> : null}
      </View>
    </View>
    {parts.length ? <ReferenceDescription expansion={expansion} width={descriptionWidth}>
      <Text style={[type.text.body, styles.ink]}>
        {parts.map((part, index) => <Text key={index} style={part.kind === 'emphasis' ? styles.emphasis : undefined}>{part.text}</Text>)}
      </Text>
    </ReferenceDescription> : null}
  </View>
}, sameNightRow)

export const ReferenceRail = ({ tab, onTabChange, width, height, maximumWidth, dragging, dragHandlers, onResizeKey, bottomClearance }: ReferenceRailProps) => {
  const { board, t, settings } = useStore()
  const viewport = useWindowDimensions().width
  const phone = viewport <= 480
  const compactWidth = referenceCompactWidth(viewport)
  // The status plaque floats over the rail's foot, so the tabs fit and centre in the rest.
  const compactTabs = height - bottomClearance < 3 * 124 + 2 * space.xs
  const [nightFilter, setNightFilter] = useState<'inPlay' | 'all'>('inPlay')
  const [gripFocused, setGripFocused] = useState(false)
  const focusVisible = useFocusVisible()
  const tabElements = useRef<HTMLDivElement>(null)
  const tabId = useId()
  const [lastTab, setLastTab] = useState<ReferenceTab>('characters')
  if (tab && tab !== lastTab) setLastTab(tab)
  const shownTab = tab ?? lastTab
  const close = useCallback(() => {
    if (tab) tabElements.current?.querySelector<HTMLElement>(`[id="${tabId}-${tab}"]`)?.focus()
    onTabChange(null)
  }, [tab, tabId, onTabChange])
  useEffect(() => {
    if (!tab) return
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      // A window, a menu or the toolbar's popover gets the first dismissal. Capture, so the
      // reference closes before the voting controls hear the key.
      if (layerAbove()) return
      event.preventDefault()
      close()
    }
    document.addEventListener('keydown', dismiss, true)
    return () => document.removeEventListener('keydown', dismiss, true)
  }, [tab, close])
  const script = board?.script
  const locale = settings.locale
  const text = useMemo(() => gameText(locale), [locale])
  const list = useMemo(() => script ? listed(script, locale) : [], [script, locale])
  const rules = useMemo(() => script ? scriptRules(script) : [], [script])
  const jinxes = useMemo(() => jinxesAmong(list, locale), [list, locale])
  const teams = useMemo(() => teamLabels(t), [t])
  const orders = useMemo(() => script ? nightOrders(script, list, locale, marker => t(markerKeys[marker])) : { first: [], other: [] }, [script, list, locale, t])
  const night = shownTab === 'other' ? 'other' : 'first'
  const entries = useMemo(() => board ? nightEntries(board, night, orders, text, nightFilter) : [], [board, night, orders, text, nightFilter])
  if (!board || !script) return null

  // Pull out a fixed sheet: only its visible portion changes, never its typesetting.
  const artSize = phone ? 36 : 42
  const nameColumnWidth = phone ? 144 : identityWidth
  const row: RowLayout = { phone, nameColumnWidth, artSize,
    expansion: Math.max(0, Math.min(1, (width - compactWidth) / Math.max(1, maximumWidth - compactWidth))),
    descriptionWidth: Math.max(0, maximumWidth - 2 * space.md - nameColumnWidth - space.sm - 2),
  }
  const headingWidth = Math.max(0, Math.min(maximumWidth, Math.max(compactWidth, width)) - 2 * space.md - 2)
  const playersOf = (id: string): readonly Player[] => board.seats
    .filter(seat => seatCharacters(seat).includes(id as CharacterId))
    .map(seat => ({ id: seat.id, name: seat.name, alive: seat.alive }))

  return <View style={styles.root}>
    <div ref={tabElements} {...dragHandlers} style={{ display: 'flex', touchAction: 'none', userSelect: 'none', cursor: dragging ? 'grabbing' : 'ew-resize' }}>
    <View style={[styles.tabs, compactTabs ? styles.compactTabs : { paddingBottom: bottomClearance }]}>
      {(Object.keys(tabKeys) as ReferenceTab[]).map(value => <Pressable key={value}
        nativeID={`${tabId}-${value}`}
        hitSlop={{ left: 2, right: 2 }}
        accessibilityRole="button" accessibilityLabel={t(tabKeys[value])} aria-expanded={tab === value}
        onPress={() => onTabChange(tab === value ? null : value)}
        style={state => [styles.tab, compactTabs && styles.compactTab, tab === value && styles.activeTab,
          (isHovered(state) || state.pressed) && styles.hoveredTab,
          focusStyle(palette, focusVisible && isFocused(state))]}>
        {compactTabs ? <span title={t(tabKeys[value])} aria-hidden="true"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', width: 32, height: 32 }}>
          <Icon name={value === 'characters' ? 'script' : 'order'} size={22} color={tab === value ? palette.parchment : palette.text} />
          {value !== 'characters' ? <span style={{ position: 'absolute', right: 0, bottom: 0, fontFamily: font.body.bold,
            fontSize: 11, lineHeight: '12px', color: tab === value ? palette.parchment : palette.text }}>{value === 'first' ? '1' : '2+'}</span> : null}
        </span> : <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', fontFamily: font.body.bold, fontSize: 13,
          letterSpacing: 1, textTransform: 'uppercase', color: tab === value ? palette.parchment : palette.text }}>
          {t(tabKeys[value])}
        </span>}
      </Pressable>)}
    </View>
    </div>
    {/* A closed drawer opens and drags from its tabs, and its grip would only sit over their
        edge and take their taps, so it shows and takes the pointer only while the drawer is open.
        The keyboard still reaches it, and it shows while focused. */}
    <div role="separator" tabIndex={0} aria-orientation="vertical" aria-label={t('board.referenceResize')}
      onFocus={() => setGripFocused(true)} onBlur={() => setGripFocused(false)}
      aria-valuemin={0} aria-valuemax={Math.round(maximumWidth)} aria-valuenow={Math.round(width)}
      {...dragHandlers} onKeyDown={onResizeKey}
      style={{ position: 'absolute', left: referenceTabWidth - 6, top: '50%', transform: 'translateY(-50%)', width: 12, height: 68, zIndex: 3,
        touchAction: 'none', userSelect: 'none', cursor: 'ew-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8,
        pointerEvents: width > 0 ? 'auto' : 'none' }}>
      <div style={{ width: 4, height: 52, borderRadius: 4, background: palette.accent,
        boxShadow: '0 0 0 3px #2c211b80', opacity: width === 0 && !gripFocused ? 0 : dragging ? 1 : 0.8, pointerEvents: 'none' }} />
    </div>
    <div role="region" aria-label={shownTab === 'characters' ? scriptName(script) : t(tabKeys[shownTab])}
      inert={!tab} aria-hidden={!tab} {...dragHandlers}
      style={{ width, display: 'flex', overflow: 'hidden', minHeight: 0, touchAction: 'pan-y', userSelect: 'none' }}>
    <View style={[styles.paper, { width: maximumWidth }]}>
      <PaperTexture />
      <View style={styles.binding} pointerEvents="none" />
      <ScrollView key={shownTab} style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: bottomClearance }]} showsVerticalScrollIndicator={false}>
        {/* The filter reads as the sheet's heading, so its state is visible in words, not decoded from an icon. */}
        {shownTab !== 'characters' ? <View style={[styles.filter, { width: headingWidth }]}>
          <View style={styles.rule} />
          <Segment accessibilityLabel={t('board.referenceFilter')}
            value={nightFilter} onChange={setNightFilter}
            options={[{ value: 'inPlay', label: t('board.referenceInPlay') }, { value: 'all', label: t('board.referenceAll') }]} />
          <View style={styles.rule} />
        </View> : null}
        {shownTab === 'characters' ? <>
          {sheetTeams.map(team => {
            const rows = list.filter(row => row.team === team)
            if (!rows.length) return null
            return <View key={team} style={styles.team}>
              <View style={[styles.teamHeading, { width: headingWidth }]}><View style={styles.rule} />
                <Text accessibilityRole="header" style={[type.text.label, { color: palette.teamOnPaper[team] }]}>{teams[team]}</Text>
                <View style={styles.rule} />
              </View>
              {rows.map(entry => <CharacterRow key={entry.id} id={entry.id} team={entry.team} name={entry.name} ability={entry.ability}
                {...(entry.id === 'bootlegger' ? { rules, rulesLabel: t('scripts.rules') } : {})} {...row} />)}
            </View>
          })}
          {jinxes.length ? <View style={styles.team}>
            <Text accessibilityRole="header" style={[type.display.title, styles.ink]}>{t('scripts.jinxes')}</Text>
            {jinxes.map(jinx => <View key={`${jinx.a}:${jinx.b}`} style={styles.jinx}>
              <View style={[styles.jinxArt, { width: nameColumnWidth }]}><CharacterIcon id={jinx.a} size={32} /><CharacterIcon id={jinx.b} size={32} /></View>
              <ReferenceDescription expansion={row.expansion} width={row.descriptionWidth}>
                <Text style={[type.text.small, styles.ink]}>{jinx.reason}</Text>
              </ReferenceDescription>
            </View>)}
          </View> : null}
        </> : entries.map(entry => <NightRow key={entry.id} label={entry.label} character={entry.character} marker={entry.marker}
          instruction={entry.instruction} players={entry.character ? playersOf(entry.character) : []} deadLabel={t('board.dead')} {...row} />)}
      </ScrollView>
    </View>
    </div>
  </View>
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0, flexDirection: 'row' },
  tabs: { width: referenceTabWidth, alignSelf: 'stretch', justifyContent: 'center', gap: space.xs },
  compactTabs: { justifyContent: 'flex-start' },
  tab: { width: referenceTabWidth, minHeight: 124, maxHeight: 158, flex: 1, flexGrow: 0, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#100917c9', borderColor: '#ae8a4e80', borderWidth: 1, borderTopLeftRadius: 7, borderBottomLeftRadius: 7 },
  compactTab: { width: touch, marginLeft: referenceTabWidth - touch, minHeight: touch, maxHeight: touch },
  activeTab: { backgroundColor: palette.ink, borderColor: palette.accent, borderRightWidth: 0 },
  hoveredTab: { backgroundColor: palette.feltRaised },
  paper: { minHeight: 0, flexShrink: 0, backgroundColor: palette.parchment, borderColor: palette.ink, borderWidth: 1,
    borderTopLeftRadius: 7, borderBottomLeftRadius: 7, overflow: 'hidden', boxShadow: '-4px 2px 16px #0006' },
  binding: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 5, backgroundColor: palette.accent, opacity: 0.72 },
  filter: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xs },
  scroll: { flex: 1, minHeight: 0 },
  content: { paddingLeft: space.md, paddingRight: space.md, width: '100%', maxWidth: 760, alignSelf: 'center' },
  team: { gap: space.xxs, marginBottom: space.sm },
  teamHeading: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  rule: { flex: 1, height: 1, backgroundColor: palette.parchmentShade },
  referenceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: space.xs, minHeight: 50 },
  identity: { flexShrink: 0, flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  art: { minHeight: 36, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  names: { flex: 1, minWidth: 0 },
  playerNames: { marginTop: space.xxs },
  ink: { color: palette.ink },
  muted: { color: palette.inkMuted },
  jinx: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: space.xs },
  jinxArt: { flexShrink: 0, flexDirection: 'row', gap: space.xs },
  nightRow: { borderBottomColor: palette.parchmentShade, borderBottomWidth: StyleSheet.hairlineWidth },
  crossed: { textDecorationLine: 'line-through', color: palette.inkMuted },
  emphasis: { fontFamily: font.body.bold },
})
