// The character catalogue for the composer: beside the draft when both fit, over it on a
// phone. It slides in from its edge and, as a full-screen sheet, back out again on Done.
// Homebrew characters sit among the official ones and have their own edition filter. The team
// filter is a row of chips that carry each team's count, so what the script still lacks shows
// while choosing, when the sheet that says it is covered on a phone. Writing a new character
// waits at the end of the list and where a search found nothing, the moment it is wanted.
import { memo, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { TextInputInstance } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import type { CharacterId, Team } from '../../content'
import { characters, editions, gameText } from '../../content'
import { useStore } from '../../store'
import type { Listed } from '../../store/scriptSheet'
import { sheetTeams } from '../../store/scriptSheet'
import { AbilityText } from '../../ui/AbilityText'
import { Button, IconButton, focusStyle, isFocused } from '../../ui/Button'
import { CharacterIcon } from '../../ui/CharacterIcon'
import { useFocusVisible } from '../../ui/focus'
import { Icon } from '../../ui/icons'
import { durationFor, useReducedMotion } from '../../ui/motion'
import { PaperTexture } from '../../ui/PaperTexture'
import { border, focusRing, hoverWash, motion, palette, radius, space, touch, type } from '../../ui/theme'
import { useViewport } from '../../ui/Viewport'
import { searchCharacters, searchPick } from './compose'
import { useSheetWords } from './useScripts'

interface Props {
  readonly visible: boolean
  readonly wide: boolean
  readonly roster: readonly Listed[]
  readonly selected: readonly CharacterId[]
  readonly counts: Readonly<Partial<Record<Team, number>>> // on the script, by team
  readonly target: Readonly<Record<Team, number>> // the usual count, zero for a team that has none
  readonly team: Team | 'all'
  readonly onTeamChange: (team: Team | 'all') => void
  readonly onToggle: (id: string) => void
  readonly onClose: () => void
  readonly onCreate: (name?: string) => void // write a new homebrew character, named as the search that found nothing
}

export const ScriptCharacterPicker = ({ visible, wide, roster, selected, counts, target, team, onTeamChange, onToggle, onClose, onCreate }: Props) => {
  const { t, settings } = useStore()
  const { teams } = useSheetWords()
  const p = palette
  const insets = useSafeAreaInsets()
  const viewport = useViewport()
  const reduced = useReducedMotion()
  // The full-screen sheet stays mounted through its closing slide; the modal reports the end.
  const [mounted, setMounted] = useState(visible)
  if (visible && !mounted) setMounted(true)
  const [entry] = useState(() => new Animated.Value(0))
  useEffect(() => {
    if (!visible || !wide) return
    entry.setValue(0)
    const run = Animated.timing(entry, { toValue: 1, duration: durationFor(motion.duration.sheetIn, reduced, true), easing: motion.ease, useNativeDriver: false })
    run.start()
    return () => run.stop()
  }, [visible, wide, reduced, entry])
  // Keep the edition choice when the picker closes or changes size.
  const [edition, setEdition] = useState('all')
  const [query, setQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const focusVisible = useFocusVisible()
  const searchRef = useRef<TextInputInstance>(null)
  const teamGroup = useId()
  const chips = useRef<HTMLDivElement>(null)
  // A band's add control opens the catalogue on its team, whose chip may lie past the edge.
  useEffect(() => {
    if (visible) chips.current?.querySelector('input:checked')?.parentElement?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [visible, team])
  useEffect(() => {
    if (!visible || !wide) return
    const opener = document.activeElement
    searchRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose() }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [visible, wide, onClose])
  const search = useMemo(() => searchCharacters(roster.filter(c =>
    (team === 'all' || c.team === team) &&
    (edition === 'all' || (c.homebrew ? 'homebrew' : characters.get(c.id)?.edition) === edition),
  ), query), [roster, team, edition, query])
  const { shown } = search
  const anyHomebrew = useMemo(() => roster.some(c => c.homebrew), [roster])
  const selectedIds = useMemo(() => new Set(selected), [selected])
  const pinned = !viewport.height || viewport.height >= pinFrom
  const selectStyle = {
    backgroundColor: 'transparent', color: p.ink, border: `1px solid ${p.parchmentShade}`,
    borderRadius: radius.control, fontFamily: type.text.body.fontFamily, fontSize: type.text.body.fontSize, minHeight: touch, padding: space.sm,
    flex: 'none', maxWidth: '45%', minWidth: 0,
  }
  // A team's count against its usual number, or alone for a team that has none.
  const countOf = (value: Team) => {
    const have = counts[value] ?? 0
    return target[value] > 0 ? { short: `${have}/${target[value]}`, said: t('scripts.ofTarget', { have, of: target[value] }) } : have > 0 ? { short: String(have), said: String(have) } : undefined
  }
  const create = <Button label={t('scripts.createCharacter')} icon="add" onPress={() => onCreate(query.trim() || undefined)} surface="paper" />

  if (wide ? !visible : !visible && !mounted) return null

  const content = (
    <View id="script-character-picker" style={[styles.panel, { backgroundColor: p.parchment, paddingTop: wide ? 0 : insets.top, paddingBottom: insets.bottom }]}>
      <PaperTexture />
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[type.display.title, styles.grow, { color: p.ink }]}>{t('scripts.addCharacters')}</Text>
        <Button label={t('common.done')} onPress={onClose} surface="paper" variant="text" />
      </View>
      <ScrollView style={styles.grow} contentContainerStyle={styles.roster} keyboardShouldPersistTaps="handled">
        {/* Search and the filters stick under the header so they stay in reach down the list. In a
            window too short for them and two rows, they scroll away with the rest instead. */}
        <View style={[styles.filters, pinned ? [styles.pinned, { backgroundColor: p.parchment }] : null]}>
          {pinned ? <PaperTexture /> : null}
          <View style={styles.filterRow}>
            <View style={[styles.search, focusStyle(p, searchFocused && focusVisible, 'paper')]}>
              <Icon name="search" size={20} color={p.inkMuted} />
              <TextInput ref={searchRef} value={query} onChangeText={setQuery} accessibilityLabel={t('scripts.searchCharacters')}
                placeholder={t('scripts.searchCharacters')} placeholderTextColor={p.inkMuted} returnKeyType="search"
                // Enter on a single match adds it, so typing a name and Enter builds a script quickly.
                onSubmitEditing={() => { const pick = searchPick(search); if (pick) { onToggle(pick.id); setQuery('') } }} blurOnSubmit={false}
                onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}
                style={[type.text.body, styles.searchInput, { color: p.ink }]} />
              {query !== '' ? <IconButton icon="close" label={t('scripts.clearSearch')} onPress={() => { setQuery(''); searchRef.current?.focus() }} surface="paper" /> : null}
            </View>
            <select aria-label={t('scripts.filterEdition')} value={edition} onChange={event => setEdition(event.target.value)} style={selectStyle}>
              <option value="all">{t('scripts.allEditions')}</option>
              {editions.map(value => <option key={value.id} value={value.id}>{gameText(settings.locale).edition(value.id).name}</option>)}
              <option value="carousel">{t('scripts.experimental')}</option>
              {anyHomebrew || edition === 'homebrew' ? <option value="homebrew">{t('scripts.homebrew')}</option> : null}
            </select>
          </View>
          <ChipStyles />
          <div ref={chips} role="radiogroup" aria-label={t('scripts.filterTeam')} className="picker-teams">
            <label className="picker-team">
              <input type="radio" name={teamGroup} checked={team === 'all'} aria-label={t('scripts.allTeams')} onChange={() => onTeamChange('all')} />
              <span className="picker-team-name" style={{ color: p.ink }}>{t('scripts.allTeams')}</span>
            </label>
            {sheetTeams.map(value => {
              const count = countOf(value)
              return (
                <label key={value} className="picker-team">
                  <input type="radio" name={teamGroup} checked={team === value} aria-label={count ? `${teams[value]}, ${count.said}` : teams[value]} onChange={() => onTeamChange(value)} />
                  <span className="picker-team-name" style={{ color: p.teamOnPaper[value] }}>{teams[value]}</span>
                  {count ? <span className="picker-team-count">{count.short}</span> : null}
                </label>
              )
            })}
          </div>
        </View>
        {shown.length === 0 ? (
          <View style={styles.empty}>
            <Text accessibilityLiveRegion="polite" style={[type.text.body, { color: p.inkMuted }]}>{t('scripts.nothingMatches')}</Text>
            {create}
            <Button label={t('scripts.clearFilters')} onPress={() => { setQuery(''); setEdition('all'); onTeamChange('all') }} surface="paper" variant="text" />
          </View>
        ) : <>
          {shown.map(c => (
            <PickerRow key={c.id} character={c} selected={selectedIds.has(c.id)} label={t(selectedIds.has(c.id) ? 'scripts.removeCharacter' : 'scripts.addCharacter', { name: c.name })} onToggle={onToggle} />
          ))}
          <View style={styles.last}>{create}</View>
        </>}
      </ScrollView>
    </View>
  )

  if (wide) {
    const slide = entry.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : space.xl, 0] })
    return <Animated.View style={[styles.grow, { opacity: entry, transform: [{ translateX: slide }] }]}>{content}</Animated.View>
  }
  return (
    <Modal visible={visible} animationType={reduced ? 'fade' : 'slide'} onRequestClose={onClose} onDismiss={() => setMounted(false)}>
      {/* The list ends above the keyboard, so every match stays reachable while searching. */}
      <View style={[styles.grow, { maxHeight: viewport.height || undefined, top: viewport.top }]}>{content}</View>
    </Modal>
  )
}

