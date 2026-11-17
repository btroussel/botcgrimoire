// The arrangement's controls: turn the ring either way, Done, and Back to the circle once a seat is
// laid out off it, with a line saying how to move a seat. The ring holds them in its middle; a
// laid-out room may leave no clear middle, and then the board docks them at its foot.
import type { StyleProp, ViewStyle } from 'react-native'
import { StyleSheet, Text, View } from 'react-native'

import type { Translate } from '../../content'
import { Appear } from '../../ui/Appear'
import { EdgeButton } from '../../ui/EdgeButton'
import { hairline, palette, radius, shadows, space, type } from '../../ui/theme'
import type { Size } from '../../ui/theme'

// The room the line takes beside the capsule, two short lines and their margin.
export const hintRoom = 48

export const ArrangeControls = ({ t, hint, docked, onTurn, onDone, onBackToCircle, onSize, style }: {
  readonly t: Translate
  readonly hint: string | undefined
  // At the board's foot, a panel with the line inside it, since below is off the screen and above
  // is seats, as tall as what it covers so nothing peeks out over it.
  readonly docked?: { readonly height: number }
  readonly onTurn: ((direction: 'clockwise' | 'counterclockwise') => void) | undefined
  readonly onDone: () => void
  readonly onBackToCircle: (() => void) | undefined
  readonly onSize?: (size: Size) => void // the capsule alone, as measured
  readonly style: StyleProp<ViewStyle>
}) => (
  <View id="ring-turn" style={style} onLayout={event => onSize?.({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}>
    {docked ? <Appear style={[styles.turn, styles.docked, { minHeight: docked.height }]}>
      {hint ? <Text style={[type.text.small, styles.dockedHint]}>{hint}</Text> : null}
      <View style={styles.row}>
        <Buttons t={t} onTurn={onTurn} onDone={onDone} onBackToCircle={onBackToCircle} />
      </View>
    </Appear> : <>
      <Appear style={[styles.turn, styles.row]}>
        <Buttons t={t} onTurn={onTurn} onDone={onDone} onBackToCircle={onBackToCircle} />
      </Appear>
      {/* Hung below the capsule at its width, so it never reaches the seats' names beside it. */}
      {hint ? <Text style={[type.text.small, styles.hint]}>{hint}</Text> : null}
    </>}
  </View>
)

const Buttons = ({ t, onTurn, onDone, onBackToCircle }: {
  readonly t: Translate
  readonly onTurn: ((direction: 'clockwise' | 'counterclockwise') => void) | undefined
  readonly onDone: () => void
  readonly onBackToCircle: (() => void) | undefined
}) => <>
  {onTurn ? <EdgeButton icon="turnLeft" label={t('board.turnCounterclockwise')} onPress={() => onTurn('counterclockwise')} /> : null}
  <EdgeButton icon="check" label={t('common.done')} onPress={onDone} />
  {onTurn ? <EdgeButton icon="turnRight" label={t('board.turnClockwise')} onPress={() => onTurn('clockwise')} /> : null}
  {/* Apart from Done and the turns, as it moves every laid-out token at once. */}
  {onBackToCircle ? <>
    <View style={styles.rule} />
    <EdgeButton icon="circle" label={t('board.backToCircle')} onPress={onBackToCircle} />
  </> : null}
</>

const styles = StyleSheet.create({
  hint: { position: 'absolute', top: '100%', left: 0, right: 0, marginTop: space.sm, textAlign: 'center', color: palette.text,
    textShadowColor: palette.felt, textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  // The toolbar's ink capsule, so the turning controls read as the board's own.
  turn: { padding: space.xxs, borderRadius: radius.control,
    backgroundColor: palette.ink, borderWidth: hairline, borderColor: palette.inkMuted, boxShadow: shadows.lifted },
  row: { flexDirection: 'row', alignItems: 'center' },
  docked: { alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', paddingTop: space.xs },
  dockedHint: { color: palette.text, textAlign: 'center', paddingHorizontal: space.sm },
  rule: { width: hairline, alignSelf: 'stretch', marginVertical: space.xs, marginHorizontal: space.xxs, backgroundColor: palette.inkMuted },
})
