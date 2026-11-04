// Writing a homebrew character (docs/app.md, Scripts): its token as it will look on the board,
// which is also where its images are chosen, the schema's fields, its reminder tokens and when it
// wakes. A changed draft is kept on the device until it is saved or discarded, and leaving it in
// the app asks first. Saving hands the record back; the screen that opened the editor decides
// where it goes.
import { useId, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'

import type { Alignment, Homebrew, Team } from '../../content'
import { teamSide } from '../../content'
import { tokenArt } from '../../content/generated/art'
import { mintCharacterId, useStore } from '../../store'
import { pickFile } from '../../store/browser'
import { sheetTeams } from '../../store/scriptSheet'
import { usePhone } from '../../ui/breakpoint'
import { Button, focusStyle, isFocused } from '../../ui/Button'
import { CharacterIcon } from '../../ui/CharacterIcon'
import { Confirm } from '../../ui/Confirm'
import { Field } from '../../ui/Field'
import { useFocusVisible } from '../../ui/focus'
import { Icon } from '../../ui/icons'
import { PaperTexture } from '../../ui/PaperTexture'
import { Screen } from '../../ui/Screen'
import { Section } from '../../ui/Section'
import { PrintedName } from '../../ui/Token'
import { TokenDisc } from '../../ui/TokenDisc'
import { border, focusRing, hoverWash, motion, palette, radius, space, touch, type } from '../../ui/theme'
import type { CharacterDraft } from './character'
import { characterOf, characterProblem, draftOfCharacter, imageForTeam, imageOf, imagesOf, limits, nightSteps, shownImage, teamWords } from './character'
import { keepCharacter, useKept } from './drafts'
import { iconFromFile } from './image'
import { NightPlacement } from './NightPlacement'
import { ReminderTokens } from './ReminderTokens'

export interface CharacterEditorProps {
  readonly initial?: Homebrew // editing a saved one; a new character otherwise
  readonly resume?: CharacterDraft // the kept draft to go on with, changed from initial
  readonly onBack: () => void
  readonly onSave: (character: Homebrew) => Promise<unknown>
  readonly onDelete?: () => void
}

const previewSize = 148

export const CharacterEditor = ({ initial, resume, onBack, onSave, onDelete }: CharacterEditorProps) => {
  const store = useStore()
  const { t } = store
  const locale = store.settings.locale
  const pad = usePhone() ? space.lg : space.xl
  const start = useMemo(() => draftOfCharacter(initial), [initial])
  const [draft, setDraft] = useState<CharacterDraft>(resume ?? start)
  const [leaving, setLeaving] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [reading, setReading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [flippedShown, setFlippedShown] = useState(false) // the token previewed on the other side
  const set = (patch: Partial<CharacterDraft>) => setDraft((d) => ({ ...d, ...patch }))

  const markers = useMemo(() => ({ dusk: t('scripts.dusk'), minionInfo: t('scripts.minionInfo'), demonInfo: t('scripts.demonInfo'), dawn: t('scripts.dawn') }), [t])
  const first = useMemo(() => nightSteps('first', locale, markers), [locale, markers])
  const other = useMemo(() => nightSteps('other', locale, markers), [locale, markers])

  const problem = characterProblem(draft)
  const changed = JSON.stringify(draft) !== JSON.stringify(start)
  useKept(keepCharacter, useMemo(() => (changed ? { draft, ...(initial ? { initial } : {}) } : undefined), [changed, draft, initial]))
  const back = () => (changed ? setLeaving(true) : onBack())
  // Saved, the kept draft goes; failed, it stays, and so does the editor, saying so.
  const save = () => {
    if (problem || saving) return
    const taken = new Set(store.characters.map((c) => c.character.id))
    setSaving(true)
    setSaveFailed(false)
    onSave(characterOf(draft, initial?.id ?? mintCharacterId(draft.name, (id) => taken.has(id)), initial)).then(() => keepCharacter(undefined), () => {
      setSaving(false)
      setSaveFailed(true)
    })
  }

  const images = imagesOf(draft.image, draft.team)
  const own = teamSide(draft.team) // nothing for a Fabled or Loric, which never changes side
  const otherSide: Alignment | undefined = own === undefined ? undefined : own === 'good' ? 'evil' : 'good'
  // The other side has an image of its own only once the main one exists, as the schema lists it second.
  const flipped = flippedShown && otherSide !== undefined && images.main !== undefined ? otherSide : undefined

  // The image chosen is for the side the token shows.
  const chooseImage = async () => {
    setImageError(false)
    const file = await pickFile('image/*')
    if (!file) return
    setReading(true)
    try {
      const uri = await iconFromFile(file)
      setDraft((d) => {
        const now = imagesOf(d.image, d.team)
        return { ...d, image: imageOf(flipped ? { ...now, flipped: uri } : { main: uri, ...(now.flipped ? { flipped: now.flipped } : {}) }, d.team) }
      })
    } catch {
      setImageError(true)
    } finally {
      setReading(false)
    }
  }

  const image = shownImage(images.main)
  // The character's art at any size: its own image, or its team's icon until it has one. On the
  // other side, its image for that side, or the main one, as the board falls back.
  const art = (size: number, side?: Alignment) => {
    const uri = side ? shownImage(images.flipped ?? images.main) : image
    return uri
      ? <img src={uri} alt="" draggable={false} width={size} height={size} style={{ width: size, height: size, objectFit: 'contain' }} />
      : <CharacterIcon id="" team={draft.team} size={size} {...(side ? { tint: side } : {})} />
  }
  const reminders = draft.reminders.filter((r) => r.trim() !== '').length
  const instruction = (value: string, onChange: (text: string) => void) =>
    <Field label={t('scripts.nightInstruction')} value={value} maxLength={limits.instruction} multiline lines={2} onChange={onChange} />

  return (
    <Screen title={t(initial ? 'scripts.editCharacter' : 'scripts.newCharacter')} onBack={back} backLabel={t('common.back')}>
      <EditorStyles />
      <View style={[styles.paper, { padding: pad }]}>
        <PaperTexture radius={radius.tile} />
        <div className="editor-frame">
          <div className="editor-form">
            <View style={styles.identity}>
              <div className="editor-head">
                <div className="editor-preview">
                  <TokenPreview name={draft.name} art={art(previewSize * 0.64, flipped)} disabled={reading}
                    label={flipped ? t(flipped === 'good' ? 'scripts.chooseGoodImage' : 'scripts.chooseEvilImage') : t(image ? 'scripts.changeImage' : 'scripts.chooseImage')}
                    onPress={() => void chooseImage()}
                    markers={[
                      ...(draft.firstNight !== undefined ? ['firstnight'] : []),
                      ...(draft.otherNight !== undefined ? ['othernight'] : []),
                      ...(draft.setup ? ['setup'] : []),
                      ...(reminders > 0 ? [`count_${Math.min(7, reminders)}`] : []),
                    ]} />
                  {own !== undefined && otherSide !== undefined && images.main !== undefined ? (
                    <SideChoice label={t('scripts.imageSide')} sides={[own, otherSide]} value={flipped ?? own} words={{ good: t('board.good'), evil: t('board.evil') }}
                      art={(side) => art(sideIcon, side === own ? undefined : side)} onChange={(side) => setFlippedShown(side !== own)} />
                  ) : null}
                  {flipped === undefined && draft.image !== undefined
                    ? <Button label={t(images.flipped ? 'scripts.removeImages' : 'scripts.removeImage')} onPress={() => { setFlippedShown(false); set({ image: undefined }) }} variant="text" surface="paper" />
                    : null}
                  {flipped !== undefined && images.flipped !== undefined
                    ? <Button label={t('scripts.useSameImage')} onPress={() => set({ image: images.main })} variant="text" surface="paper" />
                    : null}
                  {flipped !== undefined && images.flipped === undefined
                    ? <Text style={[type.text.small, styles.centred, { color: palette.inkMuted }]}>{t('scripts.sameImageHint')}</Text>
                    : null}
                  {imageError ? <Text accessibilityRole="alert" style={[type.text.small, styles.centred, { color: palette.danger }]}>{t('scripts.imageUnreadable')}</Text> : null}
                </div>
                <View style={styles.identity}>
                  <Field label={t('scripts.characterName')} value={draft.name} maxLength={limits.name} onChange={(name) => set({ name })} />
                  <Field label={t('scripts.characterAbility')} value={draft.ability} maxLength={limits.ability} multiline lines={2} onChange={(ability) => set({ ability })} />
                </View>
              </div>
              <TeamChoice label={t('scripts.filterTeam')} value={draft.team} words={teamWords(t)}
                onChange={(team) => setDraft((d) => ({ ...d, team, image: imageForTeam(d.image, d.team, team) }))} />
              <label className="editor-toggle">
                <span style={toggleLabel}>{t('scripts.setupFlag')}</span>
                <input type="checkbox" role="switch" className="editor-switch" checked={draft.setup} onChange={(event) => set({ setup: event.target.checked })} />
              </label>
            </View>

            <Section label={t('scripts.characterReminders')}>
              <ReminderTokens reminders={draft.reminders} art={art} onChange={(list) => set({ reminders: list })}
                words={{
                  add: t('scripts.addReminder'),
                  text: (n) => t('scripts.reminderText', { n }),
                  remove: (name) => t('scripts.removeReminder', { name }),
                  placeholder: t('scripts.reminderPlaceholder'),
                }} />
            </Section>

            <Section label={t('scripts.firstNight')}>
              <NightPlacement label={t('scripts.firstNight')} night="first" steps={first} position={draft.firstNight}
                name={draft.name} team={draft.team} token={art(32)} onPosition={(firstNight) => set({ firstNight })}>
                {instruction(draft.firstNightReminder, (firstNightReminder) => set({ firstNightReminder }))}
              </NightPlacement>
            </Section>
            <Section label={t('scripts.otherNights')}>
              <NightPlacement label={t('scripts.otherNights')} night="other" steps={other} position={draft.otherNight}
                name={draft.name} team={draft.team} token={art(32)} onPosition={(otherNight) => set({ otherNight })}>
                {instruction(draft.otherNightReminder, (otherNightReminder) => set({ otherNightReminder }))}
              </NightPlacement>
            </Section>
            {onDelete ? <Button label={t('scripts.deleteCharacterConfirm')} icon="trash" onPress={onDelete} variant="dangerText" surface="paper" style={styles.delete} /> : null}
          </div>
        </div>

        {/* Save stays in reach however far down the night order the Storyteller has scrolled.
            Delete waits at the end of the form, out of the way of the action taken every time. */}
        <View style={[styles.bar, { marginHorizontal: -pad, marginBottom: -pad, paddingHorizontal: pad }]}>
          <View style={styles.barPaper}><PaperTexture /></View>
          {saveFailed ? <Text accessibilityRole="alert" style={[type.text.small, styles.failed, { color: palette.danger }]}>{t('scripts.characterSaveFailed')}</Text> : null}
          <Button label={t('scripts.saveCharacter')} onPress={save} variant="primary" surface="paper" disabled={problem !== undefined || saving}
            {...(problem ? { hintOnPress: t(`scripts.${problem}`) } : {})} />
        </View>
      </View>
      <Confirm
        visible={leaving}
        title={t('scripts.discardTitle')}
        message={t('scripts.discardCharacterMessage')}
        confirmLabel={t('scripts.discardConfirm')}
        cancelLabel={t('scripts.keepEditing')}
        danger
        onCancel={() => setLeaving(false)}
        onConfirm={() => { setLeaving(false); keepCharacter(undefined); onBack() }}
      />
    </Screen>
  )
}

// The token as the board will draw it, from the draft rather than a saved record. Tapping it
// chooses the image; the brass badge says so.
const TokenPreview = ({ name, art, markers, label, disabled, onPress }: {
  readonly name: string
  readonly art: ReactNode
  readonly markers: readonly string[]
  readonly label: string
  readonly disabled: boolean
  readonly onPress: () => void
}) => {
  const focusVisible = useFocusVisible()
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
      style={(state) => [{ borderRadius: previewSize / 2 }, focusStyle(palette, isFocused(state) && focusVisible, 'paper'), { opacity: state.pressed ? motion.pressedOpacity : 1 }]}>
      <TokenDisc size={previewSize}>
        {tokenArt.character_bg ? <img src={tokenArt.character_bg.uri} alt="" draggable={false} width={previewSize} height={previewSize} style={fillImage} /> : null}
        {markers.map((marker) => <Image key={marker} source={tokenArt[marker]} style={StyleSheet.absoluteFill} resizeMode="contain" accessible={false} />)}
        <View style={[styles.centre, { transform: [{ translateY: -previewSize * 0.035 }] }]}>{art}</View>
        {name.trim() ? <PrintedName name={name.trim()} size={previewSize} color={palette.ink} /> : null}
      </TokenDisc>
      <View style={[styles.badge, { backgroundColor: palette.accent }]}>
        <Icon name="edit" color={palette.onAccent} size={18} />
      </View>
    </Pressable>
  )
}

// The seven sheet teams as tiles, each with its team's icon over its printed colour. Native radios
// give one tab stop and arrow-key selection; each lies unseen over its whole tile, so a tap on the
// icon lands on the radio itself. A narrow panel sets them three, then two and two, and a wide one
// four over three, the teams that take a seat first; every row is full, so a team never wraps
// alone onto a line of its own.
const TeamChoice = ({ label, value, words, onChange }: {
  readonly label: string
  readonly value: Team
  readonly words: Readonly<Record<Team, string>>
  readonly onChange: (team: Team) => void
}) => {
  const name = useId()
  return (
    <View style={styles.teamGroup}>
      <Text style={[type.text.small, { color: palette.inkMuted }]}>{label}</Text>
      <div className="editor-teams" role="radiogroup" aria-label={label}>
        {sheetTeams.map((team) => (
          <label key={team} className="editor-team">
            <input type="radio" name={name} value={team} checked={team === value} aria-label={words[team]} onChange={() => onChange(team)} />
            <CharacterIcon id="" team={team} size={teamIcon} />
            <span className="editor-team-name" style={{ color: palette.teamOnPaper[team] }}>{words[team]}</span>
          </label>
        ))}
      </div>
    </View>
  )
}

const teamIcon = 32

// Which side the token preview shows, the team's own first, each tile with that side's art. The
// choice decides which image a tap on the token replaces. Native radios, as for the teams.
const SideChoice = ({ label, sides, value, words, art, onChange }: {
  readonly label: string
  readonly sides: readonly [Alignment, Alignment]
  readonly value: Alignment
  readonly words: Readonly<Record<Alignment, string>>
  readonly art: (side: Alignment) => ReactNode
  readonly onChange: (side: Alignment) => void
}) => {
  const name = useId()
  return (
    <div className="editor-sides" role="radiogroup" aria-label={label}>
      {sides.map((side) => (
        <label key={side} className="editor-side">
          <input type="radio" name={name} value={side} checked={side === value} aria-label={words[side]} onChange={() => onChange(side)} />
          {art(side)}
          <span className="editor-team-name" style={{ color: side === 'good' ? palette.goodOnPaper : palette.evilOnPaper }}>{words[side]}</span>
        </label>
      ))}
    </div>
  )
}

const sideIcon = 24

// Once the panel is 600 points wide the token stands beside the name and ability, about their
// height, and the teams run four over three; a narrower one centres the token above everything. A
// container query decides before paint, by the panel's width rather than the window's. Every
// element here is positioned like the views around it, or the paper texture paints over it.
const EditorStyles = () => <style href="grimoire-character-editor" precedence="default">{`
  .editor-frame { position: relative; container: character-editor / inline-size; }
  .editor-form { position: relative; display: flex; flex-direction: column; gap: ${space.xxl}px; min-width: 0; }
  .editor-head { position: relative; display: grid; grid-template-columns: minmax(0, 1fr); align-items: center; gap: ${space.lg}px; }
  .editor-preview { position: relative; display: flex; flex-direction: column; align-items: center; gap: ${space.xs}px; }
  .editor-teams { position: relative; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: ${space.sm}px; }
  .editor-team {
    position: relative; grid-column: span 2; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: ${space.xs}px; min-height: ${touch + space.xl}px; padding: ${space.sm}px ${space.xs}px; cursor: pointer;
    border: ${border}px solid ${palette.parchmentShade}; border-radius: ${radius.control}px;
    -webkit-tap-highlight-color: transparent;
    transition: border-color ${motion.duration.mark}ms ${motion.css.ease}, background-color ${motion.duration.mark}ms ${motion.css.ease};
  }
  .editor-team:nth-child(n+4) { grid-column: span 3; }
  .editor-sides { position: relative; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: ${space.xs}px; width: ${previewSize}px; }
  .editor-side {
    position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: ${space.xxs}px; min-height: ${touch}px; padding: ${space.xs}px; cursor: pointer;
    border: ${border}px solid ${palette.parchmentShade}; border-radius: ${radius.control}px;
    -webkit-tap-highlight-color: transparent;
    transition: border-color ${motion.duration.mark}ms ${motion.css.ease}, background-color ${motion.duration.mark}ms ${motion.css.ease};
  }
  .editor-team input, .editor-side input { position: absolute; inset: 0; z-index: 1; width: 100%; height: 100%; opacity: 0; margin: 0; cursor: pointer; }
  .editor-team:hover, .editor-side:hover { background-color: ${hoverWash.paper}; }
  .editor-team:active, .editor-side:active { opacity: ${motion.pressedOpacity}; }
  .editor-team:has(input:focus-visible), .editor-side:has(input:focus-visible) { outline: ${focusRing.width}px solid ${palette.ink}; outline-offset: ${focusRing.offset}px; }
  .editor-team:has(input:checked), .editor-side:has(input:checked) { border-color: ${palette.accent}; background-color: ${palette.paperPressed}; }
  .editor-team-name {
    max-width: 100%; text-align: center;
    font: ${type.text.small.fontSize}px/${type.text.small.lineHeight}px ${type.text.strong.fontFamily};
  }
  .editor-toggle {
    position: relative; display: flex; align-items: center; gap: ${space.md}px; min-height: ${touch + space.sm}px;
    padding: ${space.xs}px ${space.md}px; cursor: pointer; border-radius: ${radius.control}px;
    background-color: ${palette.paperInset}; border: 1px solid ${palette.parchmentShade};
  }
  .editor-switch {
    appearance: none; -webkit-appearance: none; position: relative; flex: none; width: 46px; height: 28px; margin: 0; cursor: pointer;
    border-radius: 14px; border: ${border}px solid ${palette.inkMuted}; background-color: transparent;
    transition: background-color ${motion.duration.mark}ms ${motion.css.ease}, border-color ${motion.duration.mark}ms ${motion.css.ease};
  }
  .editor-switch::before {
    content: ''; position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 10px; background-color: ${palette.inkMuted};
    transition: transform ${motion.duration.mark}ms ${motion.css.ease}, background-color ${motion.duration.mark}ms ${motion.css.ease};
  }
  .editor-switch:checked { background-color: ${palette.ink}; border-color: ${palette.ink}; }
  .editor-switch:checked::before { transform: translateX(18px); background-color: ${palette.parchment}; }
  .editor-switch:focus-visible { outline: ${focusRing.width}px solid ${palette.ink}; outline-offset: ${focusRing.offset}px; }
  /* After the narrow rules, which it overrides. */
  @container character-editor (min-width: 600px) {
    .editor-head { grid-template-columns: ${previewSize}px minmax(0, 1fr); gap: ${space.xl}px; }
    .editor-teams { grid-template-columns: repeat(12, minmax(0, 1fr)); }
    .editor-team, .editor-team:nth-child(n+4) { grid-column: span 3; }
    .editor-team:nth-child(n+5) { grid-column: span 4; }
  }
  @media (prefers-reduced-motion: reduce) {
    .editor-team, .editor-side, .editor-switch, .editor-switch::before { transition: none; }
  }
`}</style>

const fillImage: CSSProperties = { display: 'block', width: '100%', height: '100%', objectFit: 'cover' }
// A DOM span reads a bare line height as a multiple of the font size, so the measure gets its unit.
const toggleLabel: CSSProperties = {
  flex: 1, minWidth: 0, fontFamily: type.text.body.fontFamily, fontSize: type.text.body.fontSize, lineHeight: `${type.text.body.lineHeight}px`, color: palette.ink,
}

const styles = StyleSheet.create({
  paper: { gap: space.xl, borderWidth: 1, borderRadius: radius.tile, backgroundColor: palette.parchment, borderColor: palette.parchmentShade },
  identity: { gap: space.lg },
  teamGroup: { gap: space.xs },
  centred: { textAlign: 'center', maxWidth: previewSize + space.xl },
  centre: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  // Above the rim's printed name, which runs along the lower edge.
  badge: { position: 'absolute', right: space.xs, top: space.xs, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  // Its own vellum, so the fields scrolling beneath it cannot show through. The web draws sticky;
  // the types lack it.
  bar: {
    position: 'sticky', bottom: 0, zIndex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: space.sm,
    paddingVertical: space.md, borderTopWidth: 1, borderColor: palette.parchmentShade, backgroundColor: palette.parchment,
    borderBottomLeftRadius: radius.tile, borderBottomRightRadius: radius.tile,
  } as object,
  // Clipped on its own, so Save's floating reason can still rise above the bar.
  barPaper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', borderBottomLeftRadius: radius.tile, borderBottomRightRadius: radius.tile },
  failed: { width: '100%', textAlign: 'right' },
  delete: { alignSelf: 'flex-start' },
})