// The window height that fits the header and the pinned search and chips, about 170 points, with
// two rows of 74 to 92 below them. A phone on its side just fits; a keyboard over one does not.
const pinFrom = 340

// The team filter: native radios, one tab stop and arrow keys, each lying unseen over its chip.
// The row scrolls sideways under the thumb and bleeds to the panel's edges, so a chip cut by
// the edge says there are more. Every element is positioned like the views around it, or the
// paper texture paints over it.
const ChipStyles = () => <style href="grimoire-picker-teams" precedence="default">{`
  .picker-teams {
    position: relative; display: flex; gap: ${space.xs}px; overflow-x: auto; scrollbar-width: none;
    margin: 0 -${space.sm + space.xs}px; padding: ${focusRing.width + focusRing.offset}px ${space.sm + space.xs}px;
  }
  .picker-teams::-webkit-scrollbar { display: none; }
  .picker-team {
    position: relative; flex: none; display: flex; align-items: center; gap: ${space.xs}px; min-height: ${touch}px; box-sizing: border-box;
    padding: 0 ${space.md}px; cursor: pointer; border: ${border}px solid ${palette.parchmentShade}; border-radius: ${radius.control}px;
    -webkit-tap-highlight-color: transparent;
    transition: border-color ${motion.duration.mark}ms ${motion.css.ease}, background-color ${motion.duration.mark}ms ${motion.css.ease};
  }
  .picker-team input { position: absolute; inset: 0; z-index: 1; width: 100%; height: 100%; opacity: 0; margin: 0; cursor: pointer; }
  .picker-team:hover { background-color: ${hoverWash.paper}; }
  .picker-team:active { opacity: ${motion.pressedOpacity}; }
  .picker-team:has(input:focus-visible) { outline: ${focusRing.width}px solid ${palette.ink}; outline-offset: ${focusRing.offset}px; }
  .picker-team:has(input:checked) { border-color: ${palette.accent}; background-color: ${palette.paperPressed}; }
  .picker-team-name { font: ${type.text.small.fontSize}px/${type.text.small.lineHeight}px ${type.text.strong.fontFamily}; white-space: nowrap; }
  .picker-team-count {
    font: ${type.text.small.fontSize}px/${type.text.small.lineHeight}px ${type.text.small.fontFamily}; font-variant-numeric: tabular-nums;
    color: ${palette.inkMuted}; white-space: nowrap;
  }
  @media (prefers-reduced-motion: reduce) { .picker-team { transition: none; } }
`}</style>

