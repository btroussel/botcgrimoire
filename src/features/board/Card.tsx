// The info token turned to a player: large words on felt and a character token where needed.
// The token rises into place, the words follow a beat later, and a tap hands the phone back.
import { useEffect, useState } from 'react'
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import type { TextStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import type { Alignment } from '../../content'
import { characterArt } from '../../content/generated/art'
import type { CardSpec } from '../../ui/BoardInteraction'
import { IconButton } from '../../ui/Button'
import { usePhone } from '../../ui/breakpoint'
import { durationFor, useReducedMotion } from '../../ui/motion'
import { font, gutter, motion, palette, space, tokenSize, type } from '../../ui/theme'
import { Token } from '../../ui/Token'
import { slack, widthAtOnePoint } from './textWidth'

export interface CardProps {
  readonly spec: CardSpec
  readonly onDismiss: () => void
  readonly closeLabel: string // what a screen reader calls the cross and the tap-anywhere target
}

// The one card whose words are about a side rather than a character carries the generic mark
// of that side and its words in that side's colour.
const markOf = (spec: CardSpec): Alignment | undefined =>
  spec.kind === 'youAreGood' ? 'good' : spec.kind === 'youAreEvil' ? 'evil' : undefined

// Several tokens share a row. Under tablet width they shrink to fit three across the phone with
// a gap between, rounded to a multiple of eight, and since that is below `show` the arc carries
// no name and a caption does; from tablet width they draw at `show` and the arc is the caption.
const rowTokenSize = (width: number, count: number, phone: boolean): number => {
  if (!phone) return tokenSize.show
  const across = Math.max(count, 1)
  // Each captioned cell is space.sm wider than its token, so its name has room under it.
  const usable = width - 2 * gutter.phone - space.lg * (across - 1) - space.sm * across
  const fit = Math.floor(usable / across / 8) * 8
  return Math.min(tokenSize.show, Math.max(tokenSize.sheet, fit))
}

// The captions share one size, shrunk until the longest word among them fits a cell, since a
// name broken mid-word reads as two.
const captionFit = (names: readonly string[], width: number): TextStyle => {
  const { fontSize = 24, lineHeight = 28 } = type.display.title
  const words = names.flatMap((name) => name.split(/\s+/))
  const widest = Math.max(...words.map((word) => widthAtOnePoint(word, font.display.semibold))) * slack * fontSize
  const scale = width / widest
  return scale < 1 ? { fontSize: Math.floor(fontSize * scale), lineHeight: Math.ceil(lineHeight * scale) } : {}
}

export const Card = ({ spec, onDismiss, closeLabel }: CardProps) => {
  const p = palette
  const insets = useSafeAreaInsets()
  const phone = usePhone()
  const { width } = useWindowDimensions()
  const reduced = useReducedMotion()

  const printed = spec.characters ?? []
  const mark = markOf(spec)
  const markArt = mark ? characterArt[mark]?.single : undefined
  const size = printed.length > 1 ? rowTokenSize(width, printed.length, phone) : tokenSize.show
  const captioned = printed.length > 1 && size < tokenSize.show
  const captionStyle = captioned ? captionFit(printed.map((c) => c.name), size + space.sm) : undefined
  // What the reveal keys on: a re-render with an equal spec must not run it again.
  const revealKey = [spec.kind, spec.words, spec.caption, ...printed.map((c) => c.id)].join('|')

  // The reveal: the token rises from scale 0.6 and no opacity, the words fade in from 240 ms in.
  // Under reduced motion the rise is only the fade and the words follow with no delay.
  const [rise] = useState(() => new Animated.Value(0))
  const [words] = useState(() => new Animated.Value(0))
  useEffect(() => {
    rise.setValue(0)
    words.setValue(0)
    const run = Animated.parallel([
      Animated.timing(rise, {
        toValue: 1,
        duration: durationFor(motion.duration.reveal, reduced, true),
        easing: motion.ease,
        useNativeDriver: false,
      }),
      Animated.timing(words, {
        toValue: 1,
        delay: durationFor(motion.duration.revealWordsDelay, reduced),
        duration: durationFor(motion.duration.revealWords, reduced, true),
        easing: motion.ease,
        useNativeDriver: false,
      }),
    ])
    run.start()
    return () => run.stop()
  }, [revealKey, reduced, rise, words])
  const scale = rise.interpolate({ inputRange: [0, 1], outputRange: reduced ? [1, 1] : [0.6, 1] })

  // The containing Modal owns Escape. Closing on keydown here would let the same key's
  // keyup dismiss the player sheet underneath after the card unmounts.
  const gap = phone ? space.lg : space.xl
  const wordsColor = mark ? (mark === 'good' ? p.goodOnFelt : p.evilOnFelt) : p.text
  const wordsOnly = printed.length === 0 && !mark && !spec.caption
  const horizontal = phone ? gutter.phone : gutter.tablet
  const numberOnly = wordsOnly && /^\d+$/.test(spec.words)
  // The tap-anywhere target is a layer under the content, never around it: the cross is a button
  // too and a button inside a button is a DOM error. What is drawn lets the tap through.
  return (
    <View style={[styles.root, { backgroundColor: p.felt, paddingTop: insets.top, paddingBottom: insets.bottom + space.xl }]}>
      <View style={[styles.closeRow, { paddingHorizontal: space.md, paddingTop: space.md }]} pointerEvents="box-none">
        <IconButton icon="close" label={closeLabel} onPress={onDismiss}  />
      </View>
      <ScrollView contentContainerStyle={[styles.content, wordsOnly ? { justifyContent: 'center' } : {}]}>
      <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} onPress={onDismiss} style={styles.tapLayer} />
      <Animated.Text
        pointerEvents="none"
        accessibilityRole="header"
        style={[numberOnly ? styles.number : spec.words.length > 100 ? type.display.title : type.display.hero, styles.words,
          { color: wordsColor, opacity: words, paddingHorizontal: horizontal }, wordsOnly ? { marginTop: 0 } : {}, spec.kind === 'custom' ? { textTransform: 'none' } : {}]}
      >
        {spec.words}
      </Animated.Text>
      {!wordsOnly ? <Animated.View style={[styles.stage, { opacity: rise, transform: [{ scale }] }]} pointerEvents="none">
        {markArt !== undefined && printed.length === 0 ? (
          <Image source={markArt} style={{ width: tokenSize.show, height: tokenSize.show }} accessibilityIgnoresInvertColors />
        ) : null}
        {printed.length > 0 ? (
          <View style={[styles.row, { gap, paddingHorizontal: gutter.phone }]}>
            {printed.map((c, i) => (
              <View key={`${c.id}-${i}`} style={[styles.cell, { width: captioned ? size + space.sm : size }]}>
                <Token character={c.id} name={c.name} size={size} {...(spec.tint ? { alignment: spec.tint } : {})} />
                {captioned ? (
                  <Text style={[type.display.title, styles.caption, captionStyle, { color: p.text }]} numberOfLines={2}>
                    {c.name}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
        {spec.caption ? (
          <Text style={[type.display.title, styles.caption, { color: p.text, paddingHorizontal: horizontal }]}>
            {spec.caption}
          </Text>
        ) : null}
      </Animated.View> : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, paddingVertical: space.lg },
  tapLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  closeRow: { flexDirection: 'row', alignItems: 'flex-start' },
  words: { textAlign: 'center', textTransform: 'uppercase', marginTop: space.xxxl },
  number: { ...type.text.tally, fontSize: 96, lineHeight: 112 },
  // The token block takes what is left below the words and sits in the middle of it.
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start' },
  cell: { alignItems: 'center', gap: space.md },
  caption: { textAlign: 'center' },
})
