import type { CharacterId } from '../../content'
import type { Grimoire, Payload } from '../../engine'
import type { PickerGroup } from '../../ui/Picker'
import { Picker } from '../../ui/Picker'
import { palette } from '../../ui/theme'
import { looseChoices } from './board'
import { pickerGroups } from './seat'
import { useEdits } from './useEdits'

// The bag never deals a loose character, so the Storyteller puts it in and takes it out here.
export const LooseCharacters = ({ board, disabled, visible, onClose }: {
  readonly board: Grimoire
  readonly disabled: boolean
  readonly visible: boolean
  readonly onClose: () => void
}) => {
  const e = useEdits()
  const candidates = looseChoices(board.script)
  if (candidates.length === 0) return null
  const groups: readonly PickerGroup[] = pickerGroups(candidates, e.teamLabel, palette.teamOnPaper, (id) => ({
    id,
    character: id,
    name: e.name(id),
    detail: e.ability(id),
  }))
  const confirm = (ids: readonly string[]) => {
    if (disabled || e.lookingBack) return
    const wanted = ids as readonly CharacterId[]
    e.appendAll([
      ...board.loose.filter((id) => !wanted.includes(id)).map((of): Payload => ({ kind: 'removeLoose', character: of })),
      ...wanted.filter((id) => !board.loose.includes(id)).map((of): Payload => ({ kind: 'addLoose', character: of })),
    ])
    onClose()
  }
  return <Picker
      visible={visible}
      title={e.t('board.looseTitle')}
      onClose={onClose}
      closeLabel={e.t('common.close')}
      groups={groups}
      selected={board.loose}
      compactReference
      multi={{ max: candidates.length, min: 0, confirmLabel: () => e.t('common.save'), onConfirm: confirm }}
      emptyLabel={e.t('board.nothingMatches')}
    />
}
