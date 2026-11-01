// Import (docs/app.md, Scripts): a shared link pasted or scanned from a QR code, or a script file.
// Pasting is how a link reaches the installed app on an iPhone, where a tapped link opens in
// Safari instead.
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { useStore } from '../../store'
import { Button } from '../../ui/Button'
import { Field } from '../../ui/Field'
import { Sheet } from '../../ui/Sheet'
import { palette, radius, space, type } from '../../ui/theme'
import { canScan, QrScanner } from './QrScanner'

export interface ImportScriptProps {
  readonly visible: boolean
  readonly onClose: () => void
  readonly onFile: () => void
  // Opens the script the link carries, or answers why it cannot: the first line is the headline.
  readonly onLink: (link: string) => Promise<readonly string[] | undefined>
}

export const ImportScript = ({ visible, onClose, onFile, onLink }: ImportScriptProps) => {
  const { t } = useStore()
  const p = palette
  const [link, setLink] = useState('')
  const [scanning, setScanning] = useState(false)
  const [opening, setOpening] = useState(false)
  const [errors, setErrors] = useState<readonly string[]>([])

  // The window opens empty each time, whichever way it last closed.
  const reset = () => {
    setLink('')
    setScanning(false)
    setErrors([])
  }
  const close = () => {
    reset()
    onClose()
  }
  const open = async (text: string) => {
    setOpening(true)
    setErrors([])
    const problems = await onLink(text)
    setOpening(false)
    if (problems) setErrors(problems)
    else reset()
  }

  if (scanning) return (
    <Sheet visible={visible} title={t('scripts.scanQr')} onClose={close} closeLabel={t('common.close')}
      onBack={() => setScanning(false)} backLabel={t('common.back')}>
      <QrScanner
        label={t('scripts.scanQr')}
        hint={t('scripts.scanHint')}
        failed={t('scripts.cameraFailed')}
        onRead={(text) => {
          setScanning(false)
          void open(text)
        }}
      />
    </Sheet>
  )

  return (
    <Sheet visible={visible} title={t('scripts.import')} onClose={close} closeLabel={t('common.close')}>
      <Field label={t('scripts.linkLabel')} value={link} onChange={(text) => { setLink(text); setErrors([]) }} />
      <Button label={t('scripts.openLink')} icon="link" variant="primary" surface="paper"
        disabled={link.trim() === '' || opening} onPress={() => void open(link)} />
      {errors.length > 0 ? (
        <View accessibilityRole="alert" style={[styles.errors, { backgroundColor: p.paperInset }]}>
          {errors.map((error, index) => <Text key={index} style={[index === 0 ? type.text.strong : type.text.small, { color: index === 0 ? p.danger : p.ink }]}>{error}</Text>)}
        </View>
      ) : null}
      {canScan ? <Button label={t('scripts.scanQr')} icon="scan" surface="paper" onPress={() => { setErrors([]); setScanning(true) }} /> : null}
      <Button label={t('scripts.chooseFile')} icon="script" surface="paper" onPress={() => { reset(); onFile() }} />
    </Sheet>
  )
}

const styles = StyleSheet.create({
  errors: { gap: space.xs, padding: space.lg, borderRadius: radius.tile },
})
