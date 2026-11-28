// The card as the board brings it up: its dialog, the script's characters as its keys, what it
// offers while empty and its labels. It is mounted only while a card is up, so none of that is
// built for a board that shows none.
import { Modal } from 'react-native'

import type { CharacterId } from '../../content'
import { useBoardInteraction } from '../../ui/BoardInteraction'
import type { CardSpec } from '../../ui/BoardInteraction'
import { Card } from './Card'
import { characterGroups } from './seat'
import { useCardOffers } from './useCards'
import { useEdits } from './useEdits'

export const BoardCard = ({ spec, bluffs, onBluffs }: {
  readonly spec: CardSpec
  readonly bluffs: readonly CharacterId[] // the saved ones, which the not-in-play phrase writes
  readonly onBluffs: () => void // opens the bluffs drawer, on the way to that card
}) => {
  const e = useEdits()
  const { closeCard } = useBoardInteraction()
  const offers = useCardOffers(bluffs, onBluffs)
  if (!e.board) return null
  const t = e.t
  return (
    // A card's words and tokens change as they are typed, so the dialog is named for the action.
    <Modal visible animationType="none" onRequestClose={closeCard} aria-label={t('board.show')}>
      <Card spec={spec} keys={e.keyGroups(characterGroups(e.board.script))} answers={offers.answers} presets={offers.presets}
        onDismiss={closeCard}
        labels={{
          close: t('common.close'), placeholder: t('board.notePlaceholder'), message: t('board.noteMessage'),
          keyboard: t('board.noteKeyboard'), letters: t('board.noteLetters'), tokens: t('board.noteTokens'),
        }} />
    </Modal>
  )
}
