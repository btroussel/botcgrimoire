import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import type { CharacterId } from '../../content'
import type { Grimoire, Payload } from '../../engine'
import { Button } from '../../ui/Button'
import { Drawer } from '../../ui/Drawer'
import { palette } from '../../ui/theme'
import { TokenKeys, tokenKeysWidth } from '../../ui/TokenKeys'
import { looseChoices } from './board'
import { byTeam } from './seat'
import { useEdits } from './useEdits'

// The bag never deals a loose character, so the Storyteller puts it in and takes it out here.
// Each key toggles, and nothing is recorded until Save.
export const LooseCharacters = ({ board, disabled, visible, onClose }: {
  readonly board: Grimoire
  readonly disabled: boolean
  readonly visible: boolean
  readonly onClose: () => void
}) => {
  const e = useEdits()
  const [chosen, setChosen] = useState<readonly CharacterId[]>(board.loose)
  // The set starts over each time the drawer opens; the edge is read during render so the same
  // open state passing again changes nothing.
  const [wasVisible, setWasVisible] = useState(visible)
  if (visible !== wasVisible) {
    setWasVisible(visible)
    if (visible) setChosen(board.loose)
  }
  const candidates = looseChoices(board.script)
  if (candidates.length === 0) return null
  const groups = byTeam(candidates).map((g) => ({ key: g.team, label: e.teamLabel(g.team), color: palette.teamOnPaper[g.team],
    keys: g.ids.map((id) => ({ id, name: e.name(id) })) }))
  const toggle = (id: CharacterId) => setChosen(chosen.includes(id) ? chosen.filter((c) => c !== id) : [...chosen, id])
  const save = () => {
    if (disabled || e.lookingBack) return
    e.appendAll([
      ...board.loose.filter((id) => !chosen.includes(id)).map((of): Payload => ({ kind: 'removeLoose', character: of })),
      ...chosen.filter((id) => !board.loose.includes(id)).map((of): Payload => ({ kind: 'addLoose', character: of })),
    ])
    onClose()
  }
  return <Drawer visible={visible} title={e.t('board.looseTitle')} onClose={onClose} closeLabel={e.t('common.close')}
    dock={<View style={styles.dock}><Button label={e.t('common.save')} onPress={save} variant="primary" surface="paper" /></View>}>
    <TokenKeys groups={groups} chosen={chosen} onPress={(k) => toggle(k.id)} />
  </Drawer>
}

// Save fills the row under the keys' columns: the whole row on a phone, and no wider than the keys
// in a wide drawer.
const styles = StyleSheet.create({
  dock: { width: '100%', maxWidth: tokenKeysWidth, alignSelf: 'center' },
})
