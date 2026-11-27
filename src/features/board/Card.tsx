// The info token turned to a player: large words on felt and character tokens where needed, or
// the tokens alone, as one block sized to the window. The token rises into place, the words
// follow a beat later, and a hold hands the phone back. While editing, the same card is its own
// preview above its keyboards, and only the shown card is turned to a player. Every card is
// changed in the same editor: its words are typed on the card itself, where the player will read
// them, and its tokens come from the token keys.
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
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
import { border, card, focusRing, font, gutter, hairline, motion, palette, radius, space, tabular, tokenSize, touch, type } from '../../ui/theme'
import type { Size } from '../../ui/theme'
import { Icon } from '../../ui/icons'
import { Token } from '../../ui/Token'
import type { TokenKey, TokenKeyGroup } from '../../ui/TokenKeys'
import { TokenKeys } from '../../ui/TokenKeys'
import { useViewport } from '../../ui/Viewport'
import { noteLength } from '../../store/settings'
import { captionExtra, cardTokens } from './cardLayout'
import { wholeWords } from './textWidth'

export interface CardLabels {
  readonly close: string // the editing card's cross, and the shown card's keyboard Close
  readonly holdHint: string // what a tap on the shown card says: hold to close
  readonly change: string
  readonly show: string
  readonly takeOff: (name: string) => string // a token on the editing card
  // The editor.
  readonly placeholder: string
  readonly message: string // the words' field, for a screen reader
  readonly keyboard: string // the switch between the two, for a screen reader
  readonly letters: string
  readonly tokens: string
  readonly keep: string // the star: keeps the note, and forgets it once kept
}

// The blank card as written: its words and the tokens under them, or the tokens alone.
export interface WrittenNote {
  readonly words: string
  readonly characters: readonly PrintedCharacter[]
}

// One of the official phrases the blank card offers: picking it brings up that card.
export interface CardPhrase {
  readonly key: string
  readonly label: string
  readonly onPick: () => void
}

// Which keyboard is up on the blank card. It opens with neither, so everything it offers is in
// view: a tap on the words raises the device's, and the switch raises the token keys.
type Up = 'none' | 'letters' | 'tokens'

export interface CardNote {
  readonly phrases: readonly CardPhrase[] // the info tokens about no seat
  readonly presets: readonly WrittenNote[] // the kept cards, then the script's own
  readonly kept: (note: WrittenNote) => boolean
  readonly onKeep: (note: WrittenNote) => void // keeps the note, or forgets it once kept
}

export interface CardProps {
  readonly spec: CardSpec
  readonly editing: boolean // it comes up to be filled rather than shown
  readonly takes: number // tokens it takes: a card of one shows on a key's tap
  readonly keys: readonly TokenKeyGroup[]
  readonly note: CardNote // what the blank card offers, and the star
  readonly onDismiss: () => void
  readonly labels: CardLabels
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

