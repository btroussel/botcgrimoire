// The sheet is the draft: selected characters and their jinxes. The catalogue stays separate
// so adding several characters never hides the script among the whole roster. A changed draft
// is kept on the device until it is saved or discarded, and leaving it in the app asks first.
// A homebrew character written from the catalogue is saved to the Storyteller's list and joins
// the draft.
import { useCallback, useMemo, useState } from 'react'
import { Modal, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import type { CharacterId, Homebrew, Team } from '../../content'
import { editionArt } from '../../content/generated/art'
import { useStore } from '../../store'
import { isTeensyville, composeTarget, jinxesAmong, sheetGroups, teamCounts, unknownNotice } from '../../store/scriptSheet'
import { usePhone } from '../../ui/breakpoint'
import { Button, IconButton } from '../../ui/Button'
import { Confirm } from '../../ui/Confirm'
import { PaperTexture } from '../../ui/PaperTexture'
import { ScriptSheet } from '../../ui/ScriptSheet'
import { PageVelvet } from '../../ui/Velvet'
import { useViewport } from '../../ui/Viewport'
import { gutter, layout, palette, radius, shadows, space, touch, type } from '../../ui/theme'
import { CharacterEditor } from './CharacterEditor'
import { ScriptCharacterPicker } from './ScriptCharacterPicker'
import type { Draft } from './compose'
import { composeRoster, draftIds, draftNeedsBootlegger, draftProblem, fileOf, maxRules, recordsOf, toggleId } from './compose'
import type { KeptCharacter } from './drafts'
import { keepScript, useKept } from './drafts'
import { useSheetWords } from './useScripts'

export interface ScriptComposerProps {
  readonly initial: Draft
  readonly resume?: Draft // the kept draft to go on with, changed from initial
  readonly resumeCharacter?: KeptCharacter // a character being written from the catalogue
  readonly onBack: () => void
  readonly onSave: (draft: Draft) => Promise<unknown>
}

export const ScriptComposer = ({ initial, resume, resumeCharacter, onBack, onSave }: ScriptComposerProps) => {
  const { t, settings, characters, saveCharacter } = useStore()
  const locale = settings.locale
  const p = palette
  const insets = useSafeAreaInsets()
  const viewport = useViewport()
  const { width } = viewport
  const wide = width >= 800
  const pad = usePhone() ? gutter.phone : gutter.tablet
  const words = useSheetWords()
  const defaultName = t('scripts.defaultName')
  const [draft, setDraft] = useState<Draft>(() => resume ?? { ...initial, name: initial.name.trim() || defaultName })
  const [picking, setPicking] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [team, setTeam] = useState<Team | 'all'>('all')
  const openPicker = useCallback((team: Team | 'all') => { setTeam(team); setPicking(true) }, [])
  const closePicker = useCallback(() => setPicking(false), [])
  const [creating, setCreating] = useState(resumeCharacter !== undefined)
  const [resumed, setResumed] = useState(resumeCharacter)
  const openCreator = useCallback(() => setCreating(true), [])
  const closeCreator = () => { setCreating(false); setResumed(undefined) }
  const create = (character: Homebrew) => saveCharacter(character).then(() => {
    const id = character.id as CharacterId
    setDraft((d) => (d.ids.includes(id) ? d : { ...d, ids: [...d.ids, id] }))
    closeCreator()
  })
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)

  const own = useMemo(() => characters.map((c) => c.character), [characters])
  const carried = draft.homebrew
  const records = useMemo(() => recordsOf(carried, own), [carried, own])
  const roster = useMemo(() => composeRoster(locale, records), [locale, records])
  // Homebrew characters or rules bring the Bootlegger, which stays while they do.
  const shown = useMemo(() => draftIds(draft, records), [draft, records])
  const bootlegged = draftNeedsBootlegger(draft, records)
  const chosen = useMemo(() => roster.filter((c) => shown.includes(c.id)), [roster, shown])
  const counts = useMemo(() => teamCounts(chosen), [chosen])
  const target = composeTarget(counts)
  const teams = useMemo(
    () =>
      sheetGroups(chosen, words.teams, {
        of: (team: Team) => (target[team] > 0 ? { have: counts[team] ?? 0, of: target[team] } : undefined),
        label: (count) => t('scripts.ofTarget', { have: count.have, of: count.of }),
      }).map(group => ({
        ...group,
        rows: bootlegged ? group.rows.map(row => (row.id === 'bootlegger' ? { ...row, implied: true } : row)) : group.rows,
        add: { label: t(`scripts.add_${group.team}`), onPress: () => openPicker(group.team) },
      })),
    [chosen, words, target, counts, t, openPicker, bootlegged],
  )
  const jinxes = useMemo(() => jinxesAmong(chosen, locale), [chosen, locale])
  const unknown = useMemo(() => unknownNotice(fileOf(draft, own), t), [draft, own, t])

  const namedDraft = { ...draft, name: draft.name.trim() || defaultName }
  const problem = draftProblem(namedDraft)
  const changed = namedDraft.name !== (initial.name.trim() || defaultName)
    || draft.author.trim() !== initial.author.trim()
    || draft.ids.length !== initial.ids.length
    || draft.ids.some((id) => !initial.ids.includes(id))
    || (draft.rules ?? []).join('\n') !== (initial.rules ?? []).join('\n')
  useKept(keepScript, useMemo(() => (changed ? { draft, initial } : undefined), [changed, draft, initial]))
  const back = () => (changed ? setLeaving(true) : onBack())
  // Saved, the kept draft goes; failed, it stays, and so does the screen, saying so.
  const save = () => {
    if (saving) return
    setSaving(true)
    setSaveFailed(false)
    onSave(namedDraft).then(() => keepScript(undefined), () => {
      setSaving(false)
      setSaveFailed(true)
    })
  }
  const toggle = useCallback((id: string) => setDraft((d) => ({ ...d, ids: toggleId(d.ids, id as CharacterId) })), [])
  const remove = useCallback((id: string) => setDraft(d => ({ ...d, ids: d.ids.filter(chosen => chosen !== id) })), [])

  return (
    <View style={[styles.root, { maxHeight: viewport.height || undefined, top: viewport.top, padding: pad, paddingTop: insets.top + pad }]}>
      <PageVelvet />
      <View style={styles.sheet}>
        <ScriptSheet teensyville={isTeensyville(counts)}
          mode="compose"
          {...(draft.logo ? { logo: { uri: draft.logo } } : editionArt.custom !== undefined ? { logo: editionArt.custom } : {})}
          bottomInset={touch + space.lg * 2 + insets.bottom}
          nameField={{
            value: draft.name,
            placeholder: defaultName,
            label: t('scripts.nameLabel'),
            onChange: (name) => setDraft((d) => ({ ...d, name })),
            onBlur: () => setDraft((d) => ({ ...d, name: d.name.trim() || defaultName })),
          }}
          authorField={{ value: draft.author, placeholder: t('scripts.authorPlaceholder'), label: t('scripts.authorPlaceholder'), onChange: (author) => setDraft((d) => ({ ...d, author })) }}
          teams={teams}
          jinxes={jinxes}
          rulesField={{
            values: draft.rules ?? [],
            onChange: (rules) => setDraft((d) => ({ ...d, rules })),
            ...((draft.rules?.length ?? 0) < maxRules ? { add: t('scripts.addRule') } : {}),
            text: (n) => t('scripts.ruleText', { n }),
            remove: (n) => t('scripts.removeRule', { n }),
          }}
          {...(unknown ? { notice: unknown } : {})}
          selected={shown}
          labels={words.labels}
          onRemoveCharacter={remove}
          removeLabel={name => t('scripts.removeCharacter', { name })}
          onBack={back}
          backLabel={t('common.back')}
        />
        <View id="script-sheet-footer" pointerEvents="box-none" style={[styles.footer, { bottom: space.lg + insets.bottom }]}>
          {saveFailed ? (
            <View style={[styles.failed, { backgroundColor: p.ink }]}>
              <Text accessibilityRole="alert" style={[type.text.small, { color: p.parchment }]}>{t('scripts.saveFailed')}</Text>
            </View>
          ) : null}
          <View style={{ backgroundColor: p.parchment, borderRadius: radius.control }}>
            <PaperTexture radius={radius.control} />
            <Button
              label={t('scripts.saveScript')}
              onPress={save}
              variant="primary"
              surface="paper"
              disabled={problem !== undefined || saving}
              {...(problem ? { hintOnPress: t(`scripts.${problem}`) } : {})}
            />
            {wide && picking ? null : (
              <View style={[styles.add, { backgroundColor: p.parchment, borderColor: p.parchmentShade }]}>
                <PaperTexture radius={radius.control} />
                <IconButton icon="add" label={t('scripts.addCharacters')} onPress={() => openPicker('all')} surface="paper" />
              </View>
            )}
          </View>
        </View>
      </View>
      <View style={wide && picking ? [styles.picker, { borderLeftColor: p.parchmentShade }] : styles.closedPicker}>
        <ScriptCharacterPicker visible={picking} wide={wide} roster={roster} selected={shown} team={team} onTeamChange={setTeam} onToggle={toggle} onClose={closePicker} onCreate={openCreator} />
      </View>
      {/* Escape does not close it: the editor's own back asks before a written character is lost.
          Web modals stack in the order they mount, so the editor mounts only when it opens, above
          the phone catalogue. */}
      {creating ? (
        <Modal visible animationType="fade" onRequestClose={() => {}}>
          <CharacterEditor
            {...(resumed ? { resume: resumed.draft, ...(resumed.initial ? { initial: resumed.initial } : {}) } : {})}
            onBack={closeCreator}
            onSave={create}
          />
        </Modal>
      ) : null}
      <Confirm
        visible={leaving}
        title={t('scripts.discardTitle')}
        message={t('scripts.discardMessage')}
        confirmLabel={t('scripts.discardConfirm')}
        cancelLabel={t('scripts.keepEditing')}
        danger
        onCancel={() => setLeaving(false)}
        onConfirm={() => { setLeaving(false); keepScript(undefined); onBack() }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  // The draft keeps the reader's paper cap, centred with the catalogue beside it when open.
  root: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  sheet: { flex: 1, minWidth: 0, maxWidth: layout.contentMax, borderRadius: radius.tile, overflow: 'hidden' },
  picker: { width: 360, borderLeftWidth: 1, borderRadius: radius.tile, overflow: 'hidden', marginLeft: space.md },
  closedPicker: { width: 0 },
  footer: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  failed: { maxWidth: 280, padding: space.sm, marginBottom: space.sm, borderRadius: radius.control },
  add: { position: 'absolute', left: '100%', top: 0, marginLeft: space.sm, borderWidth: 1, borderRadius: radius.control, boxShadow: shadows.ticket },
})
