import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import type { CharacterId, Script, Translate } from '../../content'
import { isLoose } from '../../content'
import { useStore } from '../../store'
import type { Listed } from '../../store/scriptSheet'
import { listed, sheetGroups, teamLabels } from '../../store/scriptSheet'
import { Button } from '../../ui/Button'
import { Drawer, useOnOpen } from '../../ui/Drawer'
import { palette, space, tabular, type } from '../../ui/theme'
import { TokenKeys } from '../../ui/TokenKeys'

// The same team rows of token keys as the seat's character drawer, so a bag is picked by art.
const keyGroups = (roles: readonly Listed[], t: Translate) =>
  sheetGroups(roles, teamLabels(t)).map(group => ({ key: group.team, label: group.label, color: palette.teamOnPaper[group.team],
    keys: group.rows.map(row => ({ id: row.id, name: row.name })) }))

// The keys pick the bag as the bluffs drawer picks bluffs: a tap puts a character in or takes it
// back out, the ticked keys are the bag and the count stands for what is scrolled away. A long
// press puts in one more copy, as on the new game sheet, and the key's badge counts them. The bag
// holds as many tokens as there are seats for it.
export const BagPicker = ({ script, count, selected, visible, onClose, onFill }: {
  readonly script: Script; readonly count: number; readonly selected: readonly CharacterId[]
  readonly visible: boolean; readonly onClose: () => void; readonly onFill: (bag: readonly CharacterId[]) => void
}) => {
  const { t, settings } = useStore()
  const roles = listed(script, settings.locale).filter(role => !isLoose(role.id))
  const [bag, setBag] = useState<readonly CharacterId[]>(() => selected.slice(0, count))
  useOnOpen(visible, () => setBag(selected.slice(0, count)))
  const full = bag.length >= count
  const toggle = (id: CharacterId) => setBag(bag.includes(id) ? bag.filter(have => have !== id) : full ? bag : [...bag, id])
  const addCopy = (id: CharacterId) => { if (!full) setBag([...bag, id]) }
  return <Drawer visible={visible} title={t('setup.fillBag')} onClose={onClose} closeLabel={t('common.close')}
    dock={<View style={styles.actions}>
      <Text accessibilityLiveRegion="polite" style={[type.text.strong, tabular, { color: palette.ink }]}>{t('setup.ofCount', { have: bag.length, of: count })}</Text>
      <Button label={t('common.save')} onPress={() => onFill(bag)} variant="primary" surface="paper" disabled={bag.length === 0} style={styles.save} />
    </View>}>
    {roles.length === 0 ? <Text style={[type.text.body, styles.empty, { color: palette.inkMuted }]}>{t('setup.manualEmptyBag')}</Text> : null}
    <TokenKeys groups={keyGroups(roles, t)} chosen={bag} full={full}
      onPress={k => toggle(k.id as CharacterId)} onLongPress={k => addCopy(k.id as CharacterId)} />
  </Drawer>
}

// The character a Drunk or Lunatic in the bag shows its player. Clearing hands the
// choice back to the bag, so it is offered only once a character is chosen.
export const ShownPicker = ({ name, choices, chosen, visible, onClose, onChoose }: {
  readonly name: string; readonly choices: readonly Listed[]; readonly chosen: CharacterId | undefined
  readonly visible: boolean; readonly onClose: () => void; readonly onChoose: (shown: CharacterId | undefined) => void
}) => {
  const { t } = useStore()
  return <Drawer visible={visible} title={t('setup.disguiseTitle', { name })} onClose={onClose} closeLabel={t('common.close')}
    // At the foot, apart from the cross, as a seat's Clear character is.
    {...(chosen ? { dock: <View style={styles.clear}><Button variant="text" surface="paper" label={t('setup.disguiseClear')} onPress={() => onChoose(undefined)} /></View> } : {})}>
    {choices.length === 0 ? <Text style={[type.text.body, styles.empty, { color: palette.inkMuted }]}>{t('board.nothingMatches')}</Text> : null}
    <TokenKeys groups={keyGroups(choices, t)} chosen={chosen ? [chosen] : []} onPress={k => onChoose(k.id as CharacterId)} />
  </Drawer>
}

const styles = StyleSheet.create({
  clear: { alignItems: 'flex-start' },
  // The count keeps its place and Save fills the rest of the row, as the bluffs drawer's buttons do.
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  save: { flex: 1 },
  empty: { paddingVertical: space.lg, textAlign: 'center' },
})
