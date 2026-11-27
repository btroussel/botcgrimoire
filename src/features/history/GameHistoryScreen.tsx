import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Text } from 'react-native'

import type { SavedGame } from '../../store'
import { useStore } from '../../store'
import { backOrHome } from '../../ui/homePath'
import { pickTextFile } from '../../store/browser'
import { describeGame } from '../../store/gameSummary'
import type { GameRow } from '../../store/gameSummary'
import { Button } from '../../ui/Button'
import { Empty } from '../../ui/Empty'
import { useReducedMotion } from '../../ui/motion'
import { PaperTexture } from '../../ui/PaperTexture'
import { Screen } from '../../ui/Screen'
import { palette, radius, type } from '../../ui/theme'
import { gamePath, GameHistoryRow, rowId } from './GameHistoryRow'
import { HistoryStyles } from './HistoryStyles'
import { useLaunch } from './useLaunch'

interface Group {
  readonly label: string
  readonly rows: { readonly game: SavedGame; readonly row: GameRow }[]
}

export const GameHistoryScreen = () => {
  const store = useStore()
  const router = useRouter()
  const reduced = useReducedMotion()
  const { settings, t } = store

  // The row to bring into view once it exists: the game just imported.
  const reveal = useRef<string>(undefined)
  // The game whose page was opened from here, so coming back lands on its row.
  const opened = useRef<string>(undefined)
  const [importing, setImporting] = useState(false)
  const [importFailed, setImportFailed] = useState(false)
  const { launch, openingId, failedId } = useLaunch()

  // The games still running come first, since one of them is the one to resume. The rest are
  // filed under the month they were played, so a row carries the day and its heading the year.
  const groups = useMemo(() => {
    const rows = store.games.map((game) => ({ game, row: describeGame(game, t, settings.locale) }))
    const running = rows.filter(({ row }) => !row.over)
    const finished = rows.filter(({ row }) => row.over).sort((a, b) => b.game.createdAt - a.game.createdAt)
    const out: Group[] = running.length > 0 ? [{ label: t('history.inProgress'), rows: running }] : []
    let month: Group | undefined
    for (const entry of finished) {
      if (month?.label !== entry.row.month) {
        month = { label: entry.row.month, rows: [] }
        out.push(month)
      }
      month.rows.push(entry)
    }
    return out
  }, [store.games, t, settings.locale])

  useEffect(() => {
    const row = reveal.current && document.getElementById(rowId(reveal.current))
    if (!row) return
    row.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' })
    reveal.current = undefined
  })

  // Back from a game's page puts keyboard focus on the row it was opened from.
  useFocusEffect(useCallback(() => {
    const id = opened.current
    opened.current = undefined
    if (id) document.getElementById(rowId(id))?.querySelector('a')?.focus({ preventScroll: true })
  }, []))

  const importGame = async () => {
    setImportFailed(false)
    try {
      const text = await pickTextFile()
      if (text === undefined) return
      setImporting(true)
      reveal.current = await store.importGame(text)
    } catch { setImportFailed(true) } finally { setImporting(false) }
  }

  const open = useCallback((id: SavedGame['id']) => {
    opened.current = id
    router.push(gamePath(id))
  }, [router])

  const count = store.games.length
  const importButton = (
    <Button label={t('history.import')} accessibilityLabel={t('history.importGame')} variant="text"
      disabled={!store.ready || importing} onPress={() => void importGame()} />
  )

  return (
    <Screen title={t('common.history')} onBack={() => backOrHome(router, settings.locale)} backLabel={t('common.back')}
      right={importButton}>
      <HistoryStyles />
      {store.ready && count > 0 ? <p className="history-count">{t('history.savedGames', { count })}</p> : null}
      {importFailed ? <Text accessibilityRole="alert" style={[type.text.body, { color: palette.text }]}>{t('history.importFailed')}</Text> : null}
      {store.ready ? count > 0 ? (
        <div className="history-list">
          {groups.map((group) => (
            <section key={group.label} className="history-group" aria-label={group.label}>
              <h2 className="history-group-title">{group.label}</h2>
              <div className="history-sheet">
                <PaperTexture radius={radius.tile} />
                <ul className="history-rows">
                  {group.rows.map(({ game, row }) => (
                    <GameHistoryRow key={game.id} game={game} row={row} t={t}
                      busy={openingId === game.id} failed={failedId === game.id}
                      onOpen={open} onLaunch={launch} />
                  ))}
                </ul>
              </div>
            </section>
          ))}
        </div>
      ) : <Empty message={t('common.noGames')} actionLabel={t('common.newGame')} onAction={() => router.push('/new')} /> : null}
    </Screen>
  )
}
