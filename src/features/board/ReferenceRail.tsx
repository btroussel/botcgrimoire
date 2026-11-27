import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import type { TextStyle } from 'react-native'

import type { CharacterId, NightMarker, Team } from '../../content'
import { asCharacterId, character, gameText, scriptName, scriptRules } from '../../content'
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
import { font, indexTab, palette, ring, space, touch, type } from '../../ui/theme'
import { nightEntries, recordedCharacters, seatCharacters } from './nightReference'

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
// How far a tab that is not open slides under the edge of the sheet.
const tabTuck = 6
// The sheet and its tabs round their outer corners alike.
const paperRadius = 7
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
    position: 'relative', overflow: 'hidden' }}>
    {/* A row that takes taps is a button, which centres its text unless told otherwise. */}
    <div ref={content} style={{ position: 'absolute', top: 0, left: space.sm, right: 0, textAlign: 'start' }}>{children}</div>
  </div>
}

// What every row shares: its place on the fixed sheet and how far the paper has opened.
interface RowLayout {
  readonly phone: boolean
  readonly nameColumnWidth: number
  readonly artSize: number
  readonly expansion: number
  readonly descriptionWidth: number
  readonly foldWidth: number // the text's width when it unfolds under a compact row
  readonly focusVisible: boolean
}

interface Player {
  readonly id: string
  readonly name: string
  readonly alive: boolean
}

// The sheet stays mounted while closed and its store re-renders it on every edit, so each row
// redraws only when its own text, players or the paper's opening change.
const samePlayers = (a: readonly Player[], b: readonly Player[]) =>
  a.length === b.length && a.every((player, i) => player.id === b[i]!.id && player.name === b[i]!.name && player.alive === b[i]!.alive)
const sameLayout = (a: RowLayout, b: RowLayout) => (Object.keys(a) as (keyof RowLayout)[]).every(key => a[key] === b[key])
const sameRow = <P extends { readonly layout: RowLayout; readonly players: readonly Player[] }>(a: P, b: P) =>
  (Object.keys(a) as (keyof P)[]).every(key => key === 'players' ? samePlayers(a.players, b.players)
    : key === 'layout' ? sameLayout(a.layout, b.layout) : a[key] === b[key])

// One row on every sheet: the art and the name, the text beside them once the paper is out, and
// a line under it that starts at the name, so a night's rail runs past it. While the paper shows
// names only, a tap unfolds the text under its name: one ability is read without the paper
// covering the board.
const Row = ({ layout, identity, text, open, onPress, rail, current }: {
  readonly layout: RowLayout
  readonly identity: ReactNode
  readonly text: ((style: TextStyle) => ReactNode) | undefined
  readonly open: boolean
  readonly onPress: (() => void) | undefined
  readonly rail?: 'first' | 'between' | 'last' | undefined // a night's row, by its place on the rail
  readonly current?: boolean
}) => {
  const compact = layout.expansion === 0
  const middle = space.sm + layout.artSize / 2
  const line = <>
    <View style={[styles.identity, { width: layout.nameColumnWidth }]}>{identity}</View>
    {text ? <ReferenceDescription expansion={layout.expansion} width={layout.descriptionWidth}>{text(type.text.body)}</ReferenceDescription> : null}
  </>
  return <View>
    <View>
      {/* The rail stops with the row's first line, so a text unfolded under it reads on bare paper. */}
      {rail ? <View pointerEvents="none" style={[styles.rail, { left: layout.artSize / 2 - 1 },
        rail === 'first' && { top: middle }, rail === 'last' && { bottom: 'auto', height: middle }]} /> : null}
      {onPress ? <Pressable accessibilityRole="button" onPress={onPress}
        aria-expanded={compact && text ? open : undefined} aria-current={current ? 'step' : undefined}
        style={state => [styles.rowLine, focusStyle(palette, layout.focusVisible && isFocused(state), 'paper')]}>{line}</Pressable>
        : <View style={styles.rowLine}>{line}</View>}
    </View>
    {compact && open && text ? <View style={[styles.fold, { width: layout.foldWidth }]}>{text(type.text.small)}</View> : null}
    <View pointerEvents="none" style={[styles.rowRule, { left: layout.artSize + space.sm }]} />
  </View>
}

const Name = ({ label, color, players, deadLabel, phone }: {
  readonly label: string; readonly color: string; readonly players: readonly Player[]; readonly deadLabel: string; readonly phone: boolean
}) => <View style={styles.names}>
  <Text style={[type.text.strong, phone ? phoneRoleName : undefined, { color }]}>{label}</Text>
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

