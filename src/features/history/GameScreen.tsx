import { useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Image, StyleSheet, Text } from 'react-native'

import { boardOf, inLocale, useStore } from '../../store'
import { bluffsOf } from '../../store/bluffs'
import { chronicleOf } from '../../store/chronicle'
import { describeGame } from '../../store/gameSummary'
import { Button } from '../../ui/Button'
import { Confirm } from '../../ui/Confirm'
import { listedLogo } from '../../ui/ScriptListRow'
import { Screen } from '../../ui/Screen'
import { palette, space, type } from '../../ui/theme'
import { GameChronicle } from './GameChronicle'
import { HistoryStyles } from './HistoryStyles'
import { PlayerRoster } from './PlayerRoster'
import { useLaunch } from './useLaunch'

// One saved game on a page of its own: how it stands or ended, who played what, then its days
// and nights. The list stays a list, and this page is the only thing to scroll, so a long game
// costs nothing but its own length. The bar keeps the script's name and the way back in view.
export const GameScreen = ({ id }: { readonly id: string }) => {
  const store = useStore()
  const router = useRouter()
  const { settings, t } = store
  const locale = settings.locale
  const game = store.games.find((g) => g.id === id)
  const [confirming, setConfirming] = useState(false)
  const { launch, openingId, failedId } = useLaunch()

  const row = useMemo(() => game && describeGame(game, t, locale), [game, t, locale])
  const board = useMemo(() => game && inLocale(boardOf({ game, redo: [] }), locale), [game, locale])
  const chronicle = useMemo(() => game && chronicleOf(game.log, game.script), [game])

  // A page that opens takes keyboard and screen reader focus with it, off the row left behind.
  const page = useRef<HTMLElement>(null)
  const found = game !== undefined
  useEffect(() => { if (found) page.current?.focus({ preventScroll: true }) }, [found])

  // A game opened from its address has no list behind it.
  const back = () => (router.canGoBack() ? router.back() : router.replace('/history'))

  if (!game || !row || !board || !chronicle) {
    return (
      <Screen title={t('common.history')} onBack={back} backLabel={t('common.back')}>
        {store.ready ? <Text accessibilityRole="alert" style={[type.text.body, { color: palette.text }]}>{t('history.missing')}</Text> : null}
      </Screen>
    )
  }

  const canResume = !row.over
  const canReplay = game.log.length > 0
  const busy = openingId === game.id
  const stateColor = row.winner === 'good' ? palette.goodOnPaper : row.winner === 'evil' ? palette.evilOnPaper : undefined

  return (
    <Screen title={row.name} onBack={back} backLabel={t('common.back')} surface="paper" contentMax={1040}>
      <HistoryStyles />
      <article ref={page} className="history-game" tabIndex={-1} aria-label={row.a11y}>
        <header className="history-result">
          <Image source={listedLogo(game.script)} style={{ width: 56, height: 62 }} resizeMode="contain" accessible={false} />
          <div className="history-result-text">
            <p className="history-result-state" style={stateColor ? { color: stateColor } : undefined}>{row.phase}</p>
            <p className="history-result-meta">{row.when} · {row.duration}</p>
            <p className="history-result-meta">{row.players}</p>
          </div>
        </header>
        {canResume || canReplay ? (
          <div className="history-actions">
            {canReplay ? (
              <Button label={t('history.replay')} accessibilityLabel={t('history.replayGame', { name: row.name })}
                {...(canResume ? {} : { icon: 'history' as const })}
                variant={canResume ? 'secondary' : 'primary'} surface="paper" disabled={busy} onPress={() => launch(game, true)} style={styles.action} />
            ) : null}
            {canResume ? (
              <Button label={t('history.resume')} accessibilityLabel={t('history.resumeGame', { name: row.name })} icon="play"
                variant="primary" surface="paper" disabled={busy} onPress={() => launch(game, false)} style={styles.action} />
            ) : null}
          </div>
        ) : null}
        {failedId === game.id ? <p role="alert" className="history-failed">{t('history.openFailed')}</p> : null}

        <PlayerRoster seats={board.seats} bluffs={bluffsOf(board, game.log)} loose={board.loose}
          stories={chronicle.players} setup={chronicle.setup} locale={locale} t={t} />
        <GameChronicle chapters={chronicle.chapters} locale={locale} t={t}
          {...(row.over ? { ending: { label: row.phase, ...(stateColor ? { color: stateColor } : {}) } } : {})} />

        <div className="history-game-footer">
          <Button label={t('history.delete')} accessibilityLabel={t('common.deleteGame', { name: row.name })} icon="trash"
            variant="dangerText" surface="paper" onPress={() => setConfirming(true)} style={styles.delete} />
        </div>
      </article>
      <Confirm visible={confirming}
        title={t('common.deleteGameTitle')} message={t('common.deleteGameMessage')}
        confirmLabel={t('common.deleteGameConfirm')} cancelLabel={t('common.cancel')}
        onConfirm={() => {
          setConfirming(false)
          // Leave first: the page has nothing to show once its game is gone.
          back()
          void store.remove(game.id)
        }} onCancel={() => setConfirming(false)} danger />
    </Screen>
  )
}

const styles = StyleSheet.create({
  // Replay and Resume share the row evenly, however long their translations run.
  action: { flexGrow: 1, flexBasis: 0 },
  // A text button pads its label; pull it out so the word lines up with the page's edge.
  delete: { marginRight: -space.lg },
})
