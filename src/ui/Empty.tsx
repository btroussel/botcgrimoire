// The empty state: an empty seat, a line that says what to do here, and the one action that
// does it. The dashed circle is the same mark the board draws for a seat nobody sits in yet, so
// an empty list reads the way an empty table does, and there is no spinner anywhere in the app.
// One rule: the message is direction, not mood, and the action does what the message says.
import { StyleSheet, Text, View } from 'react-native'

import { Button } from './Button'
import { border, palette, space, tokenSize, type } from './theme'

export interface EmptyProps {
  readonly message: string // one line of direction: "No games yet. Start one and it is saved here."
  readonly actionLabel: string // the one action, primary since nothing else on the screen is
  readonly onAction: () => void
}

export const Empty = ({ message, actionLabel, onAction }: EmptyProps) => {
  const quiet = palette.muted
  return (
    <View style={styles.block}>
      <View style={[styles.seat, { borderColor: quiet }]} />
      <Text style={[type.text.body, styles.message, { color: quiet }]}>{message}</Text>
      <Button label={actionLabel} onPress={onAction} variant="primary" />
    </View>
  )
}

const styles = StyleSheet.create({
  block: { alignItems: 'center', gap: space.lg, paddingVertical: space.xxl, paddingHorizontal: space.lg },
  seat: {
    width: tokenSize.board,
    height: tokenSize.board,
    borderRadius: tokenSize.board / 2,
    borderWidth: border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: { textAlign: 'center', maxWidth: 320 },
})