interface CharacterRowProps {
  readonly layout: RowLayout
  readonly id: string
  readonly team: Team
  readonly name: string
  readonly ability: string
  readonly rules?: readonly string[] | undefined // the Bootlegger's homebrew rules, read after its ability as on the sheet
  readonly rulesLabel?: string | undefined
  readonly players: readonly Player[] // the seats holding, shown or granted this character
  readonly deadLabel: string
  readonly open: boolean
  readonly onToggle: (id: string) => void
}

const CharacterRow = memo(function CharacterRow({ layout, id, team, name, ability, rules, rulesLabel, players, deadLabel, open, onToggle }: CharacterRowProps) {
  return <Row layout={layout} open={open} onPress={layout.expansion === 0 ? () => onToggle(id) : undefined}
    identity={<>
      <View style={[styles.art, { width: layout.artSize }]}>
        <CharacterIcon id={id} team={team} size={layout.artSize} />
      </View>
      <Name label={name} color={palette.teamOnPaper[team]} players={players} deadLabel={deadLabel} phone={layout.phone} />
    </>}
    text={style => <>
      <Text style={[style, styles.ink]}><AbilityText text={ability} /></Text>
      {rules?.length && rulesLabel ? <RuleList label={rulesLabel} rules={rules} text={style} p={palette} /> : null}
    </>} />
}, sameRow)

interface NightRowProps {
  readonly layout: RowLayout
  readonly id: string
  readonly label: string
  readonly character: CharacterId | undefined
  readonly marker: NightMarker | undefined
  readonly instruction: string
  readonly players: readonly Player[]
  readonly deadLabel: string
  readonly rail: 'first' | 'between' | 'last'
  readonly current: boolean // the step being read, which wears the ring
  readonly open: boolean
  readonly onStep: (id: string) => void
}

const NightRow = memo(function NightRow({ layout, id: entry, label, character: id, marker, instruction, players, deadLabel, rail, current, open, onStep }: NightRowProps) {
  const parts = nightInstruction(instruction).filter(part => part.kind !== 'reminder')
  const art = marker !== undefined ? nightMarkerArt[marker] : undefined
  const { artSize } = layout
  const icon = artSize - 12
  return <Row layout={layout} open={open} onPress={() => onStep(entry)} rail={rail} current={current}
    identity={<>
      {/* A stop on the rail: a paper disc, so the rail passes behind the art. */}
      <View style={[styles.stop, { width: artSize, height: artSize, borderRadius: artSize / 2 }]}>
        {current ? <View pointerEvents="none" style={[styles.here, { borderRadius: artSize / 2 + ring.gap + ring.width }]} /> : null}
        {id ? <CharacterIcon id={id} size={icon} /> : art !== undefined ?
          <Image source={art} style={{ width: icon, height: icon }} /> : null}
      </View>
      <Name label={label} color={id ? palette.teamOnPaper[character(id).team] : palette.ink} players={players} deadLabel={deadLabel} phone={layout.phone} />
    </>}
    text={parts.length ? style => <Text style={[style, styles.ink]}>
      {parts.map((part, index) => <Text key={index} style={part.kind === 'emphasis' ? styles.emphasis : undefined}>{part.text}</Text>)}
    </Text> : undefined} />
}, sameRow)

type Filter = 'inPlay' | 'all'

