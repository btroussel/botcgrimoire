// Sharing a custom script (docs/app.md, Scripts): the link as a QR code for a phone across the
// table, copied, handed to the device's share sheet, or the script as a file. The link carries
// the whole script, so nothing is uploaded and the receiver needs no signal once installed.
import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import type { CustomScript } from '../../content'
import { useStore } from '../../store'
import { isWeb } from '../../store/browser'
import { canLink, hasEmbeddedArt, scriptFragment } from '../../store/scriptLink'
import { Button } from '../../ui/Button'
import { Sheet } from '../../ui/Sheet'
import { palette, radius, space, type } from '../../ui/theme'
import { QrCode, qrModules } from './QrCode'

export interface ShareScriptProps {
  readonly visible: boolean
  readonly script: CustomScript
  readonly onClose: () => void
  readonly onExport: () => void
}

const canShare = isWeb && typeof navigator.share === 'function'

export const ShareScript = ({ visible, script, onClose, onExport }: ShareScriptProps) => {
  const { t } = useStore()
  const p = palette
  const [link, setLink] = useState<string | undefined>(undefined)
  const [copied, setCopied] = useState<'no' | 'yes' | 'failed'>('no')

  useEffect(() => {
    if (!visible || !isWeb || !canLink) return
    let live = true
    void scriptFragment(script).then((fragment) => {
      if (live) setLink(`${window.location.origin}/scripts${fragment}`)
    })
    return () => {
      live = false
    }
  }, [visible, script])
  useEffect(() => {
    if (copied !== 'yes') return
    const timer = setTimeout(() => setCopied('no'), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  const close = () => {
    setCopied('no')
    onClose()
  }
  const modules = useMemo(() => (link === undefined ? undefined : qrModules(link)), [link])
  const art = useMemo(() => hasEmbeddedArt(script), [script])

  // Without a secure page or the permission there is no clipboard; the link is then shown to
  // select by hand.
  const copy = () => {
    if (link === undefined) return
    try {
      navigator.clipboard.writeText(link).then(() => setCopied('yes'), () => setCopied('failed'))
    } catch {
      setCopied('failed')
    }
  }
  // Cancelling the share sheet rejects too; there is nothing to say about a change of mind.
  const share = () => {
    if (link !== undefined) navigator.share({ title: script.name, url: link }).catch(() => undefined)
  }

  return (
    <Sheet visible={visible} title={t('scripts.shareTitle')} onClose={close} closeLabel={t('common.close')}>
      {link === undefined ? null : (
        <>
          <Text style={[type.text.body, { color: p.ink }]}>{t('scripts.shareLead')}</Text>
          {modules ? (
            <View style={[styles.code, { maxWidth: Math.max(240, modules.length * 3) }]}>
              <QrCode modules={modules} label={t('scripts.qrLabel', { name: script.name })} />
            </View>
          ) : (
            <Text style={[type.text.body, { color: p.inkMuted }]}>{t('scripts.qrTooLong')}</Text>
          )}
          {art ? <Text style={[type.text.small, { color: p.inkMuted }]}>{t('scripts.artLeftOut')}</Text> : null}
          <Button label={copied === 'yes' ? t('scripts.linkCopied') : t('scripts.copyLink')} icon={copied === 'yes' ? 'check' : 'link'} onPress={copy} variant="primary" surface="paper" />
          {copied === 'failed' ? (
            <View accessibilityRole="alert" style={styles.failed}>
              <Text style={[type.text.small, { color: p.inkMuted }]}>{t('scripts.copyFailed')}</Text>
              <Text selectable style={[type.text.small, styles.link, { color: p.ink }]}>{link}</Text>
            </View>
          ) : null}
          {canShare ? <Button label={t('scripts.shareLink')} icon="share" onPress={share} surface="paper" /> : null}
        </>
      )}
      <Button label={t('scripts.export')} icon="script" onPress={onExport} surface="paper" />
    </Sheet>
  )
}

const styles = StyleSheet.create({
  // A phone camera reads a short link's code at 240 points from arm's length; a longer link
  // keeps three points a module, within the window's width.
  code: { width: '100%', alignSelf: 'center', borderRadius: radius.control, overflow: 'hidden' },
  failed: { gap: space.xs },
  link: { wordBreak: 'break-all' } as object,
})
