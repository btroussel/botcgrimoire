import { useState } from 'react'
import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native'

import type { CharacterId, Script } from '../../content'
import { editionAuthor, gameText, isLoose, scriptAuthor, scriptName, scriptRules } from '../../content'
import { editionArt } from '../../content/generated/art'
import { useStore } from '../../store'
import { jinxesAmong, listed, sheetGroups, sheetLabels, teamLabels, unknownNotice } from '../../store/scriptSheet'
import { Button, IconButton } from '../../ui/Button'
import { ScriptSheet } from '../../ui/ScriptSheet'
import { palette, radius, shadows, space, tabular, touch, type } from '../../ui/theme'
import { randomBag } from './randomBag'
import { dealTarget, scriptLoose, seatedCharacters, showsCopies } from './setup'

const setupNotes: Readonly<Record<string, string>> = {
  drunk: 'setup.prepareDrunk',
  lunatic: 'setup.prepareLunatic',
  marionette: 'setup.prepareMarionette',
  bountyhunter: 'setup.prepareBountyHunter',
  alchemist: 'setup.prepareAbilities',
  boffin: 'setup.prepareAbilities',
  hermit: 'setup.prepareHermit',
  kazali: 'setup.prepareKazali',
  lordoftyphon: 'setup.prepareTyphon',
  lilmonsta: 'setup.prepareLilMonsta',
}

