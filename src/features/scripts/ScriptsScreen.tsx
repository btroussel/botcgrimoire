// The /scripts route (docs/app.md, Scripts): the three editions with their logos, the custom
// scripts and the Storyteller's own characters on this device on felt, create controls below
// each list, and the sheet in read or compose mode or the character editor taking the whole
// screen from here. A share link lands here too, its script in the fragment. Which script is
// open is this screen's own state; the scripts themselves live in the store, and an editor's
// unsaved work is kept beside them until it is saved or discarded.
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import type { CustomScript, Homebrew, Script } from '../../content'
import { editionAuthor, gameText, isCustom, scriptAuthor } from '../../content'
import type { SavedScript } from '../../store'
import { serializeScript, useStore } from '../../store'
import { isWeb, pickTextFile } from '../../store/browser'
import { linkKey } from '../../store/scriptLink'
import { artIds } from '../../store/scriptSheet'
import { backOrHome } from '../../ui/homePath'
import { Button, IconButton } from '../../ui/Button'
import { Confirm } from '../../ui/Confirm'
import { Enter } from '../../ui/Enter'
import { PaperTexture } from '../../ui/PaperTexture'
import { preloadArt } from '../../ui/preloadArt'
import { Screen } from '../../ui/Screen'
import { ScriptListRow, scriptDetails } from '../../ui/ScriptListRow'
import { Token } from '../../ui/Token'
import { palette, radius, space, type } from '../../ui/theme'
import type { CharacterDraft } from './character'
import { CharacterEditor } from './CharacterEditor'
import type { Draft } from './compose'
import { copyOf, draftOf, editionDraft, emptyDraft, importLink, importText } from './compose'
import type { KeptCharacter } from './drafts'
import { keepCharacter, readKept } from './drafts'
import { ImportScript } from './ImportScript'
import { ScriptComposer } from './ScriptComposer'
import { ScriptReader } from './ScriptReader'
import { useScripts } from './useScripts'

type Reading = { readonly kind: 'read'; readonly script: Script; readonly saved?: SavedScript }

type Open =
  | { readonly kind: 'list' }
  | Reading
  | { readonly kind: 'received'; readonly script: CustomScript } // from a share link or a file, until it is kept or left
  // from: the reader it was opened in. resume: the kept draft, with a character being written in it.
  | { readonly kind: 'compose'; readonly draft: Draft; readonly from?: Reading; readonly resume?: Draft; readonly character?: KeptCharacter }
  | { readonly kind: 'character'; readonly character?: Homebrew; readonly resume?: CharacterDraft } // a saved one to edit, or a new one

// A share link's fragment goes once its script is kept or left, so a reload or Back does not
// offer it again. The history entry keeps the router's state.
const forgetLink = () => {
  if (isWeb && window.location.hash.startsWith(linkKey)) {
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
  }
}

// The work an editor left unsaved, reopened as it was, or the list when there is none. Back
// from a reopened draft goes to the list, wherever the editor was first opened from.
const reopened = async (): Promise<Open> => {
  const { script, character } = await readKept()
  if (script) return { kind: 'compose', draft: script.initial, resume: script.draft, ...(character ? { character } : {}) }
  if (character) return { kind: 'character', ...(character.initial ? { character: character.initial } : {}), resume: character.draft }
  return { kind: 'list' }
}

