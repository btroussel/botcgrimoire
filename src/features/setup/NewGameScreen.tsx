import { useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, Text } from 'react-native'
import type { CharacterId, Script, ScriptId } from '../../content'
import { editionAuthor, editions, gameText, scriptAuthor } from '../../content'
import { editionArt } from '../../content/generated/art'
import type { SavedGame } from '../../store'
import { boardOf, useStore } from '../../store'
import { artIds, listed } from '../../store/scriptSheet'
import { Enter } from '../../ui/Enter'
import { backOrHome } from '../../ui/homePath'
import { preloadArt } from '../../ui/preloadArt'
import { Screen } from '../../ui/Screen'
import { ScriptListRow } from '../../ui/ScriptListRow'
import { palette, space, type } from '../../ui/theme'
import { SetupScriptSheet } from './SetupScriptSheet'
import { chosenTokens, fillBag } from './draw'
import { looseEvents, openingEvents, scriptLoose, trimBag } from './setup'

export const NewGameScreen = () => {
  const store = useStore()
  const { t } = store
  const router = useRouter()
  const [script, setScript] = useState<Script>()
  const locale = store.settings.locale
  const savedScripts = store.scripts
  const games = store.games
  const art = useMemo(() => (script ? [script] : [
    ...editions.map(e => e.id as ScriptId), ...savedScripts.map(s => s.script),
  ]).flatMap(s => artIds(s, locale)), [script, savedScripts, locale])
  useEffect(() => preloadArt(art), [art])
  // A group usually meets at the same size, so the last table is the best guess for this one.
  const lastTable = useMemo(() => {
    const latest = games.reduce<SavedGame | undefined>((a, g) => !a || g.createdAt > a.createdAt ? g : a, undefined)
    const seats = latest ? boardOf({ game: latest, redo: [] }).seats.length : 0
    return seats >= 1 && seats <= 20 ? seats : 7
  }, [games])
  const [chosenCount, setCount] = useState<number>()
  const count = chosenCount ?? lastTable
  const [bag, setBag] = useState<readonly CharacterId[]>([])
  const [shows, setShows] = useState<ReadonlyMap<CharacterId, CharacterId>>(new Map())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const opening = useRef(false)
  const text = gameText(store.settings.locale)
  const back = () => { if (script) { setScript(undefined); setBag([]); setShows(new Map()); setError(false) } else backOrHome(router, locale) }
  const show = (character: CharacterId, shown: CharacterId | undefined) => setShows(current => {
    const next = new Map(current)
    if (shown) next.set(character, shown)
    else next.delete(character)
    return next
  })
  // A script's Fabled and Loric are its rules, so they start selected for the board.
  const choose = (next: Script) => { setScript(next); setBag(scriptLoose(listed(next, locale))) }
  const open = async () => {
    if (!script || opening.current) return
    opening.current = true
    setBusy(true); setError(false)
    try {
      const seats = openingEvents(Array.from({ length: count }, (_, i) => t('setup.defaultSeat', { n: i + 1 })))
      const id = await store.create(script)
      store.appendAll([...seats, ...looseEvents(bag)])
      // The tokens wait in the bag, so the board opens empty on the setup window that deals them.
      const draw = fillBag(bag, listed(script, locale), Math.random, [], chosenTokens(shows))
      if (draw) store.setDraw(draw)
      router.replace({ pathname: '/game/[id]', params: { id, ...(draw ? { setup: '1' } : {}) } })
    } catch { setError(true) } finally { opening.current = false; setBusy(false) }
  }
  if (script) return <Screen title={t('setup.newGame')} onBack={back} backLabel={t('common.back')} surface="paper" scroll={false}>
    <Enter>
      <SetupScriptSheet script={script} count={count} bag={bag} shows={shows} busy={busy} error={error}
        onCount={next => { setCount(next); setBag(trimBag(bag, next)) }} onBag={setBag} onShow={show} onCreate={() => void open()} />
    </Enter>
  </Screen>
  return <Screen title={t('setup.scriptStep')} onBack={back} backLabel={t('common.back')}>
    <Enter style={styles.list}>
      {store.scripts.length > 0 ? <Text accessibilityRole="header" aria-level={2} style={[type.text.strong, { color: palette.muted }]}>{t('scripts.editions')}</Text> : null}
      {editions.map(e => <ScriptListRow key={e.id} name={text.edition(e.id).name} logo={editionArt[e.id]}
        detail={editionAuthor}
        detail2={t('setup.charactersCount', { count: listed(e.id as ScriptId, locale).length })}
        accessibilityLabel={text.edition(e.id).name} onPress={() => choose(e.id as ScriptId)} />)}
      {store.scripts.length > 0 ? <Text accessibilityRole="header" aria-level={2} style={[type.text.strong, styles.custom, { color: palette.muted, borderTopColor: palette.line }]}>{t('scripts.yourScripts')}</Text> : null}
      {store.scripts.map(saved => {
        const author = scriptAuthor(saved.script)
        const countLabel = t('setup.charactersCount', { count: listed(saved.script, locale).length })
        return <ScriptListRow key={saved.id} name={saved.script.name} logo={editionArt.custom}
          detail={author || countLabel} {...(author ? { detail2: countLabel } : {})}
          accessibilityLabel={saved.script.name} onPress={() => choose(saved.script)} />
      })}
    </Enter>
  </Screen>
}

const styles = StyleSheet.create({
  list: { flex: 0, gap: space.md },
  custom: { marginTop: space.md, paddingTop: space.lg, borderTopWidth: 1 },
})