export const SetupScriptSheet = ({ script, count, bag, busy, error, onCount, onBag, onCreate }: {
  readonly script: Script
  readonly count: number
  readonly bag: readonly CharacterId[]
  readonly busy: boolean
  readonly error: boolean
  readonly onCount: (count: number) => void
  readonly onBag: (bag: readonly CharacterId[]) => void
  readonly onCreate: () => void
}) => {
  const { t, settings } = useStore()
  const [shuffleError, setShuffleError] = useState(false)
  const [footerHeight, setFooterHeight] = useState(touch)
  const { width } = useWindowDimensions()
  const compact = width < 640
  const text = gameText(settings.locale)
  const roles = [...new Map(listed(script, settings.locale).map(role => [role.id, role])).values()]
  const seated = seatedCharacters(bag)
  const target = dealTarget(count, bag)
  const teams = sheetGroups(roles, teamLabels(t)).map(group => {
    // The script's Fabled and Loric take no seat, so their bands count nothing.
    const loose = group.team === 'fabled' || group.team === 'loric'
    const have = seated.filter(id => group.rows.some(row => row.id === id)).length
    const of = target[group.team]
    return {
      ...group,
      ...(loose ? {} : { count: of !== undefined ? { have, of, label: t('scripts.ofTarget', { have, of }) } : { have, of: 0, label: String(have) } }),
      rows: group.rows.map(row => {
        const inBag = bag.filter(id => id === row.id).length
        const note = loose ? 'setup.looseNote' : roles.find(role => role.id === row.id)?.homebrew ? 'setup.prepareHomebrew'
          : row.id === 'villageidiot' && inBag > 1 ? 'setup.prepareVillageIdiot' : setupNotes[row.id]
        const copies = showsCopies(row.id as CharacterId, inBag)
        return { ...row, inBag, ...(copies || (inBag && note) ? {
          below: <>
            {inBag && note ? <Text style={[type.text.small, { color: palette.inkMuted }]}>{t(note)}</Text> : null}
            {copies ? <View style={styles.copies}>
              <IconButton icon="minus" label={t('setup.removeCopy', { name: row.name })} surface="paper" style={styles.step}
                disabled={busy} onPress={() => removeCopy(row.id)} />
              <IconButton icon="add" label={t('setup.addCopy', { name: row.name })} surface="paper" style={styles.step}
                disabled={busy || seated.length >= count} onPress={() => addCopy(row.id)} />
            </View> : null}
          </>,
        } : {}) }
      }),
    }
  })
  const author = typeof script === 'string' ? editionAuthor : scriptAuthor(script)
  const toggle = (id: string) => {
    if (busy) return
    setShuffleError(false)
    const role = id as CharacterId
    if (bag.includes(role)) onBag(bag.filter(selected => selected !== role))
    else if (isLoose(role) || seated.length < count) onBag([...bag, role])
  }
  const addCopy = (id: string) => {
    if (busy || seated.length >= count) return
    setShuffleError(false)
    onBag([...bag, id as CharacterId])
  }
  // A character that takes no seat has no second token, so a slow tap on it still selects it.
  const longPress = (id: string) => isLoose(id as CharacterId) ? toggle(id) : addCopy(id)
  const removeCopy = (id: string) => {
    if (busy) return
    setShuffleError(false)
    const at = bag.lastIndexOf(id as CharacterId)
    onBag([...bag.slice(0, at), ...bag.slice(at + 1)])
  }
  const shuffle = () => {
    const next = randomBag(roles, count)
    setShuffleError(next === undefined)
    // Shuffle draws the seats; the Fabled and Loric chosen for the board stay as they were.
    if (next) onBag([...next, ...scriptLoose(roles).filter(id => bag.includes(id))])
  }
  const changeCount = (next: number) => {
    setShuffleError(false)
    onCount(next)
  }
  // Both notices sit with the buttons that caused them, which may be far below the header.
  const notice = error ? t('setup.createError') : shuffleError ? t('setup.shuffleUnavailable') : undefined
  const unknown = unknownNotice(script, t)
  return <View style={styles.root}>
    <ScriptSheet mode="deal" teams={teams} jinxes={jinxesAmong(roles, settings.locale)} selected={bag}
    {...(unknown ? { notice: unknown } : {})}
    rules={scriptRules(script)}
    bottomInset={footerHeight + space.md + space.lg}
    onTapCharacter={toggle} onLongPressCharacter={longPress}
    labels={sheetLabels(t)}
    scrollHeader={<View style={[styles.heading, compact && styles.stacked]}>
      <View style={[styles.identity, compact && styles.stackedIdentity]}>
        <Image source={editionArt[typeof script === 'string' ? script : 'custom']} style={styles.logo} resizeMode="contain" />
        <View style={styles.identityText}>
          <Text style={[type.text.strong, { color: palette.ink }]}>{typeof script === 'string' ? text.edition(script).name : scriptName(script)}</Text>
          {author ? <Text style={[type.text.small, { color: palette.inkMuted }]}>{author}</Text> : null}
        </View>
      </View>
      <View style={[styles.stepper, compact && styles.centered]}>
        <IconButton icon="minus" label={t('setup.fewerPlayers')} surface="paper" style={styles.step}
          disabled={busy || count <= 1} onPress={() => changeCount(count - 1)} />
        <Text accessibilityLiveRegion="polite" style={[type.text.strong, tabular, styles.count, { color: palette.ink }]}>{t('setup.playersCount', { count })}</Text>
        <IconButton icon="add" label={t('setup.morePlayers')} surface="paper" style={styles.step}
          disabled={busy || count >= 20} onPress={() => changeCount(count + 1)} />
      </View>
    </View>} />
    <View pointerEvents="box-none" style={styles.footer} onLayout={event => setFooterHeight(event.nativeEvent.layout.height)}>
      {notice ? <Text accessibilityRole="alert" style={[type.text.small, styles.notice, { color: palette.danger }]}>{notice}</Text> : null}
      <View pointerEvents="box-none" style={styles.actions}>
        {/* A phone has room for one labelled button; the shuffle glyph is familiar enough alone. */}
        {width < 440
          ? <IconButton surface="paper" icon="shuffle" label={t('setup.shuffleBag')} style={[styles.floating, styles.step]}
            disabled={busy || roles.length === 0} onPress={shuffle} />
          : <Button surface="paper" icon="shuffle" label={t('setup.shuffle')} accessibilityLabel={t('setup.shuffleBag')}
            style={styles.floating} disabled={busy || roles.length === 0} onPress={shuffle} />}
        <Button surface="paper" variant="primary" icon="play" label={t('setup.manualOpen')} disabled={busy} onPress={onCreate} />
      </View>
    </View>
  </View>
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: space.sm },
  stacked: { flexDirection: 'column', alignItems: 'stretch' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
  stackedIdentity: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%' },
  logo: { width: 88, height: 56, flexShrink: 0 },
  identityText: { flex: 1, minWidth: 0, gap: space.xs },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 0 },
  copies: { flexDirection: 'row', gap: space.sm },
  step: { borderColor: palette.parchmentShade },
  // Wide enough for "20 joueurs", so the buttons stay put while the number changes.
  count: { minWidth: 96, textAlign: 'center' },
  centered: { alignSelf: 'center' },
  footer: { position: 'absolute', left: space.sm, right: space.sm, bottom: space.md, gap: space.sm, alignItems: 'center' },
  notice: { maxWidth: 480, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.control,
    backgroundColor: palette.parchment, borderWidth: 1, borderColor: palette.parchmentShade, boxShadow: shadows.card },
  actions: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.sm, maxWidth: '100%' },
  // A secondary button is see-through by design; floating over rows it needs the paper behind it.
  floating: { backgroundColor: palette.parchment, borderRadius: radius.control, boxShadow: shadows.card },
})
