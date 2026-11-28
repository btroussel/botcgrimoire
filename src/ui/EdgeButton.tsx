// The small control on the board's toolbars: show and more at the edge, the turns and Done while
// the seats are arranged, and a sheet header's word action such as Clear character. A glyph or a
// short word on a 44 square with nothing drawn around it until it matters:
// armed takes the brass ring and glyph (More while the seats are being arranged). The rule: the felt shows
// through, so the art stays the brightest thing on the board.
import { Pressable, StyleSheet, Text } from 'react-native'

import { focusStyle, isFocused, isHovered } from './Button'
import { useFocusVisible } from './focus'
import { Icon } from './icons'
import type { IconName } from './icons'
import { border, hoverWash, motion, palette, radius, space, touch, type } from './theme'

export interface EdgeButtonProps {
  readonly label: string // what a screen reader says, and what is drawn when there is no icon
  readonly onPress: () => void
  readonly icon?: IconName // the glyph; without one the label is drawn as a short word
  readonly armed?: boolean // waiting for a second tap elsewhere: the brass ring and glyph
  readonly disabled?: boolean
  readonly expanded?: boolean
}

export const EdgeButton = ({ label, onPress, icon, armed, disabled, expanded }: EdgeButtonProps) => {
  const p = palette
  const focusVisible = useFocusVisible()
  const color = armed ? p.accent : p.text
  return (
    <div title={icon ? label : undefined} style={{ display: 'contents' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        aria-pressed={armed || undefined}
        aria-expanded={expanded}
        disabled={disabled}
        onPress={onPress}
        style={(state) => [
          styles.hit,
          icon ? styles.square : styles.word,
          { borderColor: armed ? p.accent : 'transparent' },
          isHovered(state) && !disabled ? { backgroundColor: hoverWash.felt } : null,
          focusStyle(p, isFocused(state) && focusVisible),
          { opacity: disabled ? motion.disabledOpacity : state.pressed ? motion.pressedOpacity : 1 },
        ]}
      >
        {icon ? (
          <Icon name={icon} color={color} />
        ) : (
          // A word wraps onto a second line rather than squeeze a sheet's title.
          <Text style={[type.text.label, { color, textAlign: 'center' }]} numberOfLines={2}>
            {label}
          </Text>
        )}
      </Pressable>
    </div>
  )
}

const styles = StyleSheet.create({
  hit: {
    minWidth: touch,
    height: touch,
    borderRadius: radius.control,
    borderWidth: border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  square: { width: touch },
  word: { paddingHorizontal: space.sm, flexShrink: 1, minWidth: 0 },
})
