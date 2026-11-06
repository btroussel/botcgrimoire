import { useEffect, useState, useSyncExternalStore } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import type { Locale, Translate } from '../../content'
import { Button } from '../../ui/Button'
import { TextLink, withLink } from '../../ui/TextLink'
import { palette, space, type } from '../../ui/theme'
import { bugReport, contactAddress, feedbackMail, thisDevice } from './feedback'

// False while React hydrates the export, which has no window, and true from then on.
const subscribeNothing = () => () => {}
const useLive = () => useSyncExternalStore(subscribeNothing, () => true, () => false)

export const FeedbackSection = ({ t, locale, languageName, version }: {
  readonly t: Translate
  readonly locale: Locale
  readonly languageName: string
  readonly version: string | undefined
}) => {
  // The bug form's link learns the device once the page is live, so it hydrates as exported.
  const device = useLive() ? thisDevice(locale, version) : undefined
  const [copied, setCopied] = useState<'no' | 'yes' | 'failed'>('no')
  useEffect(() => {
    if (copied !== 'yes') return
    const timer = setTimeout(() => setCopied('no'), 2000)
    return () => clearTimeout(timer)
  }, [copied])
  const send = () => { window.location.href = feedbackMail(t, thisDevice(locale, version)) }
  // A phone or computer with no mail app set up does nothing with the mail link, so the address
  // can be copied into whatever the person writes with.
  const copy = () => {
    try {
      navigator.clipboard.writeText(contactAddress).then(() => setCopied('yes'), () => setCopied('failed'))
    } catch {
      setCopied('failed')
    }
  }
  return (
    <View style={styles.body}>
      <Text style={[type.text.body, styles.muted]}>{t('common.feedbackLead')}</Text>
      <View style={styles.actions}>
        <Button label={t('common.sendFeedback')} icon="mail" variant="primary" surface="paper" onPress={send} style={styles.send} />
        <Button label={copied === 'yes' ? t('common.addressCopied') : t('common.copyAddress')} {...(copied === 'yes' ? { icon: 'check' as const } : {})}
          surface="paper" onPress={copy} style={styles.copy} />
      </View>
      {copied === 'failed' ? (
        <View accessibilityRole="alert" style={styles.failed}>
          <Text style={[type.text.small, styles.muted]}>{t('common.copyAddressFailed')}</Text>
          <Text selectable style={[type.text.body, styles.ink]}>{contactAddress}</Text>
        </View>
      ) : null}
      <Text style={[type.text.small, styles.muted]}>
        {withLink(t('common.feedbackGithub'), <TextLink href={device ? bugReport(device, languageName) : bugReport()} external surface="paper">{t('common.feedbackGithubLink')}</TextLink>)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  body: { gap: space.md },
  muted: { color: palette.inkMuted },
  ink: { color: palette.ink },
  // Side by side where both fit, the copy under the send on a phone.
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  send: { flexGrow: 2, flexBasis: 220 },
  copy: { flexGrow: 1, flexBasis: 160 },
  failed: { gap: space.xs },
})