export const ReferenceRail = ({ tab, onTabChange, width, height, maximumWidth, dragging, dragHandlers, onResizeKey, bottomClearance }: ReferenceRailProps) => {
  const { board, t, settings } = useStore()
  const viewport = useWindowDimensions().width
  const phone = viewport <= 480
  const compactWidth = referenceCompactWidth(viewport)
  // The status plaque floats over the rail's foot, so the tabs fit and centre in the rest.
  const compactTabs = height - bottomClearance < 3 * 124 + 2 * space.xs
  // A night lists who wakes, so it opens on what is in play; the characters are looked up by
  // name, a bluff as often as a seat, so they open on the whole script.
  const [filters, setFilters] = useState<{ readonly characters: Filter; readonly night: Filter }>({ characters: 'all', night: 'inPlay' })
  const [unfolded, setUnfolded] = useState<ReadonlySet<string>>(() => new Set())
  const toggle = useCallback((id: string) => setUnfolded(previous => {
    const next = new Set(previous)
    if (!next.delete(id)) next.add(id)
    return next
  }), [])
  // Where the Storyteller is reading in a night. A display choice like the filter: nothing is
  // ticked or recorded, and a new phase starts from the first row again.
  const [step, setStep] = useState<{ readonly moment: string; readonly night: 'first' | 'other'; readonly id: string; readonly open: boolean }>()
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
  const recorded = useMemo(() => board ? recordedCharacters(board) : new Set<CharacterId>(), [board])
  const shownList = useMemo(() => filters.characters === 'all' ? list : list.filter(row => recorded.has(row.id)), [filters.characters, list, recorded])
  const jinxes = useMemo(() => jinxesAmong(shownList, locale), [shownList, locale])
  const teams = useMemo(() => teamLabels(t), [t])
  const orders = useMemo(() => script ? nightOrders(script, list, locale, marker => t(markerKeys[marker])) : { first: [], other: [] }, [script, list, locale, t])
  const night = shownTab === 'other' ? 'other' : 'first'
  const entries = useMemo(() => board ? nightEntries(board, night, orders, text, filters.night) : [], [board, night, orders, text, filters.night])
  const compact = width <= compactWidth
  const moment = board ? `${board.clock.night}:${board.clock.phase}` : ''
  // A tap moves the ring and, on a compact drawer, opens the step's text; a second tap there
  // folds the text and leaves the ring.
  const readStep = useCallback((id: string) => setStep(previous => {
    const same = previous?.moment === moment && previous.night === night && previous.id === id
    return { moment, night, id, open: !(compact && same && previous.open) }
  }), [moment, night, compact])
  if (!board || !script) return null

  // Pull out a fixed sheet: only its visible portion changes, never its typesetting.
  const artSize = phone ? 36 : 42
  const nameColumnWidth = phone ? 144 : identityWidth
  const row: RowLayout = { phone, nameColumnWidth, artSize, focusVisible,
    expansion: Math.max(0, Math.min(1, (width - compactWidth) / Math.max(1, maximumWidth - compactWidth))),
    descriptionWidth: Math.max(0, maximumWidth - 2 * space.md - nameColumnWidth - space.sm - 2),
    foldWidth: Math.max(0, Math.min(compactWidth, maximumWidth) - space.md - space.sm - 1),
  }
  const reading = step && step.moment === moment && step.night === night && entries.some(entry => entry.id === step.id) ? step : undefined
  const currentStep = reading?.id ?? entries[0]?.id
  const sheet = shownTab === 'characters' ? 'characters' : 'night'
  const headingWidth = Math.max(0, Math.min(maximumWidth, Math.max(compactWidth, width)) - 2 * space.md - 2)
  const playersOf = (id: string): readonly Player[] => board.seats
    .filter(seat => seatCharacters(seat).includes(id as CharacterId))
    .map(seat => ({ id: seat.id, name: seat.name, alive: seat.alive }))

  return <View style={styles.root}>
    <div ref={tabElements} {...dragHandlers} style={{ display: 'flex', touchAction: 'none', userSelect: 'none', cursor: dragging ? 'grabbing' : 'ew-resize' }}>
    <View style={[styles.tabs, compactTabs ? styles.compactTabs : { paddingBottom: bottomClearance }]}>
      {/* A tab's label reads bottom to top. Vertical text keeps Han, kana and Hangul upright, so
          every script is laid on its side, as Latin letters already are. */}
      {(Object.keys(tabKeys) as ReferenceTab[]).map(value => {
        // The sheet is still out while it slides shut, so its tab stays joined until the paper is gone.
        const joined = width > 0 && shownTab === value
        return <Pressable key={value}
          nativeID={`${tabId}-${value}`}
          hitSlop={{ left: 2, right: 2 }}
          accessibilityRole="button" accessibilityLabel={t(tabKeys[value])} aria-expanded={tab === value}
          onPress={() => onTabChange(tab === value ? null : value)}
          style={state => [styles.tab, compactTabs && styles.compactTab, focusStyle(palette, focusVisible && isFocused(state))]}>
          {state => <View style={[styles.tabFace, joined ? styles.joinedFace : { left: Math.min(tabTuck, width) }]}>
            <View style={styles.tabPaper}>
              <PaperTexture />
              {joined ? null : <View style={[StyleSheet.absoluteFill,
                { backgroundColor: isHovered(state) || state.pressed ? indexTab.hover : indexTab.wash }]} />}
            </View>
            {compactTabs ? <span title={t(tabKeys[value])} aria-hidden="true"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', width: 32, height: 32 }}>
              <Icon name={value === 'characters' ? 'script' : 'order'} size={22} color={palette.ink} />
              {value !== 'characters' ? <span style={{ position: 'absolute', right: 0, bottom: 0, fontFamily: font.body.bold,
                fontSize: 11, lineHeight: '12px', color: palette.ink }}>{value === 'first' ? '1' : '2+'}</span> : null}
            </span> : <span style={{ writingMode: 'vertical-rl', textOrientation: 'sideways', transform: 'rotate(180deg)', whiteSpace: 'nowrap', fontFamily: font.body.bold, fontSize: 13,
              letterSpacing: 1, textTransform: 'uppercase', color: palette.ink }}>
              {t(tabKeys[value])}
            </span>}
          </View>}
        </Pressable>
      })}
    </View>
    </div>
    {/* A pointer drags the drawer by its tabs or its paper, which look like things to pull, so
        the separator is for the keyboard alone: it takes no pointer and draws its bar only
        while focused. */}
    <div role="separator" tabIndex={0} aria-orientation="vertical" aria-label={t('board.referenceResize')}
      onFocus={() => setGripFocused(true)} onBlur={() => setGripFocused(false)}
      aria-valuemin={0} aria-valuemax={Math.round(maximumWidth)} aria-valuenow={Math.round(width)}
      onKeyDown={onResizeKey}
      style={{ position: 'absolute', left: referenceTabWidth - 6, top: '50%', transform: 'translateY(-50%)', width: 12, height: 68, zIndex: 3,
        display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, pointerEvents: 'none' }}>
      {gripFocused ? <div style={{ width: 4, height: 52, borderRadius: 4, background: palette.accent, boxShadow: '0 0 0 3px #2c211b80' }} /> : null}
    </div>
    <div role="region" aria-label={shownTab === 'characters' ? scriptName(script) : t(tabKeys[shownTab])}
      inert={!tab} aria-hidden={!tab} {...dragHandlers}
      // The paper is wider than its opening, and focus on a row would scroll the rest into view.
      onScroll={event => { event.currentTarget.scrollLeft = 0 }}
      style={{ width, display: 'flex', overflow: 'hidden', minHeight: 0, touchAction: 'pan-y', userSelect: 'none' }}>
    <View style={[styles.paper, { width: maximumWidth }]}>
      <PaperTexture />
      {/* The title scrolls away with the rows; the filter under it stays at the top. */}
      <ScrollView key={shownTab} style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: bottomClearance }]} showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}>
        {/* One line at every width: the sheet's typesetting never reflows as the paper is pulled. */}
        <Text accessibilityRole="header" numberOfLines={1} style={[type.display.title, styles.ink, styles.title, { width: headingWidth }]}>
          {shownTab === 'characters' ? scriptName(script) : t(tabKeys[shownTab])}
        </Text>
        {/* The filter reads as the sheet's heading on all three sheets, so its state is visible in
            words. It carries its own paper, since the rows pass under it. */}
        <View style={styles.header}>
          <PaperTexture />
          <View style={[styles.filter, { width: headingWidth }]}>
            <Segment accessibilityLabel={t('board.referenceFilter')}
              value={filters[sheet]} onChange={value => setFilters(previous => ({ ...previous, [sheet]: value }))}
              options={[{ value: 'inPlay', label: t('board.referenceInPlay') }, { value: 'all', label: t('board.referenceAll') }]} />
          </View>
        </View>
        <View>
        {shownTab === 'characters' ? <>
          {sheetTeams.map(team => {
            const rows = shownList.filter(row => row.team === team)
            if (!rows.length) return null
            return <View key={team} style={styles.team}>
              <View style={[styles.teamHeading, { width: headingWidth }]}><View style={styles.rule} />
                <Text accessibilityRole="header" style={[type.text.label, { color: palette.teamOnPaper[team] }]}>{teams[team]}</Text>
                <View style={styles.rule} />
              </View>
              {rows.map(entry => <CharacterRow key={entry.id} layout={row} id={entry.id} team={entry.team} name={entry.name} ability={entry.ability}
                players={playersOf(entry.id)} deadLabel={t('board.dead')} open={unfolded.has(entry.id)} onToggle={toggle}
                {...(entry.id === 'bootlegger' ? { rules, rulesLabel: t('scripts.rules') } : {})} />)}
            </View>
          })}
          {jinxes.length ? <View style={styles.team}>
            <Text accessibilityRole="header" style={[type.display.title, styles.ink, styles.jinxes]}>{t('scripts.jinxes')}</Text>
            {jinxes.map(jinx => {
              const key = `${jinx.a}:${jinx.b}`
              return <Row key={key} layout={row} open={unfolded.has(key)} onPress={compact ? () => toggle(key) : undefined}
                identity={<View style={styles.jinxArt} accessibilityLabel={`${text.role(asCharacterId(jinx.a)).name}, ${text.role(asCharacterId(jinx.b)).name}`}>
                  <CharacterIcon id={jinx.a} size={32} /><CharacterIcon id={jinx.b} size={32} />
                </View>}
                text={() => <Text style={[type.text.small, styles.ink]}>{jinx.reason}</Text>} />
            })}
          </View> : null}
        </> : entries.map((entry, index) => <NightRow key={entry.id} layout={row} id={entry.id} label={entry.label} character={entry.character} marker={entry.marker}
          instruction={entry.instruction} players={entry.character ? playersOf(entry.character) : []} deadLabel={t('board.dead')}
          rail={index === 0 ? 'first' : index === entries.length - 1 ? 'last' : 'between'}
          current={entry.id === currentStep} open={entry.id === currentStep && (reading?.open ?? false)} onStep={readStep} />)}
        </View>
      </ScrollView>
    </View>
    </div>
  </View>
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0, flexDirection: 'row' },
  // Above the sheet, so the open tab can cover the sheet's border where the two join.
  tabs: { width: referenceTabWidth, alignSelf: 'stretch', justifyContent: 'center', gap: space.xs, zIndex: 1 },
  // The icon tabs start below the sheet's rounded corner, so the top one joins a straight edge.
  compactTabs: { justifyContent: 'flex-start', paddingTop: paperRadius },
  tab: { width: referenceTabWidth, minHeight: 124, maxHeight: 158, flex: 1, flexGrow: 0 },
  compactTab: { width: touch, marginLeft: referenceTabWidth - touch, minHeight: touch, maxHeight: touch },
  // The tab keeps its whole touch area. The face is the paper it draws, which tucks under the
  // sheet's edge while another tab is open.
  tabFace: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center',
    backgroundColor: palette.parchment, borderColor: palette.ink, borderWidth: 1, borderRightWidth: 0,
    borderTopLeftRadius: paperRadius, borderBottomLeftRadius: paperRadius, boxShadow: indexTab.shadow },
  // One point over the sheet's own border, so no line runs between the open tab and its paper.
  joinedFace: { right: -1 },
  tabPaper: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderTopLeftRadius: paperRadius - 1, borderBottomLeftRadius: paperRadius - 1, overflow: 'hidden' },
  paper: { minHeight: 0, flexShrink: 0, backgroundColor: palette.parchment, borderColor: palette.ink, borderWidth: 1,
    borderTopLeftRadius: paperRadius, borderBottomLeftRadius: paperRadius, overflow: 'hidden', boxShadow: '-4px 2px 16px #0006' },
  title: { paddingTop: space.sm },
  // As wide as the paper, past the content's own padding, so no row shows beside it.
  header: { marginHorizontal: -space.md, paddingHorizontal: space.md, paddingVertical: space.sm, backgroundColor: palette.parchment,
    borderBottomColor: palette.parchmentShade, borderBottomWidth: 1 },
  filter: { flexDirection: 'row' },
  scroll: { flex: 1, minHeight: 0 },
  content: { paddingLeft: space.md, paddingRight: space.md, width: '100%', maxWidth: 760, alignSelf: 'center' },
  team: { gap: space.xxs, marginBottom: space.sm },
  teamHeading: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  rule: { flex: 1, height: 1, backgroundColor: palette.parchmentShade },
  rowLine: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: space.sm },
  rowRule: { position: 'absolute', right: 0, bottom: 0, height: 1, backgroundColor: palette.parchmentShade },
  fold: { paddingBottom: space.sm },
  rail: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: palette.parchmentShade },
  stop: { flexShrink: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.parchment, borderColor: palette.parchmentShade, borderWidth: 1 },
  here: { position: 'absolute', top: -(ring.gap + ring.width + 1), right: -(ring.gap + ring.width + 1), bottom: -(ring.gap + ring.width + 1), left: -(ring.gap + ring.width + 1),
    borderColor: palette.accent, borderWidth: ring.width },
  identity: { flexShrink: 0, flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  art: { minHeight: 36, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  names: { flex: 1, minWidth: 0 },
  playerNames: { marginTop: space.xxs },
  ink: { color: palette.ink },
  muted: { color: palette.inkMuted },
  jinxes: { paddingTop: space.sm },
  jinxArt: { flexShrink: 0, flexDirection: 'row', gap: space.xs },
  crossed: { textDecorationLine: 'line-through', color: palette.inkMuted },
  emphasis: { fontFamily: font.body.bold },
})
