// The info token turned to a player: large words on felt and character tokens where needed, or
// the tokens alone, as one block sized to the window. The token rises into place, the words
// follow a beat later, and a hold hands the phone back.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { DragEvent, MouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { Animated, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import type { TextStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import type { CardSpec } from '../../ui/BoardInteraction'
import { IconButton } from '../../ui/Button'
import { usePhone } from '../../ui/breakpoint'
import { useFocusVisible } from '../../ui/focus'
import { durationFor, usePresence, useReducedMotion } from '../../ui/motion'
import { card, font, gutter, motion, palette, space, type } from '../../ui/theme'
import type { Size } from '../../ui/theme'
import { Token } from '../../ui/Token'
import { captionExtra, cardTokens } from './cardLayout'
import { slack, widthAtOnePoint } from './textWidth'

export interface CardProps {
  readonly spec: CardSpec
  readonly onDismiss: () => void
  readonly closeLabel: string // the keyboard's Close button
  readonly holdHint: string // what a tap on the card says: hold to close
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

interface Press {
  readonly pointer: number
  readonly x: number
  readonly y: number
  readonly timer: ReturnType<typeof setTimeout>
}

export const Card = ({ spec, onDismiss, closeLabel, holdHint }: CardProps) => {
  const p = palette
  const insets = useSafeAreaInsets()
  const phone = usePhone()
  const window = useWindowDimensions()
  const reduced = useReducedMotion()

  const printed = spec.characters ?? []
  const wordsOnly = printed.length === 0 && !spec.caption
  const numberOnly = wordsOnly && /^\d+$/.test(spec.words)
  const large = Math.min(window.width, window.height) >= card.largeWordsFrom
  const wordsStyle = numberOnly ? styles.number : spec.words.length > 100 ? type.display.title : large ? type.display.heroLarge : type.display.hero

  // The words wrap differently in every locale, so the block is laid out from their measured
  // height, starting from one line until the first measure arrives under the token's rise.
  const [box, setBox] = useState<Size>({ width: window.width, height: window.height - insets.top - insets.bottom })
  const [wordsHeight, setWordsHeight] = useState<number>(wordsStyle.lineHeight ?? 0)
  const [belowHeight, setBelowHeight] = useState(0)
  const tokens = cardTokens({
    width: box.width, height: box.height, count: printed.length, roomy: !phone,
    words: spec.words !== '' ? wordsHeight : 0, below: spec.caption ? belowHeight : 0,
  })
  const { size, columns, gap, captioned } = tokens
  const cell = captioned ? size + captionExtra : size
  const captionStyle = captioned ? captionFit(printed.map((c) => c.name), cell) : undefined
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

  // Hold to close. The card is held screen out toward a player, so a stray thumb must not hand
  // them the grimoire: a tap only shows the hint, and a press held for `motion.duration.hold`
  // closes. A drift past the slop is a scroll and cancels quietly.
  const press = useRef<Press | undefined>(undefined)
  const [ring, setRing] = useState<{ readonly x: number; readonly y: number; readonly key: number; readonly emptying: boolean }>()
  const [hint, setHint] = useState(false)
  const hintTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [closing, setClosing] = useState(false)
  const faded = useRef(false)
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const latestDismiss = useRef(onDismiss)
  useLayoutEffect(() => { latestDismiss.current = onDismiss })

  // The card leaves only once the fade has run and the thumb has lifted: lifted over the board,
  // the release would otherwise land on whatever seat is under it.
  const close = useCallback(() => {
    setClosing(true)
    fadeTimer.current = setTimeout(() => {
      faded.current = true
      if (!press.current) latestDismiss.current()
    }, reduced ? 0 : motion.duration.cardClose)
  }, [reduced])

  const showHint = () => {
    setHint(true)
    clearTimeout(hintTimer.current)
    hintTimer.current = setTimeout(() => setHint(false), motion.duration.holdHint)
  }
  useEffect(() => () => {
    clearTimeout(hintTimer.current)
    clearTimeout(fadeTimer.current)
    clearTimeout(press.current?.timer)
  }, [])

  const release = (tapped: boolean) => {
    const held = press.current
    if (!held) return
    clearTimeout(held.timer)
    press.current = undefined
    if (closing) {
      if (faded.current) latestDismiss.current()
      return
    }
    setRing((r) => r && { ...r, emptying: true })
    if (tapped) showHint()
  }

  const handlers = {
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
      if (closing || press.current || !event.isPrimary || event.button !== 0) return
      // A press on a control is the control's, never the start of a hold.
      if (event.target instanceof Element && event.target.closest('button, [role="button"]')) return
      // Captured, so a release outside the window still ends the hold.
      event.currentTarget.setPointerCapture(event.pointerId)
      const bounds = event.currentTarget.getBoundingClientRect()
      press.current = {
        pointer: event.pointerId, x: event.clientX, y: event.clientY,
        timer: setTimeout(close, motion.duration.hold),
      }
      setRing((r) => ({ x: event.clientX - bounds.left, y: event.clientY - bounds.top, key: (r?.key ?? 0) + 1, emptying: false }))
    },
    onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => {
      const held = press.current
      if (!held || closing || event.pointerId !== held.pointer) return
      if (Math.hypot(event.clientX - held.x, event.clientY - held.y) > card.holdSlop) release(false)
    },
    onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerId === press.current?.pointer) release(true)
    },
    onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerId === press.current?.pointer) release(false)
    },
    // A long press on a phone would open the browser's menu, and the art would start a drag.
    onContextMenu: (event: MouseEvent<HTMLDivElement>) => event.preventDefault(),
    onDragStart: (event: DragEvent<HTMLDivElement>) => event.preventDefault(),
  }

  const horizontal = phone ? gutter.phone : gutter.tablet
  return (
    <div {...handlers} style={{
      flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative',
      userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
      opacity: closing ? 0 : 1, transition: reduced ? undefined : `opacity ${motion.duration.cardClose}ms ${motion.css.easeIn}`,
    }}>
      <View style={[styles.root, { backgroundColor: p.felt, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ScrollView
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout
            setBox((b) => (b.width === width && b.height === height ? b : { width, height }))
          }}
          contentContainerStyle={styles.content}
        >
          {spec.words !== '' ? <Animated.Text
            accessibilityRole="header"
            onLayout={(event) => setWordsHeight(event.nativeEvent.layout.height)}
            style={[wordsStyle, styles.words, { color: p.text, opacity: words, paddingHorizontal: horizontal },
              spec.kind === 'custom' ? { textTransform: 'none' } : {}]}
          >
            {spec.words}
          </Animated.Text> : null}
          {!wordsOnly ? <Animated.View style={[styles.stage, { opacity: rise, transform: [{ scale }] }, spec.words !== '' ? { marginTop: card.wordsGap } : {}]}>
            {printed.length > 0 ? (
              <View style={[styles.grid, { gap, width: columns * cell + (columns - 1) * gap }]}>
                {printed.map((c, i) => (
                  // The night and reminder leaves are the Storyteller's, as on the setup reveal.
                  <View key={`${c.id}-${i}`} style={[styles.cell, { width: cell }]}>
                    <Token character={c.id} name={c.name} size={size} printName={!captioned} markers={false} {...(spec.tint ? { alignment: spec.tint } : {})} />
                    {captioned ? (
                      <Text style={[type.display.title, styles.caption, captionStyle, { color: p.text }]} numberOfLines={card.captionLines}>
                        {c.name}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
            {spec.caption ? (
              <Text
                onLayout={(event) => setBelowHeight(event.nativeEvent.layout.height)}
                style={[type.display.title, styles.caption, { color: p.text, paddingHorizontal: horizontal, marginTop: card.captionGap }]}
              >
                {spec.caption}
              </Text>
            ) : null}
          </Animated.View> : null}
        </ScrollView>
        <HiddenClose label={closeLabel} onPress={close} />
        <Hint shown={hint} label={holdHint} bottom={insets.bottom + space.md} />
      </View>
      {ring ? <HoldRing key={ring.key} x={ring.x} y={ring.y} emptying={ring.emptying} reduced={reduced}
        onEmpty={() => setRing((r) => (r?.key === ring.key ? undefined : r))} /> : null}
    </div>
  )
}

// Keyboard and screen reader users cannot hold, so the card keeps one real Close button. It is
// out of sight until it takes keyboard focus, and takes no pointer: a tap must never close.
const HiddenClose = ({ label, onPress }: { readonly label: string; readonly onPress: () => void }) => {
  const focusVisible = useFocusVisible()
  const [focused, setFocused] = useState(false)
  const shown = focused && focusVisible
  return (
    <div onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{ position: 'absolute', top: space.md, left: space.md, opacity: shown ? 1 : 0, pointerEvents: shown ? 'auto' : 'none' }}>
      <IconButton icon="close" label={label} onPress={onPress} />
    </div>
  )
}

const Hint = ({ shown, label, bottom }: { readonly shown: boolean; readonly label: string; readonly bottom: number }) => {
  const { mounted, opacity } = usePresence(shown)
  return (
    <View style={[styles.hintRow, { bottom }]} pointerEvents="none" accessibilityLiveRegion="polite">
      {mounted ? (
        <Animated.View style={[styles.hint, { backgroundColor: palette.feltRaised, opacity }]}>
          <Text style={[type.text.strong, { color: palette.text }]}>{label}</Text>
        </Animated.View>
      ) : null}
    </View>
  )
}

// The brass ring that fills round the thumb over the hold, and empties when let go early. It is
// the progress itself, so reduced motion keeps the fill and only drops the emptying.
const HoldRing = ({ x, y, emptying, reduced, onEmpty }: {
  readonly x: number; readonly y: number; readonly emptying: boolean; readonly reduced: boolean; readonly onEmpty: () => void
}) => {
  const arc = useRef<SVGCircleElement>(null)
  const latestEmpty = useRef(onEmpty)
  useLayoutEffect(() => { latestEmpty.current = onEmpty })
  const { size, width } = card.holdRing
  const radius = (size - width) / 2
  const length = 2 * Math.PI * radius
  useEffect(() => {
    const circle = arc.current
    if (!circle?.animate) return
    if (!emptying) {
      circle.animate([{ strokeDashoffset: length }, { strokeDashoffset: 0 }], { duration: motion.duration.hold, fill: 'forwards' })
      return
    }
    // Empty from wherever the fill had reached, read before the fill is stopped.
    const from = Number.parseFloat(getComputedStyle(circle).strokeDashoffset) || 0
    circle.getAnimations().forEach((a) => a.cancel())
    const empty = circle.animate([{ strokeDashoffset: from }, { strokeDashoffset: length }],
      { duration: reduced ? 0 : motion.duration.holdRelease, easing: motion.css.easeIn, fill: 'forwards' })
    empty.onfinish = () => latestEmpty.current()
    return () => { empty.onfinish = null }
  }, [emptying, length, reduced])
  return (
    <svg width={size} height={size} aria-hidden style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, pointerEvents: 'none', transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={palette.muted} strokeOpacity={0.35} strokeWidth={width} />
      <circle ref={arc} cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={palette.accent} strokeWidth={width}
        strokeLinecap="round" strokeDasharray={length} strokeDashoffset={length} />
    </svg>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // The block centres in the card and scrolls once it cannot fit; the margins keep the corners
  // for Change and the hint.
  content: { flexGrow: 1, justifyContent: 'center', paddingVertical: card.margin },
  words: { textAlign: 'center', textTransform: 'uppercase' },
  number: { ...type.text.tally, fontSize: 96, lineHeight: 112 },
  stage: { alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start' },
  cell: { alignItems: 'center', gap: space.md },
  caption: { textAlign: 'center' },
  hintRow: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  hint: { borderRadius: 999, paddingHorizontal: space.lg, paddingVertical: space.sm },
})
