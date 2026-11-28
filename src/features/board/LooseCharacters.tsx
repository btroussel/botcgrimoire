import { useState } from 'react'

import type { CharacterId } from '../../content'
import type { Grimoire, Payload } from '../../engine'
import { Button } from '../../ui/Button'
import { Drawer, useOnOpen } from '../../ui/Drawer'
import { TokenKeys } from '../../ui/TokenKeys'
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
  useOnOpen(visible, () => setChosen(board.loose))
  const candidates = looseChoices(board.script)
  if (candidates.length === 0) return null
  const groups = e.keyGroups(byTeam(candidates))
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
    dock={<Button label={e.t('common.save')} onPress={save} variant="primary" surface="paper" />}>
    <TokenKeys groups={groups} chosen={chosen} onPress={(k) => toggle(k.id as CharacterId)} />
  </Drawer>
}
