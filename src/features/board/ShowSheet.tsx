// Manual cards ask only for content they display. Opening one never writes to the game log.
import { useState } from 'react'

import type { CharacterId } from '../../content'
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
import type { ShowKind, ShowToken } from './show'
import { showTokens, showing } from './show'
import { useEdits } from './useEdits'

export interface ShowSheetProps {
  readonly visible: boolean
  readonly onClose: () => void
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

type Step = { readonly kind: 'tokens' } | { readonly kind: 'note' } | { readonly kind: 'about'; readonly token: ShowToken }

export const ShowSheet = ({ visible, onClose }: ShowSheetProps) => {
  const e = useEdits()
  const interaction = useBoardInteraction()
  const t = e.t
  const board = e.board
  const [step, setStep] = useState<Step>({ kind: 'tokens' })
  const [note, setNote] = useState('')
  // The flow starts over each time the sheet opens; the edge is read during render.
  const [wasVisible, setWasVisible] = useState(visible)
  if (visible !== wasVisible) {
    setWasVisible(visible)
    if (visible) {
      setStep({ kind: 'tokens' })
      setNote('')
    }
  }

  const savedBluffs = board ? bluffsOf(board, e.log) : []
  const items: readonly InfoTokenItem[] = [...showTokens.map((x) => ({
    kind: x.kind,
    label: t(wordsKey[x.kind]),
    ...(x.kind === 'notInPlay' ? { characters: savedBluffs } : {}),
  })), { kind: 'custom', label: t('board.customNote') }]

  const show = (token: ShowToken, about: readonly string[]) => {
    onClose()
    if (!board) return
    const card = showing(board, token.kind, about, t(wordsKey[token.kind]), e.name)
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
      interaction.requestSeats({
        allowed: board.seats.map(s => s.id),
        onDone: (seat) => show(token, [seat]),
      })
    } else if (token.about === undefined) show(token, [])
    else setStep({ kind: 'about', token })
  }
  const pickAbout = (ids: readonly string[]) => {
    if (step.kind === 'about') show(step.token, ids)
  }
  const showNote = () => {
    if (!note.trim()) return
    onClose()
    interaction.showCard({ kind: 'custom', words: note.trim() })
  }

  const characterRows = (ids: readonly CharacterId[]): readonly PickerGroup[] =>
    pickerGroups(roster(board?.script ?? 'tb').filter((id) => ids.includes(id)), e.teamLabel, palette.teamOnPaper,
      (id) => ({ id, character: id, name: e.name(id) }))

  const about = step.kind === 'about' ? step.token.about : undefined
  const characterStep = about === 'character' || about === 'characters'
  const bluffIds = board ? bluffChoices(board) : []
  const bluffs = about === 'characters' ? savedBluffs.filter(id => bluffIds.includes(id)) : []
  const allCharacters = board ? characterGroups(board.script).flatMap((g) => g.ids) : []
  const back = () => setStep({ kind: 'tokens' })

  if (step.kind === 'note') return (
      <Sheet visible={visible} width={560} title={t('board.customNote')} onClose={onClose} closeLabel={t('common.close')}
        onBack={back} backLabel={t('common.back')}
        footer={<Button label={t('board.showNote')} onPress={showNote} disabled={!note.trim()} variant="primary" surface="paper" />}>
        <Field label={t('board.noteMessage')} value={note} onChange={setNote} multiline autoFocus />
      </Sheet>
  )
  if (characterStep) return (
      <Picker
        visible={visible}
        title={about === 'characters' ? t('board.showBluffs') : t('board.showAboutWhichCharacter')}
        onClose={onClose}
        closeLabel={t('common.close')}
        onBack={back}
        backLabel={t('common.back')}
        groups={characterRows(about === 'characters' ? bluffIds : allCharacters)}
        selected={bluffs}
        tokenGrid
        {...(about === 'characters'
          ? { multi: { min: 1, max: bluffCount, shuffleLabel: t('board.shuffleBluffs'), confirmLabel: (count: number) => t('board.showCharactersCount', { count }), onConfirm: pickAbout } }
          : { onPick: (id: string) => pickAbout([id]) })}
        emptyLabel={t('board.nothingMatches')}
      />
  )
  return (
    <Sheet visible={visible} width={480} title={t('board.show')} onClose={onClose} closeLabel={t('common.close')} contentPaddingHorizontal={8}>
      <InfoTokenList items={items} onPick={pickToken} />
    </Sheet>
  )
}
