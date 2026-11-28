// The card turned to a player: large words on felt and character tokens where needed, or the
// tokens alone, as one block sized to the window. There is one card and it is always its own
// editor, so what the Storyteller sees is what the player will: the words are typed on the card
// itself, the tokens come from the token keys, where a second tap takes one back off, and a tap on
// the felt puts the keyboards away before the device is turned round.
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { DragEvent, MouseEvent, ReactNode, RefObject } from 'react'
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native'
import type { TextInputInstance, TextStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import type { CardSpec, PrintedCharacter } from '../../ui/BoardInteraction'
import { IconButton, focusStyle, isFocused } from '../../ui/Button'
import { usePhone } from '../../ui/breakpoint'
import { fieldCount } from '../../ui/fieldCount'
import { useFocusVisible } from '../../ui/focus'
import { durationFor, useReducedMotion } from '../../ui/motion'
import { PaperTexture } from '../../ui/PaperTexture'
import { border, card, focusRing, font, gutter, hairline, motion, palette, radius, space, tabular, tokenSize, touch, type } from '../../ui/theme'
import type { Size } from '../../ui/theme'
import { Icon } from '../../ui/icons'
import { Token } from '../../ui/Token'
import type { TokenKey, TokenKeyGroup } from '../../ui/TokenKeys'
import { TokenKeys } from '../../ui/TokenKeys'
import { useViewport } from '../../ui/Viewport'
import { captionExtra, cardTokens } from './cardLayout'
import { wholeWords } from './textWidth'

// The longest words a card takes: more would not read across a table.
const noteLength = 250

export interface CardLabels {
  readonly close: string
  readonly placeholder: string
  readonly message: string // the words' field, for a screen reader
  readonly keyboard: string // the switch between the two, for a screen reader
  readonly letters: string
  readonly tokens: string
}

// A card as written: its words and the tokens under them, or the tokens alone.
export interface WrittenNote {
  readonly words: string
  readonly characters: readonly PrintedCharacter[]
}

// One line the empty card offers: an official phrase, or one of the script's own cards. Picking
// it only writes the card, which can still be changed.
export interface CardPreset {
  readonly label: string // the line as read: a phrase in sentence case, or a script card's words
  readonly official: boolean
  readonly note: WrittenNote
  readonly wantsToken?: boolean // a phrase about a character, so its keys come up with it
  readonly instead?: () => void // done in place of writing, where the card is not the place to fill it
}

// Which keyboard is up. The blank card opens with neither, so everything it offers is in view: a
// tap on the words raises the device's, and the switch or a tap on a token raises the token keys.
type Up = 'none' | 'letters' | 'tokens'

export interface CardProps {
  readonly spec: CardSpec // what the card comes up with
  readonly keys: readonly TokenKeyGroup[]
  readonly answers: readonly (readonly CardPreset[])[] // short answers a tap writes, a row each
  readonly presets: readonly CardPreset[]
  readonly onDismiss: () => void
  readonly labels: CardLabels
}

export const Card = ({ spec, keys, answers, presets, onDismiss, labels }: CardProps) => {
  const p = palette
  const insets = useSafeAreaInsets()
  const phone = usePhone()
  const window = useWindowDimensions()
  const viewport = useViewport()
  const reduced = useReducedMotion()

  // The tokens and the words live here while the card is up: showing records nothing, and the
  // cross drops whatever was typed.
  const [printed, setPrinted] = useState<readonly PrintedCharacter[]>(spec.characters)
  const [written, setWritten] = useState(spec.words)
  // The two keyboards share the foot: the device's for the words, the keys for the tokens. A card
  // that comes up with words still waiting for their token starts with the keys.
  const [up, setUp] = useState<Up>(spec.words !== '' && spec.characters.length === 0 ? 'tokens' : 'none')
  const dock = up === 'tokens'
  // An empty card at rest offers its phrases. They go as soon as a keyboard is up, so the card
  // is already the preview of what is about to be typed.
  const offered = written === '' && printed.length === 0 && up === 'none'
  // The placeholder asks for words only where words are the next step: on the card at rest, and
  // while the letters are up. A card of tokens alone never shows it to the player.
  const placeholder = offered || up === 'letters' ? labels.placeholder : ''
  const worded = written !== '' || placeholder !== ''
  // While the keys are up and nothing is typed from them, an empty disc holds the first token's place.
  const empty = dock && printed.length === 0
  const slots = empty ? 1 : printed.length
  const wordsOnly = slots === 0 && !spec.caption
  const numberOnly = wordsOnly && /^\d+$/.test(written.trim())
  const large = Math.min(window.width, window.height) >= card.largeWordsFrom
  const wordsStyle = numberOnly ? styles.number : written.length > 100 ? type.display.title : large ? type.display.heroLarge : type.display.hero

  // The words wrap differently in every locale, so the block is laid out from their measured
  // height, starting from one line until the first measure arrives under the token's rise.
  const [box, setBox] = useState<Size>({ width: window.width, height: window.height - insets.top - insets.bottom })
  const [wordsHeight, setWordsHeight] = useState<number>(wordsStyle.lineHeight ?? 0)
  const [belowHeight, setBelowHeight] = useState(0)
  const tokens = cardTokens({
    width: box.width, height: box.height, count: slots, roomy: !phone,
    words: wordsHeight, below: spec.caption ? belowHeight : 0,
  })
  const { size, columns, gap, captioned } = tokens
  const cell = captioned ? size + captionExtra : size
  const captionStyle = captioned ? wholeWords(printed.map((c) => c.name), cell, font.display.semibold, type.display.title) : undefined

  // The reveal, once as the card comes up: the tokens rise from scale 0.6 and no opacity. Under
  // reduced motion the rise is only the fade.
  const [rise] = useState(() => new Animated.Value(0))
  useEffect(() => {
    const run = Animated.timing(rise, { toValue: 1, duration: durationFor(motion.duration.reveal, reduced, true), easing: motion.ease, useNativeDriver: false })
    run.start()
    return () => run.stop()
  }, [reduced, rise])
  const scale = rise.interpolate({ inputRange: [0, 1], outputRange: reduced ? [1, 1] : [0.6, 1] })

  // The caret comes with the letters and leaves with them, so the device's keyboard and the
  // token keys never stand up together. It is focused in a layout effect: React renders a tap's
  // update before the tap's event is over, and iOS raises its keyboard only for a focus made
  // during the tap. As the card comes up the dialog's own trap takes the focus to the cross, the
  // first control in the card, so the words never take it and raise the device's keyboard unasked.
  const input = useRef<TextInputInstance>(null)
  const root = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (up === 'letters') input.current?.focus()
    else input.current?.blur()
  }, [up])
  // A picked preset and the keys put away each unmount the control that had the focus, which
  // would fall to the page. It goes on to the switch. Not as the card comes up: the dialog must
  // first note what opened it, to hand the focus back on closing.
  const cameUp = useRef(false)
  useLayoutEffect(() => {
    if (!cameUp.current) {
      cameUp.current = true
      return
    }
    if (document.activeElement && document.activeElement !== document.body) return
    const find = (selector: string) => root.current?.querySelector<HTMLElement>(selector)
    const target = find('input[type="radio"]:checked') ?? find('input[type="radio"]')
    target?.focus({ preventScroll: true })
  }, [dock, offered])

  // A key's tap takes the token, or gives it back.
  const tapKey = (key: TokenKey) => {
    setPrinted((now) => now.some((c) => c.id === key.id) ? now.filter((c) => c.id !== key.id) : [...now, { id: key.id, name: key.name }])
  }
  // A tap on the felt around the card puts the keyboards away and nothing else: the card in front
  // of the Storyteller is already what the player sees. A tap on one of its tokens brings up
  // their keys. The press must begin on the felt too: a press on the words raises the letters,
  // which moves the card under the finger, and the lift would then land on the felt and put them
  // away again. So what the press began on is kept until its click has passed.
  const pressed = useRef<Element | null>(null)
  const onFelt = (target: EventTarget | null) => target instanceof Element
    && !target.closest('button, [role="button"], input, textarea, label, a, [data-card-bar], [data-card-keys]')
  const tapFelt = (event: MouseEvent<HTMLDivElement>) => {
    const began = pressed.current
    pressed.current = null
    if (!onFelt(began) || !onFelt(event.target)) return
    setUp((event.target as Element).closest('[data-card-token]') ? 'tokens' : 'none')
  }
  // The words can lose the caret without a tap on the card: the device's own Done key, or a Tab
  // away. The letters are then no longer up, so the switch must not say they are. A press on
  // the switch is left to the switch, which would otherwise see them closed and open them again.
  const lettersLeft = () => {
    if (pressed.current?.closest('[data-card-bar]') || !document.hasFocus()) return
    setUp((now) => (now === 'letters' ? 'none' : now))
  }
  // A homebrew card's words have no limit, and a field's own limit does not cut a value set from
  // code, so it is cut here.
  const pick = (preset: CardPreset) => {
    if (preset.instead) {
      preset.instead()
      return
    }
    setWritten(preset.note.words.slice(0, noteLength))
    setPrinted(preset.note.characters)
    if (preset.wantsToken) setUp('tokens')
  }

  const horizontal = phone ? gutter.phone : gutter.tablet
  // A window wider than tall has no height to give the keys, so they stand on the right.
  const side = dock && window.width > window.height
  const count = fieldCount(written.length, noteLength)
  // The card follows the visible viewport, so with the device's keyboard up the note and its bar
  // stay above it, as a sheet's fields do.
  const frame = viewport.width > 0
    ? { position: 'absolute', top: viewport.top, left: viewport.left, width: viewport.width, height: viewport.height } as const
    : { position: 'relative', flex: 1 } as const
  return (
    // The felt reaches behind the device's keyboard, under the card that stays above it.
    <div style={{ flex: 1, position: 'relative', backgroundColor: p.felt }}>
      {/* A long press on a phone would start a drag of the art. */}
      <div ref={root} onPointerDown={(event) => { pressed.current = event.target instanceof Element ? event.target : null }} onClick={tapFelt} onDragStart={(event: DragEvent<HTMLDivElement>) => event.preventDefault()}
        style={{ ...frame, display: 'flex', flexDirection: side ? 'row' : 'column', minHeight: 0, backgroundColor: p.felt }}>
        <View style={[styles.root, { paddingTop: insets.top, paddingBottom: dock && !side ? 0 : insets.bottom }]}>
          {/* Leaves the card; a tap is enough, since nothing on it is kept. First in the card, so
              the focus lands here as it comes up. */}
          <View style={[styles.corner, { top: insets.top + space.md, left: space.md }]}>
            <IconButton icon="close" label={labels.close} onPress={onDismiss} />
          </View>
          <ScrollView
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout
              setBox((b) => (b.width === width && b.height === height ? b : { width, height }))
            }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            <View onLayout={(event) => setWordsHeight(event.nativeEvent.layout.height)} style={{ paddingHorizontal: horizontal }}>
              {/* A tap on the words, or a Tab onto them, is for typing: the letters come up. */}
              <NoteField inputRef={input} value={written} onChange={setWritten} onFocus={() => setUp('letters')} onBlur={lettersLeft} style={wordsStyle} label={labels.message} placeholder={placeholder} />
              {/* Plain text, not a live region, as a field's count is everywhere. Only while the
                  words are being typed: the player never reads it. */}
              {up === 'letters' && count !== 'hidden' ? (
                <Text style={[type.text.small, tabular, styles.count, { color: count === 'full' ? p.danger : p.muted }]}>{`${written.length}/${noteLength}`}</Text>
              ) : null}
            </View>
            {offered ? <Presets answers={answers} presets={presets} onPick={pick} /> : null}
            {!wordsOnly ? <Animated.View style={[styles.stage, { opacity: rise, transform: [{ scale }] }, worded ? { marginTop: card.wordsGap } : null]}>
              {slots > 0 ? (
                <div data-card-tokens style={{ display: 'contents' }}><View style={[styles.grid, { gap, width: columns * cell + (columns - 1) * gap }]}>
                  {empty ? <div data-card-token style={{ display: 'contents' }}><Token size={size} /></div> : printed.map((c, i) => (
                    // The night and reminder leaves are the Storyteller's, as on the setup reveal.
                    <div key={`${c.id}-${i}`} data-card-token style={{ display: 'contents' }}>
                      <View style={[styles.cell, { width: cell }]}>
                        <Token character={c.id} name={c.name} size={size} printName={!captioned} markers={false} {...(spec.tint ? { alignment: spec.tint } : {})} />
                        {captioned ? (
                          <Text style={[type.display.title, styles.caption, captionStyle, { color: p.text }]} numberOfLines={card.captionLines}>
                            {c.name}
                          </Text>
                        ) : null}
                      </View>
                    </div>
                  ))}
                </View></div>
              ) : null}
              {spec.caption ? (
                <Text
                  onLayout={(event) => setBelowHeight(event.nativeEvent.layout.height)}
                  // Who the card is about is half of what it says, so the name is set as large as the words.
                  style={[large ? type.display.heroLarge : type.display.hero, styles.caption, { color: p.text, paddingHorizontal: horizontal, marginTop: card.captionGap }]}
                >
                  {spec.caption}
                </Text>
              ) : null}
            </Animated.View> : null}
          </ScrollView>
          {/* Under the card it belongs to: above the keys at the foot, and beside them when they
              stand on the right, where the paper takes the whole height. Drawn in this one place,
              so the switch keeps the focus as the keys come and go. */}
          <div data-card-bar style={{ display: 'contents' }}>
            <View style={[styles.bar, { paddingHorizontal: horizontal }]}>
              <Keyboards up={up} labels={labels} onUp={setUp} />
            </View>
          </div>
        </View>
        {dock ? <div data-card-keys style={{ display: 'contents' }}><KeysDock side={side} reduced={reduced}>
          <View style={[styles.paper, side ? styles.paperSide : { maxHeight: window.height * card.keys.heightShare },
            { backgroundColor: p.parchment, borderColor: p.accent }]}>
            <PaperTexture />
            <ScrollView contentContainerStyle={[styles.keys, side ? styles.keysSide : null,
              { paddingBottom: insets.bottom + space.lg, paddingRight: space.lg + (side ? insets.right : 0) }, side ? { paddingTop: insets.top + space.lg } : null]}>
              <div data-keys style={{ display: 'contents' }}><TokenKeys groups={keys} chosen={printed.map((c) => c.id)} onPress={tapKey} /></div>
            </ScrollView>
          </View>
        </KeysDock></div> : null}
      </div>
    </div>
  )
}