  // The tokens and the words typed live here while the card is up: showing records nothing,
  // and the cross drops whatever was typed.
  const [editing, setEditing] = useState(opensEditing)
  const [printed, setPrinted] = useState<readonly PrintedCharacter[]>(spec.characters ?? [])
  const [written, setWritten] = useState(spec.words)
  // The two keyboards share the foot: the device's for the words, the keys for the tokens. The
  // blank card starts with neither. A card that comes up waiting for its token starts with the keys.
  const [up, setUp] = useState<Up>(spec.words === '' && (spec.characters ?? []).length === 0 ? 'none' : 'tokens')
  const field = editing
  const dock = editing && up === 'tokens'
  const text = written
  // A card that takes a set number of tokens holds the first one's place with an empty disc, so
  // it previews. The blank card's tokens are optional, so it holds no place.
  const empty = editing && Number.isFinite(takes) && printed.length === 0
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
  const captionStyle = captioned ? wholeWords(printed.map((c) => c.name), cell, font.display.semibold, type.display.title) : undefined
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
  // token keys never stand up together. It is focused in a layout effect: React renders a tap's
  // update before the tap's event is over, and iOS raises its keyboard only for a focus made
  // during the tap. It also puts the focus in the dialog before the Modal's trap looks for some.
  const input = useRef<TextInputInstance>(null)
  const closeLabel = labels.close
  const root = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!field) return
    if (up === 'letters') input.current?.focus()
    else {
      input.current?.blur()
      // At rest the focus waits on the cross: left to the dialog's trap it would land in the
      // words, the first control in the card, and raise the device's keyboard unasked.
      if (up === 'none') root.current?.querySelector<HTMLElement>(`[role="button"][aria-label="${CSS.escape(closeLabel)}"]`)?.focus({ preventScroll: true })
    }
  }, [field, up, closeLabel])
  // Tokens, a key that shows the card, Show and Change each unmount the control that was pressed,
  // and the focus would fall to the page. It goes on to what comes next: the switch, the first
  // key, or the shown card's one Close.
  useLayoutEffect(() => {
    if (document.activeElement && document.activeElement !== document.body) return
    const find = (selector: string) => root.current?.querySelector<HTMLElement>(selector)
    const target = !editing ? find('[data-card-close] [role="button"]')
      : find('input[type="radio"]:checked') ?? find('input[type="radio"]')
    target?.focus({ preventScroll: true })
  }, [editing, dock])

  // Hold to close. The card is held screen out toward a player, so a stray thumb must not hand
  // them the grimoire: a tap only shows the hint, and a press held for `motion.duration.hold`
  // closes. A drift past the slop is a scroll and cancels quietly.
  const press = useRef<Press | undefined>(undefined)
  const [ring, setRing] = useState<{ readonly x: number; readonly y: number; readonly key: number; readonly emptying: boolean }>()
  const [hint, setHint] = useState(false)
  const hintTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [closing, setClosing] = useState(false)
  const faded = useRef(false)
  const lifted = useRef(false)
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const liftTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const latestDismiss = useRef(onDismiss)
  useLayoutEffect(() => { latestDismiss.current = onDismiss })

  // The card leaves only once the fade has run and the thumb's lift has passed. A touch's lift
  // sends its mouse events and click after pointerup, so the faded card stays over the board to
  // take them, until the click or `liftGuard`: gone sooner, they would press the seat or Undo
  // under the thumb.
  const leave = () => { if (faded.current && lifted.current) latestDismiss.current() }
  const close = () => {
    setClosing(true)
    lifted.current = !press.current
    fadeTimer.current = setTimeout(() => {
      faded.current = true
      leave()
    }, reduced ? 0 : motion.duration.cardClose)
  }
  const lift = () => {
    clearTimeout(liftTimer.current)
    lifted.current = true
    leave()
  }

  const showHint = () => {
    setHint(true)
    clearTimeout(hintTimer.current)
    hintTimer.current = setTimeout(() => setHint(false), motion.duration.holdHint)
  }
  useEffect(() => () => {
    clearTimeout(hintTimer.current)
    clearTimeout(fadeTimer.current)
    clearTimeout(liftTimer.current)
    clearTimeout(press.current?.timer)
  }, [])

  const release = (tapped: boolean) => {
    const held = press.current
    if (!held) return
    clearTimeout(held.timer)
    press.current = undefined
    if (closing) {
      liftTimer.current = setTimeout(lift, motion.duration.liftGuard)
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
    // A closing card takes no taps: the lift's own click ends its wait.
    onClickCapture: (event: MouseEvent<HTMLDivElement>) => {
      if (!closing) return
      event.preventDefault()
      event.stopPropagation()
      if (!press.current) lift()
    },
  }

  // A key's tap. A card of one token shows at once, so typing it is the whole step; a card of
  // several, the blank card among them, takes or gives back the key and waits for Show.
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
  const current: WrittenNote = { words: written.trim(), characters: printed }
  const filled = current.words !== '' || printed.length > 0
  const show = () => {
    if (!filled) return
    setWritten(current.words)
    setEditing(false)
  }
  // A preset is written, never shown: nothing reaches a player before Show. A homebrew card's
  // words have no limit, and a field's own limit does not cut a value set from code, so it is cut
  // here: what the star keeps then always reads back.
  const write = (preset: WrittenNote) => {
    setWritten(preset.words.slice(0, noteLength))
    setPrinted(preset.characters)
  }

  const horizontal = phone ? gutter.phone : gutter.tablet
  // A window wider than tall has no height to give the keys, so they stand on the right.
  const side = dock && window.width > window.height
  const corner = insets.top + space.md
  const count = field ? fieldCount(written.length, noteLength) : 'hidden'
  // One bar for every card: the two keyboards, the star, and Show.
  const bar = !editing ? null : (
    <View style={[styles.bar, { paddingHorizontal: horizontal }]}>
      <Keyboards up={up} labels={labels} onUp={setUp} />
      {/* Kept by a press that leaves the caret where it is. */}
      <KeepCaret style={styles.barEnd}>
        <EdgeButton icon="star" label={labels.keep} toggle armed={filled && note.kept(current)} disabled={!filled} onPress={() => note.onKeep(current)} />
        <Button variant="brass" label={labels.show} onPress={show} disabled={!filled} />
      </KeepCaret>
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
                {/* A tap on the words, or a Tab onto them, is for typing: the letters come up. */}
                <NoteField inputRef={input} value={written} onChange={setWritten} onFocus={() => setUp('letters')} style={wordsStyle} label={labels.message} placeholder={labels.placeholder} />
                {/* Plain text, not a live region, as a field's count is everywhere. */}
                {count !== 'hidden' ? (
                  <Text style={[type.text.small, tabular, styles.count, { color: count === 'full' ? p.danger : p.muted }]}>{`${written.length}/${noteLength}`}</Text>
                ) : null}
              </View>
            ) : text !== '' ? <Animated.Text
              accessibilityRole="header"
              onLayout={(event) => setWordsHeight(event.nativeEvent.layout.height)}
              style={[wordsStyle, styles.words, { color: p.text, opacity: words, paddingHorizontal: horizontal }]}
            >
              {text}
            </Animated.Text> : null}
            {field && written === '' && printed.length === 0 ? (
              <Presets phrases={note.phrases} presets={note.presets} onPick={write} />
            ) : null}
            {!wordsOnly ? <Animated.View style={[styles.stage, { opacity: rise, transform: [{ scale }] }, hasWords ? { marginTop: card.wordsGap } : {}]}>
              {slots > 0 ? (
                <View style={[styles.grid, { gap, width: columns * cell + (columns - 1) * gap }]}>
                  {empty ? <Token size={size} /> : printed.map((c, i) => (
                    // The night and reminder leaves are the Storyteller's, as on the setup reveal.
                    <View key={`${c.id}-${i}`} style={[styles.cell, { width: cell }]}>
                      <Token character={c.id} name={c.name} size={size} printName={!captioned} markers={false} {...(spec.tint ? { alignment: spec.tint } : {})}
 />
                      {/* On the blank card a token comes off by its own small cross, since the words above it are typed. */}
                      {field ? (
                        <View style={styles.tokenCross}>
                          <IconButton icon="close" label={labels.takeOff(c.name)} onPress={() => setPrinted((now) => now.filter((_, at) => at !== i))} style={{ backgroundColor: p.feltRaised, borderRadius: touch / 2 }} />
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
          {!editing ? (
            <View style={[styles.corner, { top: corner, right: space.md }]}>
              <Button variant="text" label={labels.change} onPress={() => {
                // Tokens alone go back to their keys, words to their caret.
                setUp(printed.length > 0 || Number.isFinite(takes) ? 'tokens' : 'letters')
                setEditing(true)
              }} />
            </View>
          ) : null}
          {!editing ? <Hint shown={hint} label={labels.holdHint} bottom={insets.bottom + space.md} /> : null}
          {/* Under the card it belongs to: above the keys at the foot, and beside them when they
              stand on the right, where the paper takes the whole height. */}
          {editing && (!dock || side) ? bar : null}
        </View>
        {dock ? <KeysDock side={side} reduced={reduced}>
          {side ? null : bar}
          <View style={[styles.paper, side ? styles.paperSide : { maxHeight: window.height * card.keys.heightShare },
            { backgroundColor: p.parchment, borderColor: p.accent }]}>
            <PaperTexture />
            <ScrollView contentContainerStyle={[styles.keys, side ? styles.keysSide : null,
              { paddingBottom: insets.bottom + space.lg, paddingRight: space.sm + (side ? insets.right : 0) }, side ? { paddingTop: insets.top + space.lg } : null]}>
              <div data-keys style={{ display: 'contents' }}><TokenKeys groups={keys} chosen={printed.map((c) => c.id)} full={takes > 1 && printed.length >= takes} onPress={tapKey} /></div>
            </ScrollView>
          </View>
        </KeysDock> : null}
        {ring ? <HoldRing key={ring.key} x={ring.x} y={ring.y} emptying={ring.emptying} reduced={reduced}
          onEmpty={() => setRing((r) => (r?.key === ring.key ? undefined : r))} /> : null}
      </div>
    </div>
  )
}

// A press on the bar or a preset would take the focus, and the device's keyboard with it, from
// the note being typed. Keyboard focus still moves as usual.
const KeepCaret = ({ style, children }: { readonly style?: object; readonly children: ReactNode }) => (
  <div onMouseDown={(event) => event.preventDefault()} style={{ display: 'flex', ...style }}>{children}</div>
)

// The two keyboards a note is typed from, one up at a time: native radios drawn as a switch of
// two, so the pair is one tab stop and the arrows move between them.
const Keyboards = ({ up, labels, onUp }: { readonly up: Up; readonly labels: CardLabels; readonly onUp: (up: Up) => void }) => {
  const name = useId()
  const focusVisible = useFocusVisible()
  const [focused, setFocused] = useState<Up>()
  return (
    <div role="radiogroup" aria-label={labels.keyboard} style={{ display: 'flex', borderRadius: radius.control, backgroundColor: palette.feltRaised }}>
      {([['letters', 'letters', labels.letters], ['tokens', 'token', labels.tokens]] as const).map(([on, icon, label]) => {
        const checked = up === on
        return (
          <label key={icon} title={label} style={{
            position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: touch, height: touch,
            boxSizing: 'border-box', cursor: 'pointer', borderRadius: radius.control, borderStyle: 'solid', borderWidth: border,
            borderColor: checked ? palette.accent : 'transparent',
            ...(focused === on && focusVisible ? { outline: `${focusRing.width}px solid ${palette.accent}`, outlineOffset: focusRing.offset } : {}),
          }}>
            <input type="radio" name={name} checked={checked} aria-label={label} onChange={() => onUp(on)}
              onFocus={() => setFocused(on)} onBlur={() => setFocused(undefined)} style={hiddenRadio} />
            <Icon name={icon} color={checked ? palette.accent : palette.text} />
          </label>
        )
      })}
    </div>
  )
}
const hiddenRadio = { position: 'absolute', width: 1, height: 1, opacity: 0, margin: 0 } as const

// The note's field drawn as the card's words: the same face, size and centring. A copy of its
// words underneath sets its height, since a text area does not grow with its text everywhere.
const NoteField = ({ inputRef, value, onChange, onFocus, style, label, placeholder }: {
  readonly inputRef: RefObject<TextInputInstance | null>; readonly value: string; readonly onChange: (value: string) => void
  readonly onFocus: () => void; readonly style: TextStyle; readonly label: string; readonly placeholder: string
}) => {
  const focusVisible = useFocusVisible()
  const [focused, setFocused] = useState(false)
  return (
    <View>
      <Text aria-hidden style={[style, styles.words, styles.mirror]}>{`${value || placeholder}${value.endsWith('\n') ? ' ' : ''}`}</Text>
      <TextInput ref={inputRef} value={value} onChangeText={onChange} multiline maxLength={noteLength}
        accessibilityLabel={label} placeholder={placeholder} placeholderTextColor={palette.muted}
        onFocus={() => {
          setFocused(true)
          onFocus()
        }} onBlur={() => setFocused(false)}
        style={[StyleSheet.absoluteFill, style, styles.words, styles.input, { color: palette.text },
          focusStyle(palette, focused && focusVisible)]} />
    </View>
  )
}

// What the empty blank card offers, one line each: the official phrases, which each bring up
// their own card, then the kept cards and the script's own, which are written onto this one.
const Presets = ({ phrases, presets, onPick }: { readonly phrases: readonly CardPhrase[]; readonly presets: readonly WrittenNote[]; readonly onPick: (note: WrittenNote) => void }) => (
  <KeepCaret style={{ flexDirection: 'column', alignItems: 'center', marginTop: card.wordsGap, gap: space.sm, paddingLeft: space.md, paddingRight: space.md }}>
    {phrases.map((phrase) => (
      <Preset key={phrase.key} wide label={phrase.label} onPress={phrase.onPick}>
        <Text numberOfLines={1} style={[type.text.strong, styles.presetWords, { color: palette.text }]}>{phrase.label}</Text>
      </Preset>
    ))}
    {presets.map((preset) => {
      const names = preset.characters.map((c) => c.name).join(', ')
      return (
        <Preset key={`${preset.words}/${preset.characters.map((c) => c.id).join()}`} wide label={[preset.words, names].filter(Boolean).join(', ')} onPress={() => onPick(preset)}>
          {preset.characters.map((c, i) => <Token key={`${c.id}-${i}`} character={c.id} size={tokenSize.corner} />)}
          <Text numberOfLines={1} style={[type.text.body, styles.presetWords, { color: palette.text }]}>{preset.words || names}</Text>
        </Preset>
      )
    })}
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
    <div data-card-close onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
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
  const { size, width, trackOpacity } = card.holdRing
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
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={palette.muted} strokeOpacity={trackOpacity} strokeWidth={width} />
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
  // Shown as written: an official phrase is written in capitals, so the editor shows what the
  // player will read.
  words: { textAlign: 'center' },
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
  // On the right the paper is a panel from the top edge to the foot, square, with the brass on
  // its one free edge. Its keys stand in the middle of a tall window, under the thumb, and from
  // the top once they need to scroll.
  paperSide: { flex: 1, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTopWidth: 0, borderRightWidth: 0 },
  keysSide: { flexGrow: 1, justifyContent: 'center' },
  // Narrow padding, so a 320 point phone still gets six keys across.
  keys: { paddingTop: space.lg, paddingLeft: space.sm },
  hint: { borderRadius: 999, paddingHorizontal: space.lg, paddingVertical: space.sm },
  barEnd: { alignItems: 'center', gap: space.sm },
  mirror: { opacity: 0 },
  // The browser's own ring would draw on every tap; the field takes the app's ring from the keyboard.
  input: { paddingTop: 0, paddingBottom: 0, borderWidth: 0, outlineStyle: 'none', overflow: 'hidden', resize: 'none', borderRadius: radius.control } as object,
  count: { textAlign: 'center', marginTop: space.xs },
  tokenCross: { position: 'absolute', top: 0, right: 0 },
  preset: { minHeight: touch, minWidth: touch, paddingHorizontal: space.md, borderRadius: radius.control, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  presetWide: { justifyContent: 'flex-start', width: '100%', maxWidth: card.presetWidth },
  presetWords: { flexShrink: 1 },
})
