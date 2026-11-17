// What a finished game offers: Play again for the same players, Replay to walk the table through
// it, and Home. Under the result where the ring's middle has room for both; docked at the foot on
// a phone, in thumb reach and clear of the seats, or wherever the middle is too small.
import type { StyleProp, ViewStyle } from 'react-native'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import type { Translate } from '../../content'
import { Appear } from '../../ui/Appear'
import { Button, focusStyle, isFocused, isHovered } from '../../ui/Button'
import { useFocusVisible } from '../../ui/focus'
import { Icon } from '../../ui/icons'
import type { IconName } from '../../ui/icons'
import { hoverWash, motion, palette, radius, space, touch, type, voteDock } from '../../ui/theme'

// The room the actions take under the result: a gap, the main button and the row of two below it.
export const actionsRoom = { width: 280, height: space.md + touch + space.xs + touch } as const

export const GameOverActions = ({ t, docked, onPlayAgain, onReplay, onHome, style }: {
  readonly t: Translate
  readonly docked?: boolean // a compact row at the board's foot
  readonly onPlayAgain: () => void
  readonly onReplay: () => void
  readonly onHome: () => void
  readonly style?: StyleProp<ViewStyle>
}) => {
  const playAgain = <Button label={t('board.playAgain')} icon="play" variant="primary" onPress={onPlayAgain} />
  return <View pointerEvents="box-none" style={style}>
    {/* The main action leads the docked row, and the other two set their words under their icons,
        so the row stays narrow enough for any phone. */}
    {docked ? <Appear from={1} delay={motion.duration.winWordsDelay} style={styles.dock}>
      {playAgain}
      <DockButton icon="history" label={t('history.replay')} onPress={onReplay} />
      <DockButton icon="home" label={t('common.home')} onPress={onHome} />
    </Appear> : <View style={styles.under}>
      {playAgain}
      <View style={styles.row}>
        <Button label={t('history.replay')} icon="history" variant="text" onPress={onReplay} />
        <Button label={t('common.home')} icon="home" variant="text" onPress={onHome} />
      </View>
    </View>}
  </View>
}

const DockButton = ({ icon, label, onPress }: { readonly icon: IconName; readonly label: string; readonly onPress: () => void }) => {
  const focusVisible = useFocusVisible()
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    style={(state) => [styles.small, { backgroundColor: isHovered(state) ? hoverWash.felt : 'transparent',
      opacity: state.pressed ? motion.pressedOpacity : 1 }, focusStyle(palette, isFocused(state) && focusVisible)]}>
    <Icon name={icon} color={palette.text} size={20} />
    <Text numberOfLines={1} style={[type.text.small, { color: palette.text }]}>{label}</Text>
  </Pressable>
}

const styles = StyleSheet.create({
  under: { width: actionsRoom.width, gap: space.xs, paddingTop: space.md },
  row: { flexDirection: 'row', justifyContent: 'center', gap: space.sm },
  // The vote dock's card, so the board's foot reads the same in every phase.
  dock: { flexDirection: 'row', alignItems: 'center', gap: space.xs, padding: space.xs, backgroundColor: voteDock.surface,
    borderColor: voteDock.edge, borderWidth: 1, borderRadius: radius.control },
  small: { minWidth: 64, minHeight: touch, alignItems: 'center', justifyContent: 'center', gap: space.xxs,
    paddingHorizontal: space.sm, borderRadius: radius.control },
})