// The two keyboards a note is typed from, one up at a time: native radios drawn as a switch of
// two, so the pair is one tab stop and the arrows move between them. A checked radio fires no
// change, so a second press on the one that is up is caught as a click and puts it away. From a
// keyboard a checked radio sends no click either, so its Space and Enter are read as keys.
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
            <input type="radio" name={name} checked={checked} aria-label={label} onChange={() => onUp(on)} onClick={() => { if (checked) onUp('none') }}
              onKeyDown={(event) => {
                if (!checked || (event.key !== ' ' && event.key !== 'Enter')) return
                event.preventDefault()
                onUp('none')
              }}
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
const NoteField = ({ inputRef, value, onChange, onFocus, onBlur, style, label, placeholder }: {
  readonly inputRef: RefObject<TextInputInstance | null>; readonly value: string; readonly onChange: (value: string) => void
  readonly onFocus: () => void; readonly onBlur: () => void; readonly style: TextStyle; readonly label: string; readonly placeholder: string
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
        }} onBlur={() => {
          setFocused(false)
          onBlur()
        }}
        style={[StyleSheet.absoluteFill, style, styles.words, styles.input, { color: palette.text },
          focusStyle(palette, focused && focusVisible)]} />
    </View>
  )
}

// What the empty card offers. First the short answers, a row of keys each. Then, one line each,
// the official phrases, as words alone so they line up, and the script's own cards, each behind
// its character's token.
const Presets = ({ answers, presets, onPick }: {
  readonly answers: readonly (readonly CardPreset[])[]; readonly presets: readonly CardPreset[]; readonly onPick: (preset: CardPreset) => void
}) => (
  <View style={styles.offers}>
    {answers.map((row, at) => (
      <View key={at} style={styles.answers}>
        {row.map((answer) => (
          <Preset key={answer.label} label={answer.label} short onPress={() => onPick(answer)}>
            <Text numberOfLines={1} style={[type.text.strong, tabular, { color: palette.text }]}>{answer.label}</Text>
          </Preset>
        ))}
      </View>
    ))}
    {presets.map((preset) => {
      const tokens = preset.official ? [] : preset.note.characters
      return (
        <Preset key={`${preset.label}/${tokens.map((c) => c.id).join()}`} label={[preset.label, ...tokens.map((c) => c.name)].join(', ')} onPress={() => onPick(preset)}>
          {tokens.map((c, i) => <Token key={`${c.id}-${i}`} character={c.id} size={tokenSize.corner} />)}
          <Text numberOfLines={1} style={[preset.official ? type.text.strong : type.text.body, styles.presetWords, { color: palette.text }]}>{preset.label}</Text>
        </Preset>
      )
    })}
  </View>
)

