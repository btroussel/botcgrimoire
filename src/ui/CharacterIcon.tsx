// The art alone: a character's icon on whatever sits behind it, no disc, no shadow, no ring.
// One rule: the tint is the side the viewer is meant to see and nothing else says it, so this
// piece picks the good or the evil file, the single file for a Fabled or Loric, and the team's
// generic icon when a character has no art of its own. A homebrew character's embedded image
// counts as its own art. Whoever places it draws the rest.
import { memo, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { View } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'

import type { Alignment, HomebrewArt, Team } from '../content'
import { asCharacterId, character, homebrewArt, homebrewOf, homebrewVersion, subscribeHomebrew, teamSide } from '../content'
import type { CharacterArt } from '../content/generated/art'
import { characterArt } from '../content/generated/art'
import { durationFor, useReducedMotion } from './motion'
import { motion } from './theme'

// `own` is the side the character's team plays.
export type IconTint = Alignment | 'own'

export interface CharacterIconProps {
  readonly id: string // a character id; an id the content does not know draws its team's generic icon
  readonly size: number

  readonly tint?: IconTint // own when omitted
  readonly team?: Team // the fallback icon and the own tint; read from the content record when omitted
  readonly lazy?: boolean // long on-screen lists only; board tokens and printed sheets load eagerly
  readonly style?: StyleProp<ViewStyle>
}

export interface IconImage {
  readonly uri: string
}

const ownArt = (id: string): CharacterArt | HomebrewArt | undefined => {
  const bundled = characterArt[id]
  if (bundled) return bundled
  const h = homebrewOf(id)
  return h ? homebrewArt(h) : undefined
}

// The file to draw, or nothing when even the team has no generic icon (it always has one today).
export const artFor = (id: string, team: Team, tint: IconTint): IconImage | undefined => {
  const art = ownArt(id) ?? characterArt[team]
  if (!art) return undefined
  const side = tint === 'own' ? teamSide(team) : tint
  if (side === undefined) return art.single ?? art.good ?? art.evil
  return side === 'good' ? (art.good ?? art.single ?? art.evil) : (art.evil ?? art.single ?? art.good)
}

// A saved homebrew character can change its image under the same id, so the registry is read here.
export const useHomebrew = (): number => useSyncExternalStore(subscribeHomebrew, homebrewVersion, homebrewVersion)

export const CharacterIcon = memo(function CharacterIcon({ id, size, tint = 'own', team, lazy = false, style }: CharacterIconProps) {
  useHomebrew()
  const resolvedTeam = team ?? character(asCharacterId(id)).team
  const source = artFor(id, resolvedTeam, tint)
  const reduced = useReducedMotion()
  // The same character turning to its other side keeps the old art on top and fades it out, so the
  // change is seen; a different character just replaces the art, so lists never flicker.
  const [drawn, setDrawn] = useState({ id, source })
  const [leaving, setLeaving] = useState<IconImage | undefined>(undefined)
  if (drawn.id !== id || drawn.source !== source) {
    setLeaving(drawn.id === id ? drawn.source : undefined)
    setDrawn({ id, source })
  }
  const leavingImage = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const image = leavingImage.current
    if (!image) return
    const run = image.animate([{ opacity: 1 }, { opacity: 0 }],
      // An even curve: the house ease is nearly done in a third of the time, which reads as a snap here.
      { duration: durationFor(motion.duration.tint, reduced, true), easing: 'ease-in-out', fill: 'forwards' })
    run.onfinish = () => setLeaving(undefined)
    return () => run.cancel()
  }, [leaving, reduced])
  const box = { display: 'block', width: size, height: size, objectFit: 'contain' } as const
  return (
    <View style={[{ width: size, height: size }, null, style]} accessible={false}>
      {/* A browser image needs no loading state or background-image copy. Its box stays fixed while it decodes. */}
      {source !== undefined ? (
        <img src={source.uri} width={size} height={size} alt="" draggable={false} loading={lazy ? 'lazy' : 'eager'} decoding={lazy ? 'async' : 'sync'} style={box} />
      ) : null}
      {leaving !== undefined && leaving !== source ? (
        <img ref={leavingImage} src={leaving.uri} width={size} height={size} alt="" draggable={false} style={{ ...box, position: 'absolute', top: 0, left: 0 }} />
      ) : null}
    </View>
  )
})
