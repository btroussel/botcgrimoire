// The info token turned to a player: large words on felt and character tokens where needed, or
// the tokens alone, as one block sized to the window. The token rises into place, the words
// follow a beat later, and a hold hands the phone back. While editing, the same card is its own
// preview above the token keys, and only the shown card is turned to a player. A note's words are
// typed on the card itself, where the player will read them.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { DragEvent, MouseEvent, ReactNode, PointerEvent as ReactPointerEvent, RefObject } from 'react'
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native'
import type { TextInputInstance, TextStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import type { CardSpec, PrintedCharacter } from '../../ui/BoardInteraction'
import { Button, IconButton, focusStyle, isFocused } from '../../ui/Button'
import { usePhone } from '../../ui/breakpoint'
import { EdgeButton } from '../../ui/EdgeButton'
import { fieldCount } from '../../ui/fieldCount'
import { useFocusVisible } from '../../ui/focus'
import { durationFor, usePresence, useReducedMotion } from '../../ui/motion'
import { PaperTexture } from '../../ui/PaperTexture'
import { card, font, gutter, hairline, motion, palette, radius, space, tabular, tokenSize, touch, type } from '../../ui/theme'
import type { Size } from '../../ui/theme'
import { Token } from '../../ui/Token'
import type { TokenKey, TokenKeyGroup } from '../../ui/TokenKeys'
import { TokenKeys } from '../../ui/TokenKeys'
import { useViewport } from '../../ui/Viewport'
import { noteLength } from '../../store/settings'
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
  // A note's editor.
  readonly placeholder: string
  readonly message: string // the note's field, for a screen reader
  readonly letters: string
  readonly tokens: string
  readonly keep: string // the star: keeps the note, and forgets it once kept
  readonly yes: string
  readonly no: string
}

// A note as written on the card: its words and the one token under them.
export interface WrittenNote {
  readonly words: string
  readonly character?: PrintedCharacter
}

export interface CardNote {
  readonly presets: readonly WrittenNote[] // the kept notes, then the script's own cards
  readonly kept: (note: WrittenNote) => boolean
  readonly onKeep: (note: WrittenNote) => void // keeps the note, or forgets it once kept
}

