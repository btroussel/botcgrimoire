import { useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { Art } from './Art'
import { useWindowWidth } from './breakpoint'
import { focusStyle } from './Button'
import { useFocusVisible } from './focus'
import { Icon } from './icons'
import { PaperTexture } from './PaperTexture'
import { motion, palette, radius, scriptListLogo, shadows, space, type } from './theme'

// Choosing a script and opening it in the library share its identity and touch treatment.
// Secondary actions are siblings of the main target, never buttons nested in that target.
// A character in the library has its token where a script has its logo. The main target's hover
// and focus outline the whole ticket, a secondary action included, since the ticket reads as one.
// The lines under a script's name, the same wherever it is listed: who wrote it, then how many
// characters it has.
export const scriptDetails = (author: string | undefined, count: string): { readonly detail: string; readonly detail2?: string } =>
  author ? { detail: author, detail2: count } : { detail: count }

export const ScriptListRow = ({ logo, leading, name, detail, detail2, accessibilityLabel, onPress, onLongPress, right }: {
  readonly logo?: number | undefined
  readonly leading?: ReactNode // drawn in place of a logo
  readonly name: string
  readonly detail: string
  readonly detail2?: string
  readonly accessibilityLabel: string
  readonly onPress: () => void
  readonly onLongPress?: () => void
  readonly right?: ReactNode
}) => {
  const compact = useWindowWidth() < 480
  const focusVisible = useFocusVisible()
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  return <View style={[styles.row, focusStyle(palette, (focused && focusVisible) || hovered)]}>
    <PaperTexture radius={radius.tile} />
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress}
      {...(onLongPress ? { onLongPress } : {})}
      onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={state => [styles.body, { outlineWidth: 0, opacity: state.pressed ? motion.pressedOpacity : 1 }]}>
      <View style={styles.logoMount}>
        {leading ?? (logo !== undefined ? <View style={[styles.logo, compact ? styles.compactLogo : null]}><Art source={logo} /></View> : null)}
      </View>
      <View style={styles.text}>
        <Text style={[type.display.title, { color: palette.ink }]}>{name}</Text>
        <Text style={[type.text.small, { color: palette.inkMuted }]}>{detail}</Text>
        {detail2 ? <Text style={[type.text.small, { color: palette.inkMuted }]}>{detail2}</Text> : null}
      </View>
      {!right ? <Icon name="chevronRight" color={palette.inkMuted} /> : null}
    </Pressable>
    {right ? <View style={styles.right}>{right}</View> : null}
  </View>
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderWidth: 1, borderColor: palette.parchmentShade, backgroundColor: palette.parchment, borderRadius: radius.tile, boxShadow: shadows.ticket },
  body: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.tile },
  logoMount: { flexShrink: 0 },
  logo: scriptListLogo,
  compactLogo: { width: 58, height: 76 },
  text: { flex: 1, minWidth: 0, gap: space.xxs },
  right: { justifyContent: 'center', paddingRight: space.xs },
})
