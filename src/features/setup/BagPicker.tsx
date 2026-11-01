import type { CharacterId, Script } from '../../content'
import { isLoose } from '../../content'
import { useStore } from '../../store'
import { listed, sheetGroups, teamLabels } from '../../store/scriptSheet'
import { Picker } from '../../ui/Picker'
import { palette } from '../../ui/theme'

// The same team-grouped token grid as the seat's character picker, so a bag is picked by art.
export const BagPicker = ({ script, count, selected, visible, onClose, onFill }: {
  readonly script: Script; readonly count: number; readonly selected: readonly CharacterId[]
  readonly visible: boolean; readonly onClose: () => void; readonly onFill: (bag: readonly CharacterId[]) => void
}) => {
  const { t, settings } = useStore()
  const roles = listed(script, settings.locale).filter(role => !isLoose(role.id))
  const groups = sheetGroups(roles, teamLabels(t)).map(group => ({ key: group.team, label: group.label, color: palette.teamOnPaper[group.team], rows: group.rows.map(row => ({ id: row.id, character: row.id, name: row.name })) }))
  return <Picker visible={visible} title={t('setup.fillBag')} onClose={onClose} closeLabel={t('common.close')}
    selected={selected} emptyLabel={t('setup.manualEmptyBag')} tokenGrid groups={groups}
    multi={{ min: 1, max: count, repeat: true, confirmLabel: n => t('setup.fillBagSave', { count: n }), onConfirm: ids => onFill(ids as CharacterId[]) }} />
}
