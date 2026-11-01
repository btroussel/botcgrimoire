// Manual cards ask only for content they display. Opening one never writes to the game log.
import { useState } from 'react'

import type { CharacterId } from '../../content'
import type { SeatId } from '../../engine'
import { bluffsOf } from '../../store/bluffs'
import { useBoardInteraction } from '../../ui/BoardInteraction'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/Field'
import type { InfoTokenItem } from './InfoTokenList'
import { InfoTokenList } from './InfoTokenList'
import type { PickerGroup } from '../../ui/Picker'
import { Picker } from '../../ui/Picker'
import { Sheet } from '../../ui/Sheet'
import { palette } from '../../ui/theme'
import { bluffChoices, characterGroups, pickerGroups, roster } from './seat'
import type { ShowChoice, ShowKind, ShowToken } from './show'
import { believed, seatStart, showTokens, showing } from './show'
import { useEdits } from './useEdits'

export interface ShowSheetProps {
  readonly visible: boolean
  readonly onClose: () => void
  readonly onReopen: () => void // the sheet steps aside for a seat pick on the ring, then comes back
}

// The words on each card, sentence case here and set uppercase by the card.
const wordsKey: Readonly<Record<ShowKind, string>> = {
  youAre: 'board.youAre',
  youAreGood: 'board.cardYouAreGood',
  youAreEvil: 'board.cardYouAreEvil',
  thisPlayerIs: 'board.cardThisPlayerIs',
  thisCharacterIs: 'board.cardThisCharacterIs',
  selectedYou: 'board.cardSelectedYou',
  thisIsTheDemon: 'board.cardThisIsTheDemon',
  theseAreYourMinions: 'board.cardTheseAreYourMinions',
  notInPlay: 'board.notInPlayWords',
}

const bluffCount = 3

type Step =
  | { readonly kind: 'tokens' }
  | { readonly kind: 'note' }
  | { readonly kind: 'about'; readonly token: ShowToken; readonly seat?: SeatId }

export const ShowSheet = ({ visible, onClose, onReopen }: ShowSheetProps) => {
  const e = useEdits()
  const interaction = useBoardInteraction()
  const t = e.t
  const board = e.board
  const [step, setStep] = useState<Step>({ kind: 'tokens' })
  const [note, setNote] = useState('')
  // The flow starts over each time the sheet opens, unless it comes back from a seat pick; the
  // edge is read during render.
  const [resume, setResume] = useState<Step | undefined>(undefined)
  const [wasVisible, setWasVisible] = useState(visible)
  if (visible !== wasVisible) {
    setWasVisible(visible)
    if (visible) {
      setStep(resume ?? { kind: 'tokens' })
      setResume(undefined)
      setNote('')
    }
  }

  const savedBluffs = board ? bluffsOf(board, e.log) : []
  const items: readonly InfoTokenItem[] = [...showTokens.map((x) => ({
    kind: x.kind,
    label: t(wordsKey[x.kind]),
    ...(x.kind === 'notInPlay' ? { characters: savedBluffs } : {}),
  })), { kind: 'custom', label: t('board.customNote') }]

  const show = (token: ShowToken, choice: ShowChoice) => {
    onClose()
    if (!board) return
    const card = showing(board, token.kind, choice, t(wordsKey[token.kind]), e.name)
    if (card) interaction.showCard(card)
  }
  const pickToken = (item: InfoTokenItem) => {
    if (item.kind === 'custom') {
      setStep({ kind: 'note' })
      return
    }
    const token = showTokens.find((x) => x.kind === item.kind)
    if (!token) return
    if (token.about === 'seat' && board) {
      onClose()
      // A seat without a token has nothing to start from, so it takes no tap.
      interaction.requestSeats({
        allowed: board.seats.filter(s => believed(board, s.id) !== undefined).map(s => s.id),
        onDone: (seat) => {
          setResume({ kind: 'about', token, seat: seat as SeatId })
          onReopen()
        },
      })
    } else if (token.about === undefined) show(token, {})
    else setStep({ kind: 'about', token })
  }
  const pickAbout = (ids: readonly string[]) => {
    if (step.kind === 'about') show(step.token, { seat: step.seat, characters: ids })
  }
  const showNote = () => {
    if (!note.trim()) return
    onClose()
    interaction.showCard({ kind: 'custom', words: note.trim() })
  }

  const characterRows = (ids: readonly CharacterId[]): readonly PickerGroup[] =>
    pickerGroups(roster(board?.script ?? 'tb').filter((id) => ids.includes(id)), e.teamLabel, palette.teamOnPaper,
      (id) => ({ id, character: id, name: e.name(id) }))

  const back = () => setStep({ kind: 'tokens' })

  if (step.kind === 'note') return (
      <Sheet visible={visible} width={560} title={t('board.customNote')} onClose={onClose} closeLabel={t('common.close')}
        onBack={back} backLabel={t('common.back')}
        footer={<Button label={t('board.showNote')} onPress={showNote} disabled={!note.trim()} variant="primary" surface="paper" />}>
        <Field label={t('board.noteMessage')} value={note} onChange={setNote} multiline autoFocus />
      </Sheet>
  )
  if (step.kind === 'about' && board) {
    // Bluffs keep to the three a Demon is shown. Any other card takes as many characters as the
    // Storyteller picks.
    const bluffs = step.token.about === 'bluffs'
    const ids = bluffs ? bluffChoices(board) : characterGroups(board.script).flatMap((g) => g.ids)
    const start = bluffs ? savedBluffs : step.seat ? seatStart(board, step.token.kind, step.seat) : []
    return (
      <Picker
        visible={visible}
        title={bluffs ? t('board.showBluffs') : t('board.showAboutWhichCharacter')}
        onClose={onClose}
        closeLabel={t('common.close')}
        onBack={back}
        backLabel={t('common.back')}
        groups={characterRows(ids)}
        selected={start.filter((id) => ids.includes(id))}
        tokenGrid
        multi={{
          min: 1,
          max: bluffs ? bluffCount : ids.length,
          ...(bluffs ? { shuffleLabel: t('board.shuffleBluffs') } : {}),
          confirmLabel: (count: number) => t('board.showCharactersCount', { count }),
          onConfirm: pickAbout,
        }}
        emptyLabel={t('board.nothingMatches')}
      />
    )
  }
  return (
    <Sheet visible={visible} width={480} title={t('board.show')} onClose={onClose} closeLabel={t('common.close')} contentPaddingHorizontal={8}>
      <InfoTokenList items={items} onPick={pickToken} />
    </Sheet>
  )
}