const Preset = ({ label, short = false, onPress, children }: { readonly label: string; readonly short?: boolean; readonly onPress: () => void; readonly children: ReactNode }) => {
  const focusVisible = useFocusVisible()
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={(state) => [short ? styles.answer : styles.preset, { backgroundColor: palette.feltRaised },
        focusStyle(palette, isFocused(state) && focusVisible), { opacity: state.pressed ? motion.pressedOpacity : 1 }]}>
      {children}
    </Pressable>
  )
}

// The keys come up from the foot, or in from the side, as a device's keyboard does.
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

const styles = StyleSheet.create({
  root: { flex: 1 },
  // The block centres in the card and scrolls once it cannot fit; the margins keep the corner
  // for the cross.
  content: { flexGrow: 1, justifyContent: 'center', paddingTop: card.margin, paddingBottom: card.foot },
  // Shown as written: an official phrase is written in capitals, as its printed token is.
  words: { textAlign: 'center' },
  number: { ...type.text.tally, fontSize: 96, lineHeight: 112 },
  stage: { alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start' },
  cell: { alignItems: 'center', gap: space.md },
  caption: { textAlign: 'center' },
  corner: { position: 'absolute', zIndex: 1 },
  offers: { alignItems: 'center', marginTop: card.wordsGap, gap: space.sm, paddingHorizontal: space.md },
  // The bar sits on the felt over the keys.
  bar: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm },
  dockFoot: { flexShrink: 0 },
  // The keys lie on the sheet's paper, its top corners and brass edge, where a keyboard lives.
  paper: { overflow: 'hidden', borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet,
    borderWidth: hairline, borderBottomWidth: 0 },
  // On the right the paper is a panel from the top edge to the foot, square, with the brass on
  // its one free edge. Its keys stand in the middle of a tall window, under the thumb, and from
  // the top once they need to scroll.
  paperSide: { flex: 1, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTopWidth: 0, borderRightWidth: 0 },
  keysSide: { flexGrow: 1, justifyContent: 'center' },
  // The same side margins as a drawer's keys, so a script stands in the same columns in both.
  keys: { paddingTop: space.lg, paddingLeft: space.lg },
  mirror: { opacity: 0 },
  // The browser's own ring would draw on every tap; the field takes the app's ring from the keyboard.
  input: { paddingTop: 0, paddingBottom: 0, borderWidth: 0, outlineStyle: 'none', overflow: 'hidden', resize: 'none', borderRadius: radius.control } as object,
  count: { textAlign: 'center', marginTop: space.xs },
  preset: { minHeight: touch, minWidth: touch, width: '100%', maxWidth: card.presetWidth, paddingHorizontal: space.md, borderRadius: radius.control,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: space.sm },
  presetWords: { flexShrink: 1 },
  // A row of answers runs the width of a line, its keys sharing it equally.
  answers: { flexDirection: 'row', gap: space.sm, width: '100%', maxWidth: card.presetWidth },
  answer: { flex: 1, minHeight: touch, minWidth: 0, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
})
