import { useEffect, useState, useSyncExternalStore } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import type { Locale, Translate } from '../../content'
import { focusStyle, isFocused } from '../../ui/Button'
import { useFocusVisible } from '../../ui/focus'
import { Icon } from '../../ui/icons'
import { TextLink } from '../../ui/TextLink'
import { palette, radius, space, type } from '../../ui/theme'
import { bugReport, contactAddress, feedbackMail, thisDevice } from './feedback'

// False while React hydrates the export, which has no window, and true from then on.
const subscribeNothing = () => () => {}
const useLive = () => useSyncExternalStore(subscribeNothing, () => true, () => false)

// One row like Language's, so the group is no taller than the others: the email is what most
// people want, and the two other ways to reach us are links under it.
export const FeedbackSection = ({ t, locale, languageName, version }: {
  readonly t: Translate
  readonly locale: Locale
  readonly languageName: string
  readonly version: string | undefined
}) => {
  // The bug form's link learns the device once the page is live, so it hydrates as exported.
  const device = useLive() ? thisDevice(locale, version) : undefined
  const focusVisible = useFocusVisible()
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
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.sendFeedback')} onPress={send}
        style={(state) => [styles.row, { backgroundColor: state.pressed ? palette.paperPressed : 'transparent' },
          focusStyle(palette, isFocused(state) && focusVisible, 'paper')]}>
        <Icon name="mail" color={palette.ink} size={22} />
        <View style={styles.words}>
          <Text style={[type.text.strong, styles.ink]}>{t('common.sendFeedback')}</Text>
          <Text style={[type.text.small, styles.muted]}>{t('common.feedbackLead')}</Text>
        </View>
        <Icon name="chevronRight" color={palette.ink} size={22} />
      </Pressable>
      <Text style={[type.text.small, styles.muted]}>
        <TextLink onPress={copy} surface="paper">{t(copied === 'yes' ? 'common.addressCopied' : 'common.copyAddress')}</TextLink>
        {' · '}
        <TextLink href={device ? bugReport(device, languageName) : bugReport()} external surface="paper">{t('common.feedbackGithub')}</TextLink>
      </Text>
      {copied === 'failed' ? (
        <View accessibilityRole="alert" style={styles.failed}>
          <Text style={[type.text.small, styles.muted]}>{t('common.copyAddressFailed')}</Text>
          <Text selectable style={[type.text.body, styles.ink]}>{contactAddress}</Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  body: { gap: space.md },
  muted: { color: palette.inkMuted },
  ink: { color: palette.ink },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, paddingHorizontal: space.md, paddingVertical: space.sm,
    borderWidth: 2, borderColor: palette.inkMuted, borderRadius: radius.control,
  },
  words: { flex: 1, minWidth: 0 },
  failed: { gap: space.xs },
})
