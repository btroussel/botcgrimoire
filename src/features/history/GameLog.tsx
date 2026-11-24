import { useMemo } from 'react'

import { useStore } from '../../store'
import type { Chapter } from '../../store/chronicle'
import { Sheet } from '../../ui/Sheet'
import { Chapters } from './GameChronicle'
import { HistoryStyles } from './HistoryStyles'

// The running game's days and nights in a window over the board, so a look at who voted or when
// someone died never leaves the game. The latest phase comes first: it is the one being asked
// about, and the list grows at the top where the window opens.
export const GameLog = ({ visible, chapters, onClose }: {
  readonly visible: boolean
  readonly chapters: readonly Chapter[]
  readonly onClose: () => void
}) => {
  const { t, settings } = useStore()
  const latestFirst = useMemo(() => [...chapters].reverse(), [chapters])
  return (
    <Sheet visible={visible} title={t('common.history')} onClose={onClose} closeLabel={t('common.close')}>
      <HistoryStyles />
      <div className="history-log">
        <Chapters chapters={latestFirst} locale={settings.locale} t={t} />
      </div>
    </Sheet>
  )
}
