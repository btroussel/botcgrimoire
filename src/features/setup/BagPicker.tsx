import type { CharacterId, Script, Translate } from '../../content'
import { isLoose } from '../../content'
import { useStore } from '../../store'
import type { Listed } from '../../store/scriptSheet'
import { listed, sheetGroups, teamLabels } from '../../store/scriptSheet'
import { EdgeButton } from '../../ui/EdgeButton'
import { Picker } from '../../ui/Picker'
import { palette } from '../../ui/theme'

// The same team-grouped token grid as the seat's character picker, so a bag is picked by art.
const tokenGroups = (roles: readonly Listed[], t: Translate) =>
  sheetGroups(roles, teamLabels(t)).map(group => ({ key: group.team, label: group.label, color: palette.teamOnPaper[group.team], rows: group.rows.map(row => ({ id: row.id, character: row.id, name: row.name })) }))

export const BagPicker = ({ script, count, selected, visible, onClose, onFill }: {
  readonly script: Script; readonly count: number; readonly selected: readonly CharacterId[]
  readonly visible: boolean; readonly onClose: () => void; readonly onFill: (bag: readonly CharacterId[]) => void
}) => {
  const { t, settings } = useStore()
  const roles = listed(script, settings.locale).filter(role => !isLoose(role.id))
  return <Picker visible={visible} title={t('setup.fillBag')} onClose={onClose} closeLabel={t('common.close')}
    selected={selected} emptyLabel={t('setup.manualEmptyBag')} tokenGrid groups={tokenGroups(roles, t)}
    multi={{ min: 1, max: count, repeat: true, confirmLabel: n => t('setup.fillBagSave', { count: n }), onConfirm: ids => onFill(ids as CharacterId[]) }} />
}

// The character a Drunk, Lunatic or Marionette in the bag shows its player. Random hands the
// choice back to the bag, so it is offered only once a character is chosen.
export const ShownPicker = ({ name, choices, chosen, visible, onClose, onChoose }: {
  readonly name: string; readonly choices: readonly Listed[]; readonly chosen: CharacterId | undefined
  readonly visible: boolean; readonly onClose: () => void; readonly onChoose: (shown: CharacterId | undefined) => void
}) => {
  const { t } = useStore()
  return <Picker visible={visible} title={t('setup.disguiseTitle', { name })} onClose={onClose} closeLabel={t('common.close')}
    groups={tokenGroups(choices, t)} tokenGrid {...(chosen ? { selected: [chosen] } : {})} onPick={id => onChoose(id as CharacterId)}
    right={chosen ? <EdgeButton label={t('setup.disguiseRandom')} onPress={() => onChoose(undefined)} /> : null}
    emptyLabel={t('board.nothingMatches')} />
}
