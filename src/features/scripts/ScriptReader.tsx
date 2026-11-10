// The script sheet in read mode (docs/app.md, Scripts): an edition or a custom script as the
// printed player sheet, on parchment within the velvet frame. Character art stays static.
// The toolbar starts a game on the script, prints the paper and, for a saved custom script,
// shares or edits it; a script opened from a link offers to save it first.
import { useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import type { Script } from '../../content'
import { editionAuthor, gameText, isCustom, scriptAuthor, scriptRules } from '../../content'
import { editionArt } from '../../content/generated/art'
import { useStore } from '../../store'
import { isWeb } from '../../store/browser'
import { isTeensyville, countTable, djinnText, jinxesAmong, listed, nightOrders, sheetGroups, teamCounts, unknownNotice } from '../../store/scriptSheet'
import { usePhone } from '../../ui/breakpoint'
import { Button, IconButton } from '../../ui/Button'
import { ScriptSheet } from '../../ui/ScriptSheet'
import { gutter, layout, palette, radius, type } from '../../ui/theme'
import { PageVelvet } from '../../ui/Velvet'
import { logoOf } from './compose'
import { ShareScript } from './ShareScript'
import { useSheetWords } from './useScripts'

// Printing opens the browser's print dialog under the print stylesheet.
const canPrint = isWeb && typeof window.print === 'function'

export interface ScriptReaderProps {
  readonly script: Script
  readonly onBack: () => void
  readonly onPlay?: () => void // a script on this device: a new game on it
  readonly onExport?: () => void // a saved custom script: the file download, in the share window
  readonly onEdit?: () => void // a saved custom script: open it in compose
  readonly onSave?: () => void // a script opened from a link: keep it on this device
  readonly saveFailed?: boolean // the last Save could not write
}

export const ScriptReader = ({ script, onBack, onPlay, onExport, onEdit, onSave, saveFailed }: ScriptReaderProps) => {
  const { t, settings } = useStore()
  const locale = settings.locale
  const p = palette
  const insets = useSafeAreaInsets()
  const phone = usePhone()
  const pad = phone ? gutter.phone : gutter.tablet
  const words = useSheetWords()
  const [sharing, setSharing] = useState(false)

  const list = useMemo(() => listed(script, locale), [script, locale])
  const teams = useMemo(() => sheetGroups(list, words.teams), [list, words])
  const jinxes = useMemo(() => jinxesAmong(list, locale), [list, locale])
  const djinn = useMemo(() => djinnText(locale), [locale])
  const counts = useMemo(() => countTable(words.countRows), [words])
  const orders = useMemo(() => nightOrders(script, list, locale, words.marker), [script, list, locale, words])
  const unknown = useMemo(() => unknownNotice(script, t), [script, t])

  const author = isCustom(script) ? scriptAuthor(script) : editionAuthor
  const ownLogo = isCustom(script) ? logoOf(script) : undefined
  const logo = ownLogo ? { uri: ownLogo } : editionArt[isCustom(script) ? 'custom' : script]
  const head = {
    title: isCustom(script) ? script.name : gameText(locale).edition(script).name,
    ...(author ? { author: t('scripts.byAuthor', { author }) } : {}),
    ...(logo !== undefined ? { logo } : {}),
  }

  return (
    <View style={[styles.root, { padding: pad, paddingTop: insets.top + pad }]}>
      <PageVelvet />
      <View style={[styles.paper, { backgroundColor: p.parchment }]}>
        <ScriptSheet teensyville={isTeensyville(teamCounts(list))}
          mode="read"
          {...head}
          teams={teams}
          jinxes={jinxes}
          djinn={djinn}
          rules={scriptRules(script)}
          {...(unknown ? { notice: unknown } : {})}
          counts={counts}
          nightOrders={orders}
          labels={words.labels}
          onBack={onBack}
          backLabel={t('common.back')}
          actions={
            <View style={styles.actions}>
              {saveFailed ? <Text accessibilityRole="alert" style={[type.text.small, styles.failed, { color: p.danger }]}>{t('scripts.saveFailed')}</Text> : null}
              {onSave ? <Button label={t('scripts.saveShared')} accessibilityLabel={t('scripts.saveSharedLabel')} icon="add" onPress={onSave} variant="primary" surface="paper" /> : null}
              {/* In the toolbar and not floating at the foot, where the next page has Open grimoire: a
                  second tap landing there would open a board nobody dealt. It is the glyph Open
                  grimoire and Resume game carry, with no words, so the paper stays the heaviest
                  thing on a page meant for reading. On a phone Edit is a glyph too, or the row
                  outgrows the paper in the longer languages. */}
              {onPlay ? <IconButton icon="play" label={t('common.newGame')} onPress={onPlay} surface="paper" /> : null}
              {onEdit ? phone ? <IconButton icon="edit" label={t('scripts.edit')} onPress={onEdit} surface="paper" />
                : <Button label={t('scripts.edit')} icon="edit" onPress={onEdit} variant="text" surface="paper" /> : null}
              {onExport && isCustom(script) ? <IconButton icon="share" label={t('scripts.share')} onPress={() => setSharing(true)} surface="paper" /> : null}
              {canPrint ? <IconButton icon="print" label={t('scripts.print')} onPress={() => window.print()} surface="paper" /> : null}
            </View>
          }
        />
      </View>
      {onExport && isCustom(script) ? <ShareScript visible={sharing} script={script} onClose={() => setSharing(false)} onExport={onExport} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // The setup page's paper cap, so the toolbar stays near the text on a wide window.
  paper: { flex: 1, width: '100%', maxWidth: layout.contentMax, alignSelf: 'center', borderRadius: radius.tile, overflow: 'hidden' },
  actions: { flexDirection: 'row', alignItems: 'center' },
  failed: { flexShrink: 1 },
})