const PickerRow = memo(function PickerRow({ character, selected, label, onToggle }: {
  readonly character: Listed
  readonly selected: boolean
  readonly label: string
  readonly onToggle: (id: string) => void
}) {
  const p = palette
  const focusVisible = useFocusVisible()
  return (
    <Pressable accessibilityRole="checkbox" accessibilityLabel={label} aria-checked={selected} onPress={() => onToggle(character.id)} style={state => [styles.row, focusStyle(p, isFocused(state) && focusVisible, 'paper'), { backgroundColor: selected ? p.paperPressed : 'transparent', opacity: state.pressed ? 0.7 : 1 }]}>
      <CharacterIcon id={character.id} team={character.team} size={56} lazy />
      <View style={styles.grow}>
        <Text style={[type.text.strong, { color: p.teamOnPaper[character.team] }]}>{character.name}</Text>
        <Text style={[type.text.small, { color: p.ink }]}><AbilityText text={character.ability} /></Text>
      </View>
      <Icon name={selected ? 'check' : 'add'} size={20} color={p.inkMuted} />
    </Pressable>
  )
})

const styles = StyleSheet.create({
  panel: { flex: 1, minHeight: 0, minWidth: 0 },
  grow: { flex: 1, minWidth: 0, minHeight: 0 },
  header: { minHeight: touch, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm },
  // The top padding keeps the search's focus ring inside the scroll area.
  filters: { paddingHorizontal: space.xs, paddingTop: space.sm, gap: space.xs },
  // It spans the list's side padding too, so no row shows beside it. React Native's types lack
  // sticky, which only the web draws.
  pinned: { position: 'sticky', top: 0, zIndex: 1, paddingBottom: space.xs, marginHorizontal: -space.sm, paddingHorizontal: space.sm + space.xs } as object,
  filterRow: { flexDirection: 'row', gap: space.sm },
  search: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: touch, paddingLeft: space.md, borderRadius: radius.control, backgroundColor: palette.paperInset, borderWidth: 1, borderColor: palette.parchmentShade },
  // The browser's own ring on a focused input has style auto, which ignores a zero width, so the
  // style is set too and only the pill's ring shows.
  searchInput: { flex: 1, minWidth: 0, minHeight: touch, paddingVertical: 0, outlineStyle: 'solid', outlineWidth: 0 },
  roster: { paddingHorizontal: space.sm, paddingBottom: space.lg, gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: radius.control },
  empty: { alignItems: 'center', padding: space.lg, gap: space.sm },
  last: { paddingTop: space.md, paddingHorizontal: space.xs },
})
