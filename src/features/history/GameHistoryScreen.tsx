import { useRouter } from 'expo-router'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Text } from 'react-native'

import type { SavedGame } from '../../store'
import { useStore } from '../../store'
import { backOrHome } from '../../ui/homePath'
import { pickTextFile } from '../../store/browser'
import { describeGame } from '../../store/gameSummary'
import { replayStart } from '../../store/replay'
import { Confirm } from '../../ui/Confirm'
import { Button } from '../../ui/Button'
import { Empty } from '../../ui/Empty'
import { useReducedMotion } from '../../ui/motion'
import { Screen } from '../../ui/Screen'
import { palette, type } from '../../ui/theme'
import { cardId, GameHistoryRow } from './GameHistoryRow'
import { HistoryStyles } from './HistoryStyles'

export const GameHistoryScreen = ({ initialExpandedId }: { readonly initialExpandedId?: string }) => {
  const store = useStore()
  const router = useRouter()
  const reduced = useReducedMotion()
  const { settings, t } = store

  const [expandedIds, setExpandedIds] = useState(() => new Set(initialExpandedId ? [initialExpandedId] : []))
  // The card to bring into view once it exists: a direct link's game, or the one just imported.
  const reveal = useRef(initialExpandedId ? { id: initialExpandedId, smooth: false } : undefined)
  const [deleteId, setDeleteId] = useState<SavedGame['id']>()
  const [openingId, setOpeningId] = useState<string>()
  const [failedId, setFailedId] = useState<string>()
  const [importing, setImporting] = useState(false)
  const [importFailed, setImportFailed] = useState(false)
  const rows = useMemo(() => store.games.map((game) => ({ game, row: describeGame(game, t, settings.locale) })), [store.games, t, settings.locale])
  const missing = store.ready && initialExpandedId !== undefined && !store.games.some((game) => game.id === initialExpandedId)

  useEffect(() => {
    const target = reveal.current
    const card = target && document.getElementById(cardId(target.id))
    if (!target || !card) return
    card.scrollIntoView({ block: 'start', behavior: target.smooth && !reduced ? 'smooth' : 'auto' })
    reveal.current = undefined
  })

  const importGame = async () => {
    setImportFailed(false)
    try {
      const text = await pickTextFile()
      if (text === undefined) return
      setImporting(true)
      const id = await store.importGame(text)
      reveal.current = { id, smooth: true }
      setExpandedIds(previous => new Set(previous).add(id))
    } catch { setImportFailed(true) } finally { setImporting(false) }
  }

  const openGame = async (game: SavedGame, replay: boolean) => {
    if (openingId) return
    setFailedId(undefined)
    setOpeningId(game.id)
    try {
      if (store.session?.game.id !== game.id && !await store.open(game.id)) {
        setFailedId(game.id)
        return
      }
      if (replay) {
        store.lookAt(replayStart(game.log))
        router.push(`/game/${game.id}?replay=1`)
      } else {
        store.returnToPresent()
        router.push(`/game/${game.id}`)
      }
    } catch {
      setFailedId(game.id)
    } finally {
      setOpeningId(undefined)
    }
  }

  // The cards get handlers that never change; launching reads this render's session through a ref.
  const openLatest = useRef(openGame)
  useLayoutEffect(() => { openLatest.current = openGame })
  const launch = useCallback((game: SavedGame, replay: boolean) => void openLatest.current(game, replay), [])
  const toggle = useCallback((id: SavedGame['id']) => setExpandedIds(previous => {
    // Keep other cards open so reading the next game cannot collapse the page above it.
    const next = new Set(previous)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }), [])

  const importLabel = t('history.importGame')
  const importButton = (
    <Button label={t('history.import')} accessibilityLabel={importLabel} variant="text"
      disabled={!store.ready || importing} onPress={() => void importGame()} />
  )

  return (
    <Screen title={t('common.history')} onBack={() => backOrHome(router, settings.locale)} backLabel={t('common.back')} contentMax={1040}
      right={importButton}>
      <HistoryStyles />
      {store.ready && rows.length > 0 ? <p className="history-count">{t('history.savedGames', { count: rows.length })}</p> : null}
      {importFailed ? <Text accessibilityRole="alert" style={[type.text.body, { color: palette.text }]}>{t('history.importFailed')}</Text> : null}
      {missing ? <Text accessibilityRole="alert" style={[type.text.body, { color: palette.text }]}>{t('history.missing')}</Text> : null}
      {store.ready ? rows.length > 0 ? (
        <div className="history-list">
          {rows.map(({ game, row }) => (
            <GameHistoryRow key={game.id} game={game} row={row} locale={settings.locale} t={t}
              expanded={expandedIds.has(game.id)}
              busy={openingId === game.id} failed={failedId === game.id}
              onToggle={toggle} onDelete={setDeleteId} onLaunch={launch} />
          ))}
        </div>
      ) : <Empty message={t('common.noGames')} actionLabel={t('common.newGame')} onAction={() => router.push('/new')} /> : null}
      <Confirm visible={deleteId !== undefined}
        title={t('common.deleteGameTitle')} message={t('common.deleteGameMessage')}
        confirmLabel={t('common.deleteGameConfirm')} cancelLabel={t('common.cancel')}
        onConfirm={() => {
          if (deleteId !== undefined) void store.remove(deleteId)
          setDeleteId(undefined)
        }} onCancel={() => setDeleteId(undefined)} danger />
    </Screen>
  )
}