export interface CardProps {
  readonly spec: CardSpec
  readonly editing: boolean // it comes up to be filled rather than shown
  readonly takes: number // tokens it takes: one shows on a key's tap, none offers no Change
  readonly keys: readonly TokenKeyGroup[]
  readonly note?: CardNote // set on a written note
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

export const Card = ({ spec, editing: opensEditing, takes, keys, note, onDismiss, labels }: CardProps) => {
  const p = palette
  const insets = useSafeAreaInsets()
  const phone = usePhone()
  const window = useWindowDimensions()
  const viewport = useViewport()
  const reduced = useReducedMotion()

  // The tokens and a note's words typed live here while the card is up: showing records nothing,
  // and the cross drops whatever was typed.
  const [editing, setEditing] = useState(opensEditing)
  const [printed, setPrinted] = useState<readonly PrintedCharacter[]>(spec.characters ?? [])
  const [written, setWritten] = useState(spec.words)
  // A note's two keyboards share the foot: the device's for its words, the keys for its token.
  const [letters, setLetters] = useState(true)
  const field = note !== undefined && editing
  const text = note ? written : spec.words
  // An empty card being filled holds its token's place with an empty disc, so it previews. A
  // note's token is optional, so it holds no place.
  const empty = editing && !note && takes > 0 && printed.length === 0
  const slots = empty ? 1 : printed.length
  const wordsOnly = slots === 0 && !spec.caption
  const numberOnly = wordsOnly && /^\d+$/.test(text.trim())
  const large = Math.min(window.width, window.height) >= card.largeWordsFrom
  const wordsStyle = numberOnly ? styles.number : text.length > 100 ? type.display.title : large ? type.display.heroLarge : type.display.hero
  const hasWords = field || text !== ''

  // The words wrap differently in every locale, so the block is laid out from their measured
  // height, starting from one line until the first measure arrives under the token's rise.
  const [box, setBox] = useState<Size>({ width: window.width, height: window.height - insets.top - insets.bottom })
  const [wordsHeight, setWordsHeight] = useState<number>(wordsStyle.lineHeight ?? 0)
  const [belowHeight, setBelowHeight] = useState(0)
  // An editing card has no hint at its foot, and the keys under it leave little height.
  const foot = editing ? space.md : card.margin
  const tokens = cardTokens({
    width: box.width, height: box.height, count: slots, roomy: !phone, foot,
    words: hasWords ? wordsHeight : 0, below: spec.caption ? belowHeight : 0,
  })
  const { size, columns, gap, captioned } = tokens
  const cell = captioned ? size + captionExtra : size
  const captionStyle = captioned ? captionFit(printed.map((c) => c.name), cell) : undefined
  // What the reveal keys on: a re-render with an equal card must not run it again. It runs once
  // as editing starts, not on every key, and again as the card is shown at its full size.
  const revealKey = editing ? 'editing' : [spec.kind, text, spec.caption, ...printed.map((c) => c.id)].join('|')

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

  // The caret comes with the letters and leaves with them, so the device's keyboard and the
  // token keys never stand up together. It comes a frame later, since the Modal puts the focus on
  // the dialog once its content has mounted.
  const input = useRef<TextInputInstance>(null)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!field) return
    if (!letters) {
      input.current?.blur()
      return
    }
    const frame = requestAnimationFrame(() => input.current?.focus())
    // The list the note was picked from gives the focus back to the eye on the board as it
    // leaves, after the card is up. Focus sent out of the card's layer comes back to the caret
    // at once, before the dialog's own trap moves it to some other control.
    const reclaim = (event: FocusEvent) => {
      if (event.target instanceof Node && !layerOf(root.current)?.contains(event.target)) input.current?.focus()
    }
    document.addEventListener('focus', reclaim, true)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('focus', reclaim, true)
    }
  }, [field, letters])

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
    // A long press on a phone would open the browser's menu, and the art would start a drag. A
    // note being typed keeps the menu, for pasting.
    onContextMenu: (event: MouseEvent<HTMLDivElement>) => { if (!editing) event.preventDefault() },
    onDragStart: (event: DragEvent<HTMLDivElement>) => event.preventDefault(),
  }

  // A key's tap. A card of one token shows at once, so typing it is the whole step; a card of
  // several takes or gives back the key and waits for Show. A note's token sits under its words
  // and waits for Show with them, and another key replaces it.
  const tapKey = (key: TokenKey) => {
    const character = { id: key.id, name: key.name }
    if (note) {
      setPrinted((now) => (now[0]?.id === key.id ? [] : [character]))
      return
    }
    if (takes === 1) {
      setPrinted([character])
      setEditing(false)
      return
    }
    setPrinted((now) => now.some((c) => c.id === key.id) ? now.filter((c) => c.id !== key.id)
      : now.length < takes ? [...now, character] : now)
  }
  const current: WrittenNote = { words: written.trim(), ...(printed[0] ? { character: printed[0] } : {}) }
  const filled = note ? current.words !== '' || printed.length > 0 : printed.length > 0
  const show = () => {
    if (!filled) return
    if (note) setWritten(current.words)
    setEditing(false)
  }
  // A preset is written, never shown: nothing reaches a player before Show.
  const write = (preset: WrittenNote) => {
    setWritten(preset.words)
    setPrinted(preset.character ? [preset.character] : [])
  }

  const horizontal = phone ? gutter.phone : gutter.tablet
  // The token keys stand up while editing, except while a note's words are being typed.
  const dock = editing && (!note || !letters)
  // A window wider than tall has no height to give the keys, so they stand on the right.
  const side = dock && window.width > window.height
  const corner = insets.top + space.md
  const count = field ? fieldCount(written.length, noteLength) : 'hidden'
  const bar = !editing ? null : note ? (
    <View style={[styles.bar, { paddingHorizontal: horizontal }, side ? { paddingTop: insets.top + space.sm } : {}]}>
      <Keyboards letters={letters} labels={labels} onLetters={setLetters} />
      {/* Kept by a press that leaves the caret where it is. */}
      <KeepCaret style={styles.barEnd}>
        <EdgeButton icon="star" label={labels.keep} armed={filled && note.kept(current)} disabled={!filled} onPress={() => note.onKeep(current)} />
        <Button variant="brass" label={labels.show} onPress={show} disabled={!filled} />
      </KeepCaret>
    </View>
  ) : (
    <View style={[styles.bar, { paddingHorizontal: horizontal }, side ? { paddingTop: insets.top + space.sm } : {}]}>
      {takes > 1 ? <IconButton icon="backspace" label={labels.takeLast} onPress={() => setPrinted((now) => now.slice(0, -1))} disabled={printed.length === 0} /> : <View />}
      {takes > 1 ? <Button variant="brass" label={labels.show} onPress={show} disabled={printed.length === 0} />
        : <IconButton icon="chevronDown" label={labels.done} onPress={show} disabled={printed.length === 0} />}
    </View>
  )
  // The card follows the visible viewport, so with the device's keyboard up the note and its bar
  // stay above it, as a sheet's fields do.
  const frame = viewport.width > 0
    ? { position: 'absolute', top: viewport.top, left: viewport.left, width: viewport.width, height: viewport.height } as const
    : { position: 'relative', flex: 1 } as const
  return (
    // The felt reaches behind the device's keyboard, under the card that stays above it.
    <div style={{ flex: 1, position: 'relative', backgroundColor: p.felt }}>
      <div ref={root} {...handlers} style={{
        ...frame, display: 'flex', flexDirection: side ? 'row' : 'column', minHeight: 0, backgroundColor: p.felt,
        ...(editing ? {} : { userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }),
        opacity: closing ? 0 : 1, transition: reduced ? undefined : `opacity ${motion.duration.cardClose}ms ${motion.css.easeIn}`,
      }}>
        <View style={[styles.root, { paddingTop: insets.top, paddingBottom: dock && !side ? 0 : insets.bottom }]}>
          <ScrollView
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout
              setBox((b) => (b.width === width && b.height === height ? b : { width, height }))
            }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.content, { paddingBottom: foot }]}
          >
            {field ? (
              <View onLayout={(event) => setWordsHeight(event.nativeEvent.layout.height)} style={{ paddingHorizontal: horizontal }}>
                <NoteField inputRef={input} value={written} onChange={setWritten} style={wordsStyle} label={labels.message} placeholder={labels.placeholder} />
                {/* Plain text, not a live region, as a field's count is everywhere. */}
                {count !== 'hidden' ? (
                  <Text style={[type.text.small, tabular, styles.count, { color: count === 'full' ? p.danger : p.muted }]}>{`${written.length}/${noteLength}`}</Text>
                ) : null}
              </View>
            ) : text !== '' ? <Animated.Text
              accessibilityRole="header"
              onLayout={(event) => setWordsHeight(event.nativeEvent.layout.height)}
              style={[wordsStyle, styles.words, { color: p.text, opacity: words, paddingHorizontal: horizontal },
                spec.kind === 'custom' ? { textTransform: 'none' } : {}]}
            >
              {text}
            </Animated.Text> : null}
            {field && written === '' && printed.length === 0 ? (
              <Presets quick={[labels.yes, labels.no, ...digits]} presets={note.presets} onPick={write} />
            ) : null}
            {!wordsOnly ? <Animated.View style={[styles.stage, { opacity: rise, transform: [{ scale }] }, hasWords ? { marginTop: card.wordsGap } : {}]}>
              {slots > 0 ? (
                <View style={[styles.grid, { gap, width: columns * cell + (columns - 1) * gap }]}>
                  {empty ? <Token size={size} /> : printed.map((c, i) => (
                    // The night and reminder leaves are the Storyteller's, as on the setup reveal.
                    <View key={`${c.id}-${i}`} style={[styles.cell, { width: cell }]}>
                      <Token character={c.id} name={c.name} size={size} printName={!captioned} markers={false} {...(spec.tint ? { alignment: spec.tint } : {})}
                        {...(editing && !note ? { accessibilityLabel: labels.takeOff(c.name), onPress: () => setPrinted((now) => now.filter((_, at) => at !== i)) } : {})} />
                      {/* A note's one token comes off by its own small cross, since the words above it are typed. */}
                      {field ? (
                        <View style={styles.tokenCross}>
                          <IconButton icon="close" label={labels.takeOff(c.name)} onPress={() => setPrinted([])} style={{ backgroundColor: p.feltRaised, borderRadius: touch / 2 }} />
                        </View>
                      ) : null}
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
          {!editing && (note || (takes > 0 && printed.length > 0)) ? (
            <View style={[styles.corner, { top: corner, right: space.md }]}>
              <Button variant="text" label={labels.change} onPress={() => {
                setLetters(true)
                setEditing(true)
              }} />
            </View>
          ) : null}
          {!editing ? <Hint shown={hint} label={labels.holdHint} bottom={insets.bottom + space.md} /> : null}
          {editing && !dock ? bar : null}
        </View>
        {dock ? <KeysDock side={side} reduced={reduced}>
          {bar}
          <View style={[styles.paper, side ? styles.paperSide : { maxHeight: window.height * card.keys.heightShare },
            { backgroundColor: p.parchment, borderColor: p.accent }]}>
            <PaperTexture />
            <ScrollView contentContainerStyle={[styles.keys, { paddingBottom: insets.bottom + space.lg, paddingRight: space.sm + (side ? insets.right : 0) }]}>
              <TokenKeys groups={keys} chosen={printed.map((c) => c.id)} full={!note && takes > 1 && printed.length >= takes} onPress={tapKey} />
            </ScrollView>
          </View>
        </KeysDock> : null}
        {ring ? <HoldRing key={ring.key} x={ring.x} y={ring.y} emptying={ring.emptying} reduced={reduced}
          onEmpty={() => setRing((r) => (r?.key === ring.key ? undefined : r))} /> : null}
      </div>
    </div>
  )
}

// The layer a node is drawn in: its ancestor right under the body, as a Modal's portal is.
const layerOf = (node: Element | null): Element | null => {
  let layer = node
  while (layer?.parentElement && layer.parentElement !== document.body) layer = layer.parentElement
  return layer
}

// The digits a note offers, for the many abilities that tell a number.
const digits = ['0', '1', '2', '3', '4', '5']

// A press on the bar or a preset would take the focus, and the device's keyboard with it, from
// the note being typed. Keyboard focus still moves as usual.
const KeepCaret = ({ style, children }: { readonly style?: object; readonly children: ReactNode }) => (
  <div onMouseDown={(event) => event.preventDefault()} style={{ display: 'flex', ...style }}>{children}</div>
)

// The two keyboards a note is typed from, one up at a time, as a switch of two.
const Keyboards = ({ letters, labels, onLetters }: { readonly letters: boolean; readonly labels: CardLabels; readonly onLetters: (letters: boolean) => void }) => (
  <View style={[styles.switch, { backgroundColor: palette.feltRaised }]}>
    <EdgeButton icon="letters" label={labels.letters} armed={letters} onPress={() => onLetters(true)} />
    <EdgeButton icon="token" label={labels.tokens} armed={!letters} onPress={() => onLetters(false)} />
  </View>
)

// The note's field drawn as the card's words: the same face, size and centring. A copy of its
// words underneath sets its height, since a text area does not grow with its text everywhere.
const NoteField = ({ inputRef, value, onChange, style, label, placeholder }: {
  readonly inputRef: RefObject<TextInputInstance | null>; readonly value: string; readonly onChange: (value: string) => void
  readonly style: TextStyle; readonly label: string; readonly placeholder: string
}) => {
  const focusVisible = useFocusVisible()
  const [focused, setFocused] = useState(false)
  return (
    <View>
      <Text aria-hidden style={[style, styles.words, styles.note, styles.mirror]}>{`${value || placeholder}${value.endsWith('\n') ? ' ' : ''}`}</Text>
      <TextInput ref={inputRef} value={value} onChangeText={onChange} multiline maxLength={noteLength}
        accessibilityLabel={label} placeholder={placeholder} placeholderTextColor={palette.muted}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={[StyleSheet.absoluteFill, style, styles.words, styles.note, styles.input, { color: palette.text },
          focusStyle(palette, focused && focusVisible)]} />
    </View>
  )
}

// What an empty note offers to write: Yes, No and the digits, then the kept notes and the
// script's own cards, one line each.
const Presets = ({ quick, presets, onPick }: { readonly quick: readonly string[]; readonly presets: readonly WrittenNote[]; readonly onPick: (note: WrittenNote) => void }) => (
  <KeepCaret style={{ flexDirection: 'column', alignItems: 'center', marginTop: card.wordsGap, gap: space.sm, paddingLeft: space.md, paddingRight: space.md }}>
    <View style={styles.quick}>
      {quick.map((words) => (
        <Preset key={words} label={words} onPress={() => onPick({ words })}>
          <Text style={[type.text.strong, { color: palette.text }]}>{words}</Text>
        </Preset>
      ))}
    </View>
    {presets.map((preset) => (
      <Preset key={`${preset.words}/${preset.character?.id ?? ''}`} wide label={[preset.words, preset.character?.name].filter(Boolean).join(', ')} onPress={() => onPick(preset)}>
        {preset.character ? <Token character={preset.character.id} size={tokenSize.corner} /> : null}
        <Text numberOfLines={1} style={[type.text.body, styles.presetWords, { color: palette.text }]}>{preset.words || preset.character?.name}</Text>
      </Preset>
    ))}
  </KeepCaret>
)

const Preset = ({ label, wide = false, onPress, children }: { readonly label: string; readonly wide?: boolean; readonly onPress: () => void; readonly children: ReactNode }) => {
  const focusVisible = useFocusVisible()
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={(state) => [styles.preset, wide ? styles.presetWide : null, { backgroundColor: palette.feltRaised },
        focusStyle(palette, isFocused(state) && focusVisible), { opacity: state.pressed ? motion.pressedOpacity : 1 }]}>
      {children}
    </Pressable>
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
  barEnd: { alignItems: 'center', gap: space.sm },
  switch: { flexDirection: 'row', borderRadius: radius.control },
  // A custom card's words keep the case they were written in.
  note: { textTransform: 'none' },
  mirror: { opacity: 0 },
  // The browser's own ring would draw on every tap; the field takes the app's ring from the keyboard.
  input: { paddingTop: 0, paddingBottom: 0, borderWidth: 0, outlineStyle: 'none', overflow: 'hidden', resize: 'none', borderRadius: radius.control } as object,
  count: { textAlign: 'center', marginTop: space.xs },
  tokenCross: { position: 'absolute', top: 0, right: 0 },
  quick: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
  preset: { minHeight: touch, minWidth: touch, paddingHorizontal: space.md, borderRadius: radius.control, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  presetWide: { justifyContent: 'flex-start', width: '100%', maxWidth: card.presetWidth },
  presetWords: { flexShrink: 1 },
})
