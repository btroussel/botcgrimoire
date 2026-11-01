import { createContext, memo, useContext, useId } from 'react'
import { StyleSheet, View } from 'react-native'
import type { ViewStyle } from 'react-native'
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg'

import type { BoardColour } from '../content'
import type { ArtSource } from './Art'
import { Art } from './Art'

// Static imports keep every colour in the offline bundle, including colours not yet selected.
export const velvetArt: Readonly<Record<BoardColour, ArtSource>> = {
  burgundy: require('../../assets/art/velvet/burgundy.webp'),
  forest: require('../../assets/art/velvet/forest.webp'),
  midnight: require('../../assets/art/velvet/midnight.webp'),
  plum: require('../../assets/art/velvet/plum.webp'),
}

export const VelvetColourContext = createContext<BoardColour>('burgundy')

export type Corner = 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft'

// Page backgrounds follow the saved colour; gold borders and corners belong to the game board.
export const PageVelvet = () => <Velvet colour={useContext(VelvetColourContext)} frame={false} />

// One piece of cloth stretches with the surface, with its frame behind every control. The
// surface names its free corners: half an ornament peeking around a plaque reads as a mistake.
export const Velvet = memo(function Velvet({ colour, frame = true, ornaments = [] }: {
  readonly colour: BoardColour
  readonly frame?: boolean
  readonly ornaments?: readonly Corner[]
}) {
  const gradientId = useId()
  return (
    <View style={[StyleSheet.absoluteFill, styles.surface]} pointerEvents="none" aria-hidden>
      <Art source={velvetArt[colour]} fit="fill" style={{ position: 'absolute', inset: 0 }} />
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="43%" rx="70%" ry="70%">
            <Stop offset="0.1" stopColor="#16080b" stopOpacity={0} />
            <Stop offset="0.63" stopColor="#16080b" stopOpacity={0.19} />
            <Stop offset="1" stopColor="#0c0409" stopOpacity={0.61} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
      <View style={styles.leather} />
      {frame && <View style={styles.brass} />}
      {frame && ornaments.map(corner => (
        <Svg key={corner} viewBox="0 0 60 60" width={38} height={38} style={[styles.corner, corners[corner]]} fill="none" color="#ac874e">
          <Path d="M4 55V4h51M8 45V8h37" stroke="currentColor" strokeWidth={1.5} />
          <Path d="M7 38C24 33 9 18 26 14C36 12 42 17 49 8M14 27C21 32 31 24 26 18C21 12 13 17 18 22M28 10C32 5 35 10 42 5M10 28C5 32 10 35 5 42" stroke="currentColor" strokeWidth={2} />
          <Path d="M9 9C12 8 18 9 18 12C17 15 12 17 10 21C11 14 5 15 9 9Z" fill="currentColor" />
          <Path d="M17 37Q15 29 20 29Q24 34 17 37M37 17Q29 15 29 20Q34 24 37 17" fill="currentColor" opacity={0.8} />
          <Circle cx={6} cy={6} r={2} fill="#e2bd78" />
        </Svg>
      ))}
    </View>
  )
})

const corners: Readonly<Record<Corner, ViewStyle>> = {
  topLeft: { top: 7, left: 7 },
  topRight: { top: 7, right: 7, transform: [{ rotate: '90deg' }] },
  bottomRight: { bottom: 7, right: 7, transform: [{ rotate: '180deg' }] },
  bottomLeft: { bottom: 7, left: 7, transform: [{ rotate: '270deg' }] },
}

const styles = StyleSheet.create({
  surface: { overflow: 'hidden', backgroundColor: '#211818' },
  leather: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderWidth: 5, borderColor: '#211818' },
  brass: { position: 'absolute', top: 6, right: 6, bottom: 6, left: 6, borderWidth: 1, borderColor: '#80663f' },
  corner: { position: 'absolute' },
})
