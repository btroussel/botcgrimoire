// Naming the winner. No paper here: the table goes almost dark and the two sides sit on it as
// tokens, so the choice is made the way a seat is tapped and leads into the result on the velvet.
// The tap records the result, and what plays after it is only the way out. The tokens are dealt
// from the middle as at the deal; chosen, the loser greys as a dead token does and the winner
// glides to where the words of the win rise, then gives way to them.
import { useLayoutEffect, useRef, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import type { Translate } from '../../content'
import { IconButton, focusStyle, isFocused, isHovered } from '../../ui/Button'
import { useFocusVisible } from '../../ui/focus'
import { durationFor, useReducedMotion } from '../../ui/motion'
import { font, hairline, layout, motion, palette, radius, scrim, shadows, space, tokenMaterial, touch, type } from '../../ui/theme'
import type { Size } from '../../ui/theme'
import { Token, pressedScale } from '../../ui/Token'

type Winner = 'good' | 'evil'
const sides = ['good', 'evil'] as const
const colour = { good: palette.goodOnFelt, evil: palette.evilOnFelt } as const
// Two of them fit side by side on a 320 point phone.
const tokenAtMost = 128
// The title between its rules, the gap under it and a label on two lines: what a short window,
// a phone on its side, must leave to the token.
const wordsRoom = 150

export const EndGame = ({ visible, t, window, onClose, onEnd }: {
  readonly visible: boolean
  readonly t: Translate
  readonly window: Size
  readonly onClose: () => void
  readonly onEnd: (winner: Winner) => void
}) => {
  const insets = useSafeAreaInsets()
  const reduced = useReducedMotion()
  const focusVisible = useFocusVisible()
  const stage = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(visible)
  const [picked, setPicked] = useState<Winner>()
  if (visible && !mounted) {
    setMounted(true)
    setPicked(undefined)
  }
  const width = Math.min(layout.dialogWidth, window.width - insets.left - insets.right - 2 * space.lg)
  const size = Math.max(touch, Math.min(tokenAtMost, width / 2 - space.lg, window.height - insets.top - insets.bottom - 2 * space.lg - wordsRoom))

  useLayoutEffect(() => {
    const root = stage.current
    if (!mounted || !root) return
    const d = motion.duration
    const parts = (name: string) => Array.from(root.querySelectorAll<HTMLElement>(`[data-part="${name}"]`))
    // Reduced motion keeps only the fade of each step.
    const play = (nodes: readonly HTMLElement[], from: Keyframe, to: Keyframe, ms: number,
      { delay = 0, easing = motion.css.ease, fill = 'backwards' }: { readonly delay?: number; readonly easing?: string; readonly fill?: FillMode } = {}) =>
      nodes.flatMap(node => node.animate?.(reduced ? [{ opacity: from.opacity ?? 1 }, { opacity: to.opacity ?? 1 }] : [from, to],
        { duration: durationFor(ms, reduced, true), delay: durationFor(delay, reduced), easing, fill }) ?? [])
    const leave = { easing: motion.css.easeIn, fill: 'forwards' } as const
    const here = { opacity: 1, transform: 'none' }
    const gone = { opacity: 0 }
    // Each token's place is a quarter of the width from the middle.
    const toMiddle = (side: Winner) => (side === 'good' ? 1 : -1) * width / 4

    let runs: Animation[]
    if (visible) {
      runs = [
        ...play(parts('veil'), gone, here, d.mark),
        ...play(parts('rule'), { opacity: 0, transform: 'scaleX(0)' }, here, d.sheetIn),
        ...play(parts('title'), gone, here, d.revealWords),
        ...sides.flatMap((side, i) => play(parts(`token-${side}`), { opacity: 0, transform: `translateX(${toMiddle(side)}px) scale(0.6)` }, here,
          d.deal, { delay: i * d.dealStagger })),
        ...play(parts('label'), gone, here, d.revealWords, { delay: d.revealWordsDelay }),
      ]
    } else if (picked) {
      const token = parts(`token-${picked}`)[0]
      // The result is on the board by now, so the winner is sent to its words, or to the middle
      // of the window if they have no room to show.
      const from = token?.getBoundingClientRect()
      const words = document.querySelector('[data-win-words]')?.getBoundingClientRect()
      const at = from && words
        ? `translate(${words.x + words.width / 2 - from.x - from.width / 2}px, ${words.y + words.height / 2 - from.y - from.height / 2}px)`
        : `translateX(${toMiddle(picked)}px)`
      // The words start to rise as the glide ends, and the dark lifts with the token over them.
      const glide = d.winWordsDelay
      const whole = glide + d.tint
      runs = [
        ...play([...parts('title'), ...parts('rule'), ...parts('label')], here, gone, d.fade, leave),
        ...play(parts(`token-${picked === 'good' ? 'evil' : 'good'}`), { ...here, filter: 'none' },
          { opacity: 0, transform: 'scale(0.9)', filter: tokenMaterial.dead }, d.tint, leave),
        ...play(parts(`halo-${picked}`), gone, { opacity: 1 }, glide, { fill: 'forwards' }),
        ...play(parts('veil'), here, gone, d.tint, { ...leave, delay: glide }),
      ]
      const winner = token?.animate?.(reduced ? [{ opacity: 1 }, gone] : [
        { ...here, easing: motion.css.ease },
        { opacity: 1, transform: `${at} scale(1.12)`, offset: glide / whole, easing: motion.css.easeIn },
        { opacity: 0, transform: `${at} scale(1.3)` },
      ], { duration: durationFor(whole, reduced, true), fill: 'forwards' })
      if (winner) runs.unshift(winner)
    } else {
      runs = play([root], here, gone, d.mark, leave)
    }
    const last = runs.at(-1)
    // A way out with nothing to wait for is over at once.
    if (!visible) {
      if (last) last.onfinish = () => setMounted(false)
      else queueMicrotask(() => setMounted(false))
    }
    return () => runs.forEach(run => run.cancel())
  }, [visible, mounted, picked, reduced, width])

  if (!mounted) return null
  const plate = { top: insets.top + space.md, right: insets.right + space.md }
  return <Modal visible transparent animationType="none" onRequestClose={onClose} aria-label={t('board.endGame')}>
    {/* A window on its way out takes no taps. */}
    <div ref={stage} style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: visible ? 'auto' : 'none' }}>
      <div data-part="veil" style={{ position: 'absolute', inset: 0, backgroundColor: scrim.table }} />
      <Pressable accessible={false} focusable={false} style={StyleSheet.absoluteFill} onPress={onClose} />
      <View pointerEvents="box-none" style={[styles.centre, { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.lg }]}>
        <View pointerEvents="box-none" style={[styles.column, { width }]}>
          <View pointerEvents="none" style={styles.heading}>
            <div data-part="rule" style={rule} />
            <div data-part="title">
              <Text accessibilityRole="header" style={[type.display.band, styles.words, { color: palette.text }]}>{t('board.endGame')}</Text>
            </div>
            <div data-part="rule" style={rule} />
          </View>
          <View pointerEvents="box-none" style={styles.tokens}>
            {sides.map(side => {
              const label = t(side === 'good' ? 'board.goodWins' : 'board.evilWins')
              return <Pressable key={side} accessibilityRole="button" accessibilityLabel={label} style={styles.choice}
                onPress={() => { setPicked(side); onEnd(side) }}>
                {state => <>
                  <div data-part={`token-${side}`} style={{ position: 'relative', width: size, height: size }}>
                    <div data-part={`halo-${side}`} aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: '50%', opacity: 0,
                      boxShadow: `0 0 44px 10px ${colour[side]}9e` }} />
                    <View style={[{ borderRadius: size / 2, transform: [{ scale: state.pressed ? pressedScale : 1 }] },
                      focusStyle(palette, isHovered(state) || (isFocused(state) && focusVisible))]}>
                      {/* The two masks are bundled as art under the ids good and evil, and a token
                          draws the art of an id the content does not know on the usual disc. */}
                      <Token size={size} character={side} alignment={side} markers={false} />
                    </View>
                  </div>
                  <div data-part="label">
                    <Text style={[type.display.title, styles.words, styles.label, { color: colour[side] }]}>{label}</Text>
                  </div>
                </>}
              </Pressable>
            })}
          </View>
        </View>
      </View>
      <div data-part="title" style={{ position: 'absolute', ...plate }}>
        <View style={styles.plate}><IconButton icon="close" label={t('common.close')} onPress={onClose} /></View>
      </div>
    </div>
  </Modal>
}

// The rule of the win's announcement, in brass until a side has taken it.
const rule = { height: 1, width: '62%', background: `linear-gradient(90deg, transparent, ${palette.accent}, transparent)` } as const

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  column: { alignItems: 'center', gap: space.xxl },
  heading: { alignSelf: 'stretch', alignItems: 'center', gap: space.sm },
  words: { textAlign: 'center' },
  tokens: { alignSelf: 'stretch', flexDirection: 'row' },
  // The padding keeps the two labels apart where each fills its half. The disc wears the focus
  // ring, so the browser's own, which it draws around the whole half, is put out.
  choice: { flex: 1, minWidth: 0, alignItems: 'center', gap: space.md, paddingHorizontal: space.sm, outlineStyle: 'solid', outlineWidth: 0 },
  // The label already reads as the words of the win that follow it.
  label: { fontFamily: font.display.bold, textTransform: 'uppercase' },
  // The toolbar's dark plate, where the toolbar stands on the board.
  plate: { padding: space.xxs, borderRadius: radius.control, backgroundColor: palette.ink, borderWidth: hairline,
    borderColor: palette.inkMuted, boxShadow: shadows.lifted },
})