export const ScriptsScreen = () => {
  const router = useRouter()
  const scripts = useScripts()
  const { ready } = useStore()
  const { t } = scripts
  const p = palette
  const [open, setOpen] = useState<Open>({ kind: 'list' })
  const { editions, custom, locale } = scripts
  const art = useMemo(() => (open.kind === 'read' || open.kind === 'received' ? [open.script] : open.kind === 'list' ? [
    ...editions.map(e => e.id), ...custom.map(c => c.saved.script),
  ] : []).flatMap(s => artIds(s, locale)), [open, editions, custom, locale])
  useEffect(() => preloadArt(art), [art])
  const [deleting, setDeleting] = useState<SavedScript | undefined>(undefined)
  const [deletingCharacter, setDeletingCharacter] = useState<Homebrew | undefined>(undefined)
  const [importing, setImporting] = useState(false)
  // New game sends here for a script it does not list, and the import window opens on arrival.
  // The flag leaves the address at once, so a reload or Back does not open the window again.
  const { import: asked } = useLocalSearchParams<{ import?: string }>()
  const [toImport] = useState(asked === '1')
  const [importOpen, setImportOpen] = useState(toImport)
  useEffect(() => { if (asked) router.setParams({ import: undefined }) }, [asked, router])
  const [keeping, setKeeping] = useState(false)
  const [keepFailed, setKeepFailed] = useState(false)
  const [importErrors, setImportErrors] = useState<readonly string[]>([])

  const back = () => backOrHome(router, locale)
  // Any move off the list drops an old import error, so returning never shows a stale one.
  const show = (next: Open) => { setImportErrors([]); setKeepFailed(false); setOpen(next) }
  const list = () => show({ kind: 'list' })
  const readSaved = (saved: SavedScript) => show({ kind: 'read', script: saved.script, saved })
  const edit = (saved: SavedScript, fromReader = false) =>
    show({ kind: 'compose', draft: draftOf(saved), ...(fromReader ? { from: { kind: 'read', script: saved.script, saved } } : {}) })
  // A new game on the script being read: an edition by its id, a saved script by its own.
  const play = (id: string) => router.push({ pathname: '/new', params: { script: id } })
  // A copy of an edition or a saved script, to compose from. Back returns to the reader it came from.
  const copyFrom = (from: Reading): (() => void) | undefined => {
    const named = (name: string) => t('scripts.copyName', { name })
    const source = from.saved ? draftOf(from.saved) : isCustom(from.script) ? undefined : editionDraft(from.script, gameText(locale).edition(from.script).name, locale)
    return source ? () => show({ kind: 'compose', draft: copyOf(source, named), from }) : undefined
  }

  const invalid = (errors: readonly string[]) => [t('scripts.invalidScript'), ...errors.map(error => error === 'not JSON' ? t('scripts.notJson') : error)]

  // The script a share link carries, or what to say instead, the headline first.
  const readLink = async (link: string): Promise<{ readonly script: CustomScript } | { readonly errors: readonly string[] }> => {
    const read = await importLink(link)
    if (read === 'none') return { errors: [t('scripts.linkEmpty')] }
    if (read === 'broken') return { errors: [t('scripts.linkBroken')] }
    return 'errors' in read ? { errors: invalid(read.errors) } : read
  }

  // A share link opens its script in the reader, on arrival or when only the fragment changes.
  // It waits for the store, so its words are in the saved language and a script already saved
  // reads as that one from the start. Arriving without one reopens any unsaved draft; a link
  // opened over a draft sets it aside until the link is left, and so does arriving to import.
  useEffect(() => {
    if (!isWeb || !ready) return
    let live = true
    const arrive = () => {
      if (!window.location.hash.startsWith(linkKey)) return false
      void readLink(window.location.hash).then((read) => {
        if (!live) return
        if ('errors' in read) {
          forgetLink()
          setOpen({ kind: 'list' })
          setImportErrors(read.errors)
        } else {
          setImportErrors([])
          setKeepFailed(false)
          setOpen({ kind: 'received', script: read.script })
        }
      })
      return true
    }
    if (!arrive() && !toImport) {
      void reopened().then((next) => {
        if (live) setOpen((current) => (current.kind === 'list' ? next : current))
      })
    }
    window.addEventListener('hashchange', arrive)
    return () => {
      live = false
      window.removeEventListener('hashchange', arrive)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- words are settled once the store is ready
  }, [ready])

  // A picked file opens unsaved in the reader, as a link does, so importing it twice keeps one copy.
  const importScript = async () => {
    setImportErrors([])
    setImporting(true)
    let text: string | undefined
    try {
      text = await pickTextFile()
    } catch {
      setImportErrors([t('scripts.fileUnreadable')])
      return
    } finally {
      setImporting(false)
    }
    if (text === undefined) return
    const read = importText(text)
    if ('errors' in read) setImportErrors(invalid(read.errors))
    else show({ kind: 'received', script: read.script })
  }

  if (open.kind === 'received') {
    // The same script already on this device reads as that one, so a link or file opened twice
    // or a double tap on Save keeps one copy.
    const shared = open.script
    const same = scripts.custom.find((c) => serializeScript(c.saved.script) === serializeScript(shared))?.saved
    const leave = () => {
      forgetLink()
      void reopened().then(show)
    }
    const keep = () => {
      setKeeping(true)
      setKeepFailed(false)
      scripts.keep(shared).then(forgetLink, () => setKeepFailed(true)).finally(() => setKeeping(false))
    }
    return (
      <Enter key="received">
        <ScriptReader
          script={same?.script ?? shared}
          onBack={leave}
          {...(same
            ? {
                onPlay: () => { forgetLink(); play(same.id) },
                onExport: () => scripts.exportFile(same),
                onEdit: () => { forgetLink(); edit(same, true) },
                onCopy: () => { forgetLink(); copyFrom({ kind: 'read', script: same.script, saved: same })?.() },
              }
            : keeping ? {} : { onSave: keep, saveFailed: keepFailed })}
        />
      </Enter>
    )
  }

  if (open.kind === 'read') {
    const saved = open.saved
    const copy = copyFrom(open)
    return (
      <Enter key={`read-${saved?.id ?? String(open.script)}`}>
        <ScriptReader
          script={open.script}
          onBack={list}
          onPlay={() => play(saved?.id ?? String(open.script))}
          {...(saved ? { onExport: () => scripts.exportFile(saved), onEdit: () => edit(saved, true) } : {})}
          {...(copy ? { onCopy: copy } : {})}
        />
      </Enter>
    )
  }

  // Deleting leaves the scripts and games that carry the character their own copy.
  const confirmCharacterDelete = (
    <Confirm
      visible={deletingCharacter !== undefined}
      title={t('scripts.deleteCharacterTitle')}
      message={t('scripts.deleteCharacterMessage', { name: deletingCharacter?.name ?? '' })}
      confirmLabel={t('scripts.deleteCharacterConfirm')}
      cancelLabel={t('common.cancel')}
      danger
      onCancel={() => setDeletingCharacter(undefined)}
      onConfirm={() => {
        if (deletingCharacter) void scripts.removeCharacter(deletingCharacter.id)
        // Deleted from its own editor, the character takes that editor's unsaved work with it.
        if (open.kind === 'character') keepCharacter(undefined)
        setDeletingCharacter(undefined)
        list()
      }}
    />
  )

  if (open.kind === 'character') {
    const editing = open.character
    return (
      <Enter key={`character-${editing?.id ?? 'new'}`}>
        <CharacterEditor
          {...(editing ? { initial: editing, onDelete: () => setDeletingCharacter(editing) } : {})}
          {...(open.resume ? { resume: open.resume } : {})}
          onBack={list}
          onSave={(character) => scripts.saveCharacter(character).then(list)}
        />
        {confirmCharacterDelete}
      </Enter>
    )
  }

  if (open.kind === 'compose') {
    const from = open.from
    return (
      <Enter key="compose">
        <ScriptComposer
          initial={open.draft}
          {...(open.resume ? { resume: open.resume } : {})}
          {...(open.character ? { resumeCharacter: open.character } : {})}
          onBack={from ? () => show(from) : list}
          onSave={(draft) => scripts.save(draft).then(readSaved)}
        />
      </Enter>
    )
  }

  return (
    <Enter key="list">
      <Screen title={t('scripts.title')} onBack={back} backLabel={t('common.back')}>
        <Text accessibilityRole="header" aria-level={2} style={[type.text.strong, styles.label, { color: p.muted }]}>{t('scripts.editions')}</Text>
        <View style={styles.list}>
          {scripts.editions.map((e) => (
            <ScriptListRow
              key={e.id}
              {...(e.logo === undefined ? {} : { logo: e.logo })}
              name={e.name}
              {...scriptDetails(editionAuthor, t('scripts.charactersCount', { count: e.count }))}
              accessibilityLabel={t('scripts.open', { name: e.name })}
              onPress={() => show({ kind: 'read', script: e.id })}
            />
          ))}
        </View>

        <Text accessibilityRole="header" aria-level={2} style={[type.text.strong, styles.label, { color: p.muted }]}>{t('scripts.yourScripts')}</Text>
        {scripts.custom.length > 0 ? (
          <View style={styles.list}>
            {scripts.custom.map((c) => (
              <ScriptListRow
                key={c.saved.id}
                {...(c.logo === undefined ? {} : { logo: c.logo })}
                name={c.name}
                {...scriptDetails(scriptAuthor(c.saved.script), `${t('scripts.charactersCount', { count: c.count })} · ${c.edited}`)}
                accessibilityLabel={t('scripts.open', { name: c.name })}
                onPress={() => readSaved(c.saved)}
                onLongPress={() => edit(c.saved)}
                right={
                  <IconButton icon="trash" label={t('scripts.deleteScript', { name: c.name })} onPress={() => setDeleting(c.saved)} surface="paper" />
                }
              />
            ))}
          </View>
        ) : null}

        <View style={styles.create}>
          <Button style={styles.createAction} label={t('scripts.compose')} icon="add" variant="primary" onPress={() => show({ kind: 'compose', draft: emptyDraft })} />
          <Button style={styles.createAction} label={t('scripts.import')} icon="script" onPress={() => { setImportErrors([]); setImportOpen(true) }} disabled={importing} />
        </View>
        {importErrors.length > 0 ? (
          <View accessibilityRole="alert" style={[styles.errors, { backgroundColor: p.parchment }]}>
            <PaperTexture radius={radius.tile} />
            {importErrors.map((error, index) => <Text key={index} style={[index === 0 ? type.text.strong : type.text.small, { color: index === 0 ? p.danger : p.ink }]}>{error}</Text>)}
          </View>
        ) : null}
        <Text accessibilityRole="header" aria-level={2} style={[type.text.strong, styles.label, { color: p.muted }]}>{t('scripts.yourCharacters')}</Text>
        {scripts.characters.length > 0 ? (
          <View style={styles.list}>
            {scripts.characters.map((c) => (
              <ScriptListRow
                key={c.saved.character.id}
                leading={<Token size={64} character={c.saved.character.id} />}
                name={c.name}
                detail={c.team}
                {...(c.scripts > 0 ? { detail2: t('scripts.onScripts', { count: c.scripts }) } : {})}
                accessibilityLabel={t('scripts.editCharacterNamed', { name: c.name })}
                onPress={() => show({ kind: 'character', character: c.saved.character })}
                right={
                  <IconButton icon="trash" label={t('scripts.deleteCharacter', { name: c.name })} onPress={() => setDeletingCharacter(c.saved.character)} surface="paper" />
                }
              />
            ))}
          </View>
        ) : null}
        <View style={styles.create}>
          <Button style={styles.createAction} label={t('scripts.createCharacter')} icon="character" onPress={() => show({ kind: 'character' })} />
        </View>
        <Confirm
          visible={deleting !== undefined}
          title={t('scripts.deleteTitle')}
          message={t('scripts.deleteMessage', { name: deleting?.script.name ?? '' })}
          confirmLabel={t('scripts.deleteConfirm')}
          cancelLabel={t('common.cancel')}
          danger
          onCancel={() => setDeleting(undefined)}
          onConfirm={() => {
            if (deleting) void scripts.remove(deleting.id)
            setDeleting(undefined)
          }}
        />
        {confirmCharacterDelete}
        <ImportScript
          // Never on the first render of a direct load, which has to match the exported page.
          visible={importOpen && ready}
          onClose={() => setImportOpen(false)}
          onFile={() => {
            setImportOpen(false)
            void importScript()
          }}
          onLink={async (link) => {
            const read = await readLink(link)
            if ('errors' in read) return read.errors
            setImportOpen(false)
            show({ kind: 'received', script: read.script })
            return undefined
          }}
        />
      </Screen>
    </Enter>
  )
}

const styles = StyleSheet.create({
  create: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  createAction: { flexGrow: 1, flexBasis: 240 },
  errors: { gap: space.xs, padding: space.lg, borderRadius: radius.tile },
  label: { marginTop: space.md },
  list: { gap: space.md },
})
