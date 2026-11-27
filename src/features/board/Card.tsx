// The info token turned to a player: large words on felt and character tokens where needed, or
// the tokens alone, as one block sized to the window. The token rises into place, the words
// follow a beat later, and a hold hands the phone back. While editing, the same card is its own
// preview above the token keys, and only the shown card is turned to a player.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { DragEvent, MouseEvent, ReactNode, PointerEvent as ReactPointerEvent } from 'react'
import { Animated, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import type { TextStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import type { CardSpec, PrintedCharacter } from '../../ui/BoardInteraction'
import { Button, IconButton } from '../../ui/Button'
import { usePhone } from '../../ui/breakpoint'
import { useFocusVisible } from '../../ui/focus'
import { durationFor, usePresence, useReducedMotion } from '../../ui/motion'
import { PaperTexture } from '../../ui/PaperTexture'
import { card, font, gutter, hairline, motion, palette, radius, space, type } from '../../ui/theme'
import type { Size } from '../../ui/theme'
import { Token } from '../../ui/Token'
import type { TokenKey, TokenKeyGroup } from '../../ui/TokenKeys'
import { TokenKeys } from '../../ui/TokenKeys'
import { captionExtra, cardTokens } from './cardLayout'
import { slack, widthAtOnePoint } from './textWidth'

export interface CardLabels {
  readonly close: string // the editing card's cross, and the shown card's keyboard Close
  readonly holdHint: string // what a tap on the shown card says: hold to close
  readonly change: string
  readonly show: string
  readonly takeLast: string // the key that takes the last token off
  readonly done: string // the key that puts the keys away on a card of one token
  readonly takeOff: (name: string) => string // a token on the editing card
}

export interface CardProps {
  readonly spec: CardSpec
  readonly editing: boolean // it comes up to be filled rather than shown
  readonly takes: number // tokens it takes: one shows on a key's tap, none offers no Change
  readonly keys: readonly TokenKeyGroup[]
  readonly onDismiss: () => void
  readonly labels: CardLabels
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

export const Card = ({ spec, editing: opensEditing, takes, keys, onDismiss, labels }: CardProps) => {
  const p = palette
  const insets = useSafeAreaInsets()
  const phone = usePhone()
  const window = useWindowDimensions()
  const reduced = useReducedMotion()

  // The tokens typed live here while the card is up: showing records nothing, and the cross
  // drops whatever was typed.
  const [editing, setEditing] = useState(opensEditing)
  const [printed, setPrinted] = useState<readonly PrintedCharacter[]>(spec.characters ?? [])
  // An empty card being filled holds its token's place with an empty disc, so it previews.
  const empty = editing && takes > 0 && printed.length === 0
  const slots = empty ? 1 : printed.length
  const wordsOnly = slots === 0 && !spec.caption
  const numberOnly = wordsOnly && /^\d+$/.test(spec.words)
  const large = Math.min(window.width, window.height) >= card.largeWordsFrom
  const wordsStyle = numberOnly ? styles.number : spec.words.length > 100 ? type.display.title : large ? type.display.heroLarge : type.display.hero

  // The words wrap differently in every locale, so the block is laid out from their measured
  // height, starting from one line until the first measure arrives under the token's rise.
  const [box, setBox] = useState<Size>({ width: window.width, height: window.height - insets.top - insets.bottom })
  const [wordsHeight, setWordsHeight] = useState<number>(wordsStyle.lineHeight ?? 0)
  const [belowHeight, setBelowHeight] = useState(0)
  // An editing card has no hint at its foot, and the keys under it leave little height.
  const foot = editing ? space.md : card.margin
  const tokens = cardTokens({
    width: box.width, height: box.height, count: slots, roomy: !phone, foot,
    words: spec.words !== '' ? wordsHeight : 0, below: spec.caption ? belowHeight : 0,
  })
  const { size, columns, gap, captioned } = tokens
  const cell = captioned ? size + captionExtra : size
  const captionStyle = captioned ? captionFit(printed.map((c) => c.name), cell) : undefined
  // What the reveal keys on: a re-render with an equal card must not run it again. It runs once
  // as editing starts, not on every key, and again as the card is shown at its full size.
  const revealKey = editing ? 'editing' : [spec.kind, spec.words, spec.caption, ...printed.map((c) => c.id)].join('|')

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
      // Only the shown card is turned to a player, so only it closes on a hold.
      if (editing || closing || press.current || !event.isPrimary || event.button !== 0) return
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

  // A key's tap. A card of one token shows at once, so typing it is the whole step; a card of
  // several takes or gives back the key and waits for Show.
  const tapKey = (key: TokenKey) => {
    const character = { id: key.id, name: key.name }
    if (takes === 1) {
      setPrinted([character])
      setEditing(false)
      return
    }
    setPrinted((now) => now.some((c) => c.id === key.id) ? now.filter((c) => c.id !== key.id)
      : now.length < takes ? [...now, character] : now)
  }
  const show = () => {
    if (printed.length > 0) setEditing(false)
  }

  const horizontal = phone ? gutter.phone : gutter.tablet
  // A window wider than tall has no height to give the keys, so they stand on the right.
  const side = editing && window.width > window.height
  const corner = insets.top + space.md
  return (
    <div {...handlers} style={{
      flex: 1, display: 'flex', flexDirection: side ? 'row' : 'column', minHeight: 0, position: 'relative', backgroundColor: p.felt,
      userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
      opacity: closing ? 0 : 1, transition: reduced ? undefined : `opacity ${motion.duration.cardClose}ms ${motion.css.easeIn}`,
    }}>
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: editing && !side ? 0 : insets.bottom }]}>
        <ScrollView
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout
            setBox((b) => (b.width === width && b.height === height ? b : { width, height }))
          }}
          contentContainerStyle={[styles.content, { paddingBottom: foot }]}
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
            {slots > 0 ? (
              <View style={[styles.grid, { gap, width: columns * cell + (columns - 1) * gap }]}>
                {empty ? <Token size={size} /> : printed.map((c, i) => (
                  // The night and reminder leaves are the Storyteller's, as on the setup reveal.
                  <View key={`${c.id}-${i}`} style={[styles.cell, { width: cell }]}>
                    <Token character={c.id} name={c.name} size={size} printName={!captioned} markers={false} {...(spec.tint ? { alignment: spec.tint } : {})}
                      {...(editing ? { accessibilityLabel: labels.takeOff(c.name), onPress: () => setPrinted((now) => now.filter((_, at) => at !== i)) } : {})} />
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
        {editing ? (
          // Leaves without showing anything; only the shown card needs a hold.
          <View style={[styles.corner, { top: corner, left: space.md }]}>
            <IconButton icon="close" label={labels.close} onPress={onDismiss} />
          </View>
        ) : <HiddenClose label={labels.close} top={corner} onPress={close} />}
        {/* A player can see it, so it says nothing about the game. A control, so no hold starts on it. */}
        {!editing && takes > 0 && printed.length > 0 ? (
          <View style={[styles.corner, { top: corner, right: space.md }]}>
            <Button variant="text" label={labels.change} onPress={() => setEditing(true)} />
          </View>
        ) : null}
        {!editing ? <Hint shown={hint} label={labels.holdHint} bottom={insets.bottom + space.md} /> : null}
      </View>
      {editing ? <KeysDock side={side} reduced={reduced}>
        <View style={[styles.bar, { paddingHorizontal: horizontal }, side ? { paddingTop: insets.top + space.sm } : {}]}>
          {takes > 1 ? <IconButton icon="backspace" label={labels.takeLast} onPress={() => setPrinted((now) => now.slice(0, -1))} disabled={printed.length === 0} /> : <View />}
          {takes > 1 ? <Button variant="brass" label={labels.show} onPress={show} disabled={printed.length === 0} />
            : <IconButton icon="chevronDown" label={labels.done} onPress={show} disabled={printed.length === 0} />}
        </View>
        <View style={[styles.paper, side ? styles.paperSide : { maxHeight: window.height * card.keys.heightShare },
          { backgroundColor: p.parchment, borderColor: p.accent }]}>
          <PaperTexture />
          <ScrollView contentContainerStyle={[styles.keys, { paddingBottom: insets.bottom + space.lg, paddingRight: space.sm + (side ? insets.right : 0) }]}>
            <TokenKeys groups={keys} chosen={printed.map((c) => c.id)} full={takes > 1 && printed.length >= takes} onPress={tapKey} />
          </ScrollView>
        </View>
      </KeysDock> : null}
      {ring ? <HoldRing key={ring.key} x={ring.x} y={ring.y} emptying={ring.emptying} reduced={reduced}
        onEmpty={() => setRing((r) => (r?.key === ring.key ? undefined : r))} /> : null}
    </div>
  )
}

// The keys come up from the foot, or in from the side, as a device's keyboard does. They leave
// at once as the card is shown, since the card's own reveal is the motion then.
const KeysDock = ({ side, reduced, children }: { readonly side: boolean; readonly reduced: boolean; readonly children: ReactNode }) => {
  const window = useWindowDimensions()
  const [shown] = useState(() => new Animated.Value(0))
  useEffect(() => {
    const run = Animated.timing(shown, { toValue: 1, duration: durationFor(motion.duration.sheetIn, reduced, true), easing: motion.ease, useNativeDriver: false })
    run.start()
    return () => run.stop()
  }, [shown, reduced])
  const travel = reduced ? 0 : space.xxxl
  const offset = shown.interpolate({ inputRange: [0, 1], outputRange: [travel, 0] })
  return (
    <Animated.View style={[side ? { width: Math.min(card.keys.sideMaximum, window.width * card.keys.sideShare) } : styles.dockFoot,
      { opacity: shown, transform: [side ? { translateX: offset } : { translateY: offset }] }]}>
      {children}
    </Animated.View>
  )
}

// Keyboard and screen reader users cannot hold, so the card keeps one real Close button. It is
// out of sight until it takes keyboard focus, and takes no pointer: a tap must never close.
const HiddenClose = ({ label, top, onPress }: { readonly label: string; readonly top: number; readonly onPress: () => void }) => {
  const focusVisible = useFocusVisible()
  const [focused, setFocused] = useState(false)
  const shown = focused && focusVisible
  return (
    <div onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{ position: 'absolute', top, left: space.md, opacity: shown ? 1 : 0, pointerEvents: shown ? 'auto' : 'none' }}>
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
  corner: { position: 'absolute' },
  // The bar sits on the felt over the keys, Show at the right under the thumb.
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space.sm },
  dockFoot: { flexShrink: 0 },
  // The keys lie on the sheet's paper, its top corners and brass edge, where a keyboard lives.
  paper: { overflow: 'hidden', borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet,
    borderWidth: hairline, borderBottomWidth: 0 },
  paperSide: { flex: 1, borderRightWidth: 0, borderTopRightRadius: 0 },
  // Narrow padding, so a 320 point phone still gets six keys across.
  keys: { paddingTop: space.lg, paddingLeft: space.sm },
  hint: { borderRadius: 999, paddingHorizontal: space.lg, paddingVertical: space.sm },
})
