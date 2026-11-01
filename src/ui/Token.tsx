// A character's circle: the art on the parchment disc at any size, and once the disc is at least
// `show` the name printed on an arc along its lower rim, the way the physical piece is printed.
// One rule: alignment is the tint of the art and nothing else, no badge, no second mark; the one
// ring a token can wear is the brass selected ring, which is about the tap and not the seat.
// Seats also print the name at board size; small reference chips keep only the art.
import { memo, useId, useLayoutEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { StyleProp, TextInstance, ViewStyle } from 'react-native'
import Svg, { Defs, Path, Text as SvgText, TextPath } from 'react-native-svg'

import type { Alignment } from '../content'
import { asCharacterId, character } from '../content'
import { tokenArt } from '../content/generated/art'
import { Art } from './Art'
import { focusStyle, isFocused } from './Button'
import { CharacterIcon, useHomebrew } from './CharacterIcon'
import { domElement, useFocusVisible } from './focus'
import { Icon } from './icons'
import { durationFor, useReducedMotion } from './motion'
import { SelectedRing } from './SeatMarks'
import { TokenDisc } from './TokenDisc'
import { border, font, motion, palette, printedName, tokenMaterial, tokenSize, type } from './theme'

export interface TokenProps {
  readonly size: number // one of tokenSize, or the board's computed size
  readonly character?: string // the character id; an empty seat when omitted
  readonly alignment?: Alignment // the tint; the team's own side when omitted
  readonly name?: string // printed at show size and above; the content's name when omitted
  readonly printName?: boolean // print the name even below show size
  readonly ability?: string // full text inside a large reference token
  readonly markers?: boolean // printed setup, wake and reminder counts; omitted on a player reveal
  readonly selected?: boolean // the brass ring
  readonly dim?: boolean // keep the token readable while drawing attention elsewhere
  readonly dead?: boolean // the disc fades toward grey; a seat passes it always so the face never remounts
  readonly disabled?: boolean
  readonly emptyStyle?: StyleProp<ViewStyle> // a recessed slot can override the empty disc's dashed outline
  readonly add?: boolean // the empty circle with a plus: the add-seat gap marker
  readonly onPress?: () => void
  readonly onLongPress?: () => void
  readonly accessibilityLabel?: string
  readonly style?: StyleProp<ViewStyle>
}

// Cropped icons need an explicit gap from the disc rim.
const artShare = 0.66
// The printed name's baseline sits inside the rim's ornament and over the art's foot, and the
// arc stops this far below the horizontal on each side so the name stays on the lower rim.
const arc = { radius: 0.4, endDegrees: 22 } as const
// Grenze's average uppercase advance in ems: enough to tell when a long name will not fit the
// arc and must print smaller.
const glyphAdvance = 0.62
// A disc is a physical piece: pressed, it gives under the finger rather than fading.
const pressedScale = 0.96

export const Token = ({ size, character: id, alignment, name, printName, ability, markers: showMarkers = true, selected, dim, dead, disabled = false, emptyStyle, add, onPress, onLongPress, accessibilityLabel, style }: TokenProps) => {
  const p = palette
  const focusVisible = useFocusVisible()
  const reduced = useReducedMotion()
  const box = { width: size, height: size, borderRadius: size / 2 }
  const drawn = <TokenFace size={size} named={printName || size >= tokenSize.show} showMarkers={showMarkers}
    {...(id !== undefined ? { id } : {})} {...(alignment ? { alignment } : {})} {...(name !== undefined ? { name } : {})}
    {...(ability !== undefined ? { ability } : {})}
    {...(emptyStyle !== undefined ? { emptyStyle } : {})} {...(add ? { add } : {})} />
  // The fade sits on the face alone, so a dead voter's brass ring and focus outline keep their colour.
  const face = dead === undefined ? drawn : <div style={{ ...box, filter: dead ? tokenMaterial.dead : 'none',
    transition: `filter ${durationFor(motion.duration.tint, reduced, true)}ms ease-in-out` }}>{drawn}</div>

  const ringMark = selected ? <SelectedRing size={size} /> : null
  const dimStyle = dim ? { opacity: motion.dimOpacity } : null

  if (!onPress && !onLongPress) {
    return (
      <View style={[styles.box, box, dimStyle, style]} accessibilityLabel={accessibilityLabel}>
        {face}
        {ringMark}
      </View>
    )
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      aria-pressed={selected}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      style={(state) => [
        styles.box,
        box,
        focusStyle(p, !disabled && isFocused(state) && focusVisible),
        { transform: [{ scale: !disabled && state.pressed ? pressedScale : 1 }] },
        dimStyle,
        style,
      ]}
    >
      {face}
      {ringMark}
    </Pressable>
  )
}

interface TokenFaceProps {
  readonly size: number
  readonly id?: string
  readonly alignment?: Alignment
  readonly name?: string
  readonly named: boolean // the name printed on the rim
  readonly showMarkers: boolean
  readonly ability?: string
  readonly emptyStyle?: StyleProp<ViewStyle>
  readonly add?: boolean
}

// The face depends only on these values, so a token redrawn for its ring, its press or its
// dimming leaves the art, the markers and the printed name alone.
const TokenFace = memo(function TokenFace({ size, id, alignment, name, named, showMarkers, ability, emptyStyle, add }: TokenFaceProps) {
  const p = palette
  useHomebrew()
  const record = id !== undefined ? character(asCharacterId(id)) : undefined
  const longAbility = (ability?.length ?? 0) > 180
  const abilityKey = String(size) + ':' + (ability ?? '')
  const abilityText = useRef<TextInstance>(null)
  const [measuredAbility, setMeasuredAbility] = useState({ key: '', height: 0 })
  useLayoutEffect(() => {
    const element = domElement(abilityText.current)
    if (!element) return
    // Measure before the first paint; the flip's transform must not affect the text height.
    const height = element.offsetHeight
    setMeasuredAbility(previous => previous.key === abilityKey && previous.height === height ? previous : { key: abilityKey, height })
  }, [abilityKey])
  // Reserve the text gap and lower name band explicitly; the icon has no outer padding.
  const abilityArtTop = measuredAbility.key === abilityKey
    ? 0.18 + measuredAbility.height / size
    : longAbility ? 0.48 : 0.33
  const abilityArtSize = Math.max(0, Math.min(0.50, 0.76 - abilityArtTop))
  const box = { width: size, height: size, borderRadius: size / 2 }
  const disc = tokenArt.character_bg
  const markers = record ? [
    ...(record.ordinals.first ? ['firstnight'] : []),
    ...(record.ordinals.other ? ['othernight'] : []),
    ...(record.setupFlag ? ['setup'] : []),
    ...(record.reminders.length ? [`count_${Math.min(7, record.reminders.reduce((sum, reminder) => sum + reminder.count, 0))}`] : []),
  ] : []

  return id !== undefined && record ? (
    <TokenDisc size={size}>
      {disc !== undefined ? <img src={disc.uri} alt="" draggable={false} decoding="sync" width={size} height={size} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
      {named && showMarkers ? markers.map(marker => tokenArt[marker] ? <Art key={marker} source={tokenArt[marker]} style={{ position: 'absolute', inset: 0 }} /> : null) : null}

      <View style={[styles.centre, ability ? { justifyContent: 'flex-start', paddingTop: size * abilityArtTop } : named ? { transform: [{ translateY: -size * 0.035 }] } : null]}>
        <CharacterIcon id={id} team={record.team} size={size * (ability ? abilityArtSize : named ? 0.64 : artShare)} {...(alignment ? { tint: alignment } : {})} />
      </View>
      {ability ? <View style={{ position: 'absolute', top: size * 0.14, left: size * 0.15, width: size * 0.70 }}>
        <Text ref={abilityText} style={[type.text.small, { color: p.ink, textAlign: 'center', fontSize: size * (longAbility ? 0.039 : 0.047), lineHeight: size * (longAbility ? 0.046 : 0.055) }]}>{ability}</Text>
      </View> : null}
      {named ? <PrintedName name={name ?? record.name} size={size} color={p.ink} {...(ability ? { outline: p.text } : {})} /> : null}
    </TokenDisc>
  ) : (
    <View style={[styles.empty, box, { borderColor: p.muted }, emptyStyle]}>
      {add ? <Icon name="add" color={p.muted} /> : null}
    </View>
  )
})

// The name on an SVG arc along the lower rim, read left to right with the letters' tops toward
// the centre, as printed. A name too long for the arc prints smaller rather than spilling.
export const PrintedName = memo(function PrintedName({ name, size, color, outline, fontSize }: { readonly name: string; readonly size: number; readonly color: string; readonly outline?: string; readonly fontSize?: number }) {
  // useId's punctuation is legal in an href but not worth testing in every browser.
  const pathId = `arc${useId().replace(/[^A-Za-z0-9_-]/g, '')}`
  const printed = printedName(size)
  const centre = size / 2
  const r = size * arc.radius
  const a = (arc.endDegrees * Math.PI) / 180
  const y = centre + r * Math.sin(a)
  const x0 = centre - r * Math.cos(a)
  const x1 = centre + r * Math.cos(a)
  // Sweep flag 0 runs counter-clockwise on screen, from the left end down through the bottom.
  const d = `M ${x0} ${y} A ${r} ${r} 0 0 0 ${x1} ${y}`

  const text = name.toUpperCase()
  const glyphs = Array.from(text).length
  const baseSize = fontSize ?? printed.fontSize ?? 0
  const baseSpacing = printed.letterSpacing ?? 0
  const capacity = r * (Math.PI - 2 * a)
  const estimate = glyphs * baseSize * glyphAdvance + Math.max(0, glyphs - 1) * baseSpacing
  const fit = estimate > capacity ? capacity / estimate : 1

  return (
    <Svg width={size} height={size} style={styles.fill} pointerEvents="none" aria-hidden>
      <Defs>
        <Path id={pathId} d={d} />
      </Defs>
      {outline ? <SvgText fill="none" stroke={outline} strokeWidth={size * 0.013} strokeLinejoin="round" fontFamily={printed.fontFamily ?? font.display.bold} fontSize={baseSize * fit} letterSpacing={baseSpacing * fit} textAnchor="middle">
        <TextPath href={`#${pathId}`} startOffset="50%">{text}</TextPath>
      </SvgText> : null}
      <SvgText fill={color} fontFamily={printed.fontFamily ?? font.display.bold} fontSize={baseSize * fit} letterSpacing={baseSpacing * fit} textAnchor="middle">
        <TextPath href={`#${pathId}`} startOffset="50%">
          {text}
        </TextPath>
      </SvgText>
    </Svg>
  )
})

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  centre: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  empty: { borderWidth: border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
})
