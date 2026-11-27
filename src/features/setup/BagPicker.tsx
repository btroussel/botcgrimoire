import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import type { CharacterId, Script, Translate } from '../../content'
import { isLoose } from '../../content'
import { useStore } from '../../store'
import type { Listed } from '../../store/scriptSheet'
import { listed, sheetGroups, teamLabels } from '../../store/scriptSheet'
import { Button } from '../../ui/Button'
import { Drawer } from '../../ui/Drawer'
import { EdgeButton } from '../../ui/EdgeButton'
import { palette, space, tabular, tokenKeys, type } from '../../ui/theme'
import { Token } from '../../ui/Token'
import { TokenKeys, tokenKeysWidth } from '../../ui/TokenKeys'

// The same team rows of token keys as the seat's character drawer, so a bag is picked by art.
const keyGroups = (roles: readonly Listed[], t: Translate) =>
  sheetGroups(roles, teamLabels(t)).map(group => ({ key: group.team, label: group.label, color: palette.teamOnPaper[group.team],
    keys: group.rows.map(row => ({ id: row.id, name: row.name })) }))

// A key puts one more copy in the bag, so a character can go in twice, and a token in the bag
// comes back out. The bag holds as many tokens as there are seats for it.
export const BagPicker = ({ script, count, selected, visible, onClose, onFill }: {
  readonly script: Script; readonly count: number; readonly selected: readonly CharacterId[]
  readonly visible: boolean; readonly onClose: () => void; readonly onFill: (bag: readonly CharacterId[]) => void
}) => {
  const { t, settings } = useStore()
  const roles = listed(script, settings.locale).filter(role => !isLoose(role.id))
  const [bag, setBag] = useState<readonly CharacterId[]>(() => selected.slice(0, count))
  // The bag starts over each time the drawer opens; the edge is read during render so the same
  // open state passing again changes nothing.
  const [wasVisible, setWasVisible] = useState(visible)
  if (visible !== wasVisible) {
    setWasVisible(visible)
    if (visible) setBag(selected.slice(0, count))
  }
  const full = bag.length >= count
  const name = (id: CharacterId) => roles.find(role => role.id === id)?.name ?? id
  return <Drawer visible={visible} title={t('setup.fillBag')} onClose={onClose} closeLabel={t('common.close')}
    dock={<View style={styles.dock}>
      {/* A slot for every seat the bag fills, in the keys' columns, so the bag shows where it ends and
          keeps its height as it fills. */}
      <View style={styles.bag}>
        {Array.from({ length: count }, (_, index) => {
          const id = bag[index]
          return id ? <Token key={index} size={tokenKeys.size} character={id} name={name(id)} toggle={false} surface="paper"
            accessibilityLabel={t('setup.removeCopy', { name: name(id) })}
            onPress={() => setBag(bag.filter((_, at) => at !== index))} />
            : <View key={index} aria-hidden><Token size={tokenKeys.size} /></View>
        })}
      </View>
      <View style={styles.actions}>
        <Text accessibilityLiveRegion="polite" style={[type.text.strong, tabular, { color: palette.ink }]}>{t('setup.ofCount', { have: bag.length, of: count })}</Text>
        <Button label={t('common.save')} onPress={() => onFill(bag)} variant="primary" surface="paper" disabled={bag.length === 0} style={styles.save} />
      </View>
    </View>}>
    {roles.length === 0 ? <Text style={[type.text.body, styles.empty, { color: palette.inkMuted }]}>{t('setup.manualEmptyBag')}</Text> : null}
    <TokenKeys groups={keyGroups(roles, t)} chosen={bag} full={full}
      onPress={k => { if (!full) setBag([...bag, k.id as CharacterId]) }} />
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
    {...(chosen ? { right: <EdgeButton label={t('setup.disguiseClear')} onPress={() => onChoose(undefined)} /> } : {})}>
    {choices.length === 0 ? <Text style={[type.text.body, styles.empty, { color: palette.inkMuted }]}>{t('board.nothingMatches')}</Text> : null}
    <TokenKeys groups={keyGroups(choices, t)} chosen={chosen ? [chosen] : []} onPress={k => onChoose(k.id as CharacterId)} />
  </Drawer>
}

const styles = StyleSheet.create({
  dock: { gap: space.md, width: '100%', maxWidth: tokenKeysWidth, alignSelf: 'center' },
  bag: { flexDirection: 'row', flexWrap: 'wrap', gap: tokenKeys.gap },
  // The count keeps its place and Save fills the rest of the row, as the bluffs drawer's buttons do.
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  save: { flex: 1 },
  empty: { paddingVertical: space.lg, textAlign: 'center' },
})
