import type { ReactNode, RefObject } from 'react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'

import type { CharacterId } from '../../content'
import { communityArt } from '../../content/generated/art'
import { focusStyle, IconButton, isFocused, isHovered } from '../../ui/Button'
import { useFocusVisible } from '../../ui/focus'
import { Icon } from '../../ui/icons'
import type { IconName } from '../../ui/icons'
import { PaperTexture } from '../../ui/PaperTexture'
import { Screen } from '../../ui/Screen'
import { Token } from '../../ui/Token'
import { useLayoutViewport } from '../../ui/Viewport'
import { focusRing, font, hoverWash, motion, palette, radius, shadows, space, touch, type, velvetPanel } from '../../ui/theme'
import { About } from './About'
import { useHome } from './useHome'

// The fan's own measures; a short window draws it smaller rather than pushing the actions off.
const fan = { width: 250, height: 194 }

export const HomeScreen = () => {
  const home = useHome()
  const { t } = home
  // The static export has no window, so the first render must draw the regular layout the export
  // drew, or hydration fails; the size is read once the page is live.
  const { width, height } = useLayoutViewport()
  const measured = width > 0
  // A phone on its side puts the art beside the actions, so everything fits without scrolling.
  const beside = measured && width > height && height < 560
  const short = measured && !beside && height < 720
  // A game to resume adds a row of actions, so the shortest windows shrink the fan further.
  const tight = short && (height < 600 || (home.current !== undefined && height < 680))
  // The shortest windows, a phone with its browser bars or on its side, also pack the actions down
  // to the touch target with a one-line label, and give the fan and the title less again.
  const cramped = measured && height < (home.current ? (beside ? 380 : 550) : (beside ? 360 : 480))
  // Beside the actions the fan gives up width rather than height, so a long Resume label fits.
  const fanScale = cramped ? (beside ? 0.8 : 0.35) : tight ? 0.45 : short ? 0.8 : 1
  // The badge goes under the actions only where it fits without making Home scroll. A game to
  // resume adds a row, so then only tall windows have the room; Settings always shows the badge.
  // It goes before the fan shrinks any further, so a first visit gives it up below 640 points.
  const badge = home.current ? !beside && height >= 800 : !measured || height >= (beside ? 360 : 640)
  const narrow = measured && width < 360
  // The tagline says what the app is to a first visit from a search, so a game to resume leaves
  // it out. It needs a portrait window at least 780 points tall, so a long language still fits on
  // the narrowest phone, or the column beside the actions where that keeps the badge.
  const tagline = home.current === undefined && (!measured || (beside ? height >= 360 : height >= 780))
  // The deal waits for the fan's art to decode, so on a first visit the tokens never fly in as
  // empty discs with their art arriving mid-flight. A failed image still lets the deal start.
  // It also waits for the saved games, which decide the fan's size on a short window.
  const visit = home.artwork?.visit
  const ready = home.ready
  const artwork = useRef<HTMLDivElement>(null)
  const [dealt, setDealt] = useState<number>()
  useEffect(() => {
    if (visit === undefined || !ready) return
    let live = true
    const images = [...(artwork.current?.querySelectorAll('img') ?? [])]
    void Promise.all(images.map(image => image.decode().catch(() => {}))).then(() => { if (live) setDealt(visit) })
    return () => { live = false }
  }, [visit, ready])
  const about = useRef<HTMLDialogElement>(null)
  const openAbout = useCallback(() => about.current?.showModal(), [])
  // The prompt waits for the saved games, so a device that has played never sees it, and for
  // the deal, so it never lands on the tokens mid-flight. Followed or dismissed, it is gone for
  // the visit; the button beside the badge still opens the card.
  const [nudge, setNudge] = useState(true)
  const nudging = nudge && home.newcomer && ready && dealt !== undefined
  const followNudge = useCallback(() => { setNudge(false); about.current?.showModal() }, [])
  const dismissNudge = useCallback(() => setNudge(false), [])
  const newGame = <HeroButton icon="add" label={t('common.newGame')} onPress={home.newGame} quiet={home.current !== undefined}
    narrow={narrow || cramped} dense={cramped} />
  return (
    <Screen contentMax={beside ? 860 : 460}>
      <style>{entranceCss}</style>
      <View style={[styles.group, beside && styles.groupBeside, tight && styles.groupTight]}>
        <View style={[styles.identity, beside && (cramped && home.current ? styles.columnCramped : styles.column), tight && styles.identityTight]}>
          {home.artwork ? <HomeFan characters={home.artwork.characters} visit={home.artwork.visit} dealt={dealt === visit}
            scale={fanScale} artworkRef={artwork} /> : <FanSpace scale={fanScale} />}
          <View style={styles.name}>
            <Text accessibilityRole="header" style={[styles.title, (width < 760 || short || beside) && styles.compactTitle, tight && styles.tightTitle,
              cramped && styles.crampedTitle]}>{t('common.appName')}</Text>
            {tagline ? <Text id="home-tagline" style={[type.text.body, styles.tagline]}>{t('common.tagline')}</Text> : null}
          </View>
        </View>
        {/* The actions wait for the saved games, so the next action is never New game for a moment
            and then Resume under a finger. They hold their place meanwhile and rise in once known. */}
        <div className={home.ready ? 'home-rise' : undefined} style={{ ...actionsCss, ...(beside ? { flex: '1 1 0', maxWidth: 400 } : {}),
          ...(beside || cramped ? { gap: space.sm } : {}), ...(home.ready ? {} : { visibility: 'hidden' }) }}>
          {home.current ? <HeroButton icon="play" label={t('common.resumeGame')} detail={home.current.detail}
            accessibilityLabel={`${t('common.resumeGame')}, ${home.current.a11y}`} onPress={home.resume} narrow={narrow || cramped} dense={cramped} /> : newGame}
          {home.current ? newGame : null}
          <View style={[styles.navigation, { backgroundColor: velvetPanel.backgroundColor, borderColor: velvetPanel.borderColor }]}>
            <NavItem icon="script" title={t('common.scripts')} hint={t('common.scriptsHint')} onPress={home.openScripts} compact={short || beside} dense={cramped} divided />
            <NavItem icon="history" title={t('common.history')} hint={t('common.historyHint')} onPress={home.openHistory} compact={short || beside} dense={cramped} divided />
            <NavItem icon="settings" title={t('common.settings')} hint={t('common.settingsHint')} onPress={home.openSettings} compact={short || beside} dense={cramped} />
          </View>
          {/* A first visit can read what the app is from the badge's row, so Home grows no taller. */}
          {badge ? <View style={styles.badgeRow}>
            <Image source={communityArt['ccc-parchment']} style={styles.badge} resizeMode="contain"
              accessibilityRole="image" accessibilityLabel={t('common.unofficial')} />
            {home.newcomer ? <AboutButton label={t('home.about')} onPress={openAbout} iconOnly={narrow} /> : null}
          </View> : null}
        </div>
      </View>
      {nudging ? <Nudge label={t('home.nudge')} closeLabel={t('common.close')} onFollow={followNudge} onDismiss={dismissNudge} beside={beside} /> : null}
      {home.newcomer ? <About t={t} dialog={about} /> : null}
    </Screen>
  )
}

const FanSpace = ({ scale, children }: { readonly scale: number; readonly children?: ReactNode }) => (
  <View aria-hidden pointerEvents="none" style={{ width: fan.width * scale, height: fan.height * scale, flexShrink: 0 }}>
    {children}
  </View>
)

interface HomeFanProps {
  readonly characters: readonly CharacterId[]
  readonly visit: number
  readonly dealt: boolean
  readonly scale: number
  readonly artworkRef: RefObject<HTMLDivElement | null>
}

// Home stays mounted behind the board and hears every edit there; the tokens are the costly
// part, so they draw again only when the fan itself changes.
const HomeFan = memo(function HomeFan({ characters, visit, dealt, scale, artworkRef }: HomeFanProps) {
  return (
    <FanSpace scale={scale}>
      <div key={visit} ref={artworkRef} className={dealt ? 'home-artwork home-dealt' : 'home-artwork'} style={{ transform: `scale(${scale})` }}>
        {characters.map((character, index) => (
          <div key={character} className={`home-token home-token-${index}`}>
            <Token character={character} size={index === 2 ? 151 : 122} />
          </div>
        ))}
      </div>
    </FanSpace>
  )
})

interface HeroButtonProps {
  readonly icon: IconName
  readonly label: string
  readonly onPress: () => void
  readonly detail?: string
  readonly accessibilityLabel?: string
  readonly quiet?: boolean // an open face on the velvet, when another action is the one to take
  readonly narrow?: boolean // narrow phones and columns: a smaller label and no chevron, so French fits one line
  readonly dense?: boolean // the shortest windows: down to the touch target
}

// The one action to take next: parchment with a brass edge whose shallow lower edge sinks under
// a press. When a game is waiting, New game steps back to an open face so Resume leads.
const HeroButton = memo(function HeroButton({ icon, label, onPress, detail, accessibilityLabel, quiet, narrow, dense }: HeroButtonProps) {
  const focusVisible = useFocusVisible()
  const ink = quiet ? palette.text : palette.ink
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} onPress={onPress}
    style={state => [styles.hero, quiet ? styles.heroQuiet : null, dense ? (quiet ? styles.heroQuietDense : styles.heroDense) : null,
      quiet
        ? { backgroundColor: isHovered(state) ? hoverWash.felt : velvetPanel.backgroundColor }
        : { backgroundColor: isHovered(state) ? palette.text : palette.parchment,
          boxShadow: state.pressed ? 'inset 0 2px 4px #2a201825' : 'inset 0 1px 0 #ffffff80, 0 3px 0 #806333, 0 6px 16px #0004' },
      { opacity: state.pressed ? motion.pressedOpacity : 1 },
      focusStyle(palette, isFocused(state) && focusVisible),
    ]}>
    {quiet ? null : <PaperTexture radius={radius.tile} />}
    <View style={[styles.heroIcon, icon === 'play' && styles.playIcon]}><Icon name={icon} color={quiet ? palette.accent : ink} size={quiet ? 24 : 28} /></View>
    <View style={styles.heroText}>
      <Text style={[quiet ? type.display.title : styles.heroLabel, !quiet && narrow && styles.heroLabelNarrow, { color: ink }]}>{label}</Text>
      {detail ? <Text style={[type.text.small, { color: palette.inkMuted }]} numberOfLines={2}>{detail}</Text> : null}
    </View>
    {/* In a view, so it paints above the absolutely placed paper. */}
    {narrow ? null : <View><Icon name="chevronRight" color={quiet ? palette.muted : palette.inkMuted} size={20} /></View>}
  </Pressable>
})

interface NavItemProps {
  readonly icon: IconName
  readonly title: string
  readonly hint: string
  readonly onPress: () => void
  readonly divided?: boolean
  readonly compact?: boolean // the title alone, where height is short
  readonly dense?: boolean // the shortest windows: down to the touch target
}

const NavItem = memo(function NavItem({ icon, title, hint, onPress, divided, compact, dense }: NavItemProps) {
  const p = palette
  const focusVisible = useFocusVisible()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={(state) => [
        styles.navItem,
        compact && styles.navItemCompact,
        dense && styles.navItemDense,
        { borderBottomWidth: divided ? 1 : 0, borderBottomColor: velvetPanel.borderColor, backgroundColor: isHovered(state) ? hoverWash.felt : 'transparent', opacity: state.pressed ? motion.pressedOpacity : 1 },
        // Drawn inside the row, since the shared surface clips anything outside it.
        isFocused(state) && focusVisible ? [focusStyle(p, true), { outlineOffset: -(focusRing.width + focusRing.offset) }] : null,
      ]}
    >
      <View style={styles.heroIcon}><Icon name={icon} color={p.accent} /></View>
      <View style={styles.navText}>
        <Text style={[type.display.title, { color: p.text }]}>{title}</Text>
        {compact ? null : <Text style={[type.text.small, { color: p.muted }]}>{hint}</Text>}
      </View>
      <Icon name="chevronRight" color={p.muted} size={20} />
    </Pressable>
  )
})

interface AboutButtonProps {
  readonly label: string
  readonly onPress: () => void
  readonly iconOnly: boolean // the narrowest phones keep the glyph, so the row still fits beside the badge
}

const AboutButton = memo(function AboutButton({ label, onPress, iconOnly }: AboutButtonProps) {
  const focusVisible = useFocusVisible()
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} aria-haspopup="dialog" onPress={onPress}
      style={(state) => [styles.about, { backgroundColor: isHovered(state) ? hoverWash.felt : 'transparent', opacity: state.pressed ? motion.pressedOpacity : 1 },
        focusStyle(palette, isFocused(state) && focusVisible)]}>
      <Icon name="info" color={palette.accent} size={20} />
      {iconOnly ? null : <Text style={[type.text.small, { color: palette.text }]}>{label}</Text>}
    </Pressable>
  )
})

interface NudgeProps {
  readonly label: string
  readonly closeLabel: string
  readonly onFollow: () => void
  readonly onDismiss: () => void
  readonly beside: boolean // over the fan's column, clear of the actions beside it
}

// A first visit's prompt, at the top of the screen over the decorative fan, so it covers no control.
const Nudge = memo(function Nudge({ label, closeLabel, onFollow, onDismiss, beside }: NudgeProps) {
  const focusVisible = useFocusVisible()
  return (
    <div className={beside ? 'home-nudge home-nudge-beside' : 'home-nudge'}>
      <View style={[styles.nudge, { borderColor: velvetPanel.borderColor }]}>
        <Pressable accessibilityRole="button" aria-haspopup="dialog" onPress={onFollow}
          style={(state) => [styles.nudgeFollow, { backgroundColor: isHovered(state) ? hoverWash.felt : 'transparent', opacity: state.pressed ? motion.pressedOpacity : 1 },
            focusStyle(palette, isFocused(state) && focusVisible)]}>
          <Icon name="info" color={palette.accent} size={20} />
          <Text style={[type.text.small, styles.nudgeLabel]}>{label}</Text>
        </Pressable>
        <IconButton icon="close" label={closeLabel} onPress={onDismiss} surface="felt" />
      </View>
    </div>
  )
})

const styles = StyleSheet.create({
  group: { width: '100%', alignItems: 'center', marginVertical: 'auto', gap: space.xl, paddingVertical: space.md },
  groupBeside: { flexDirection: 'row', justifyContent: 'center', gap: space.xxl, paddingVertical: 0 },
  groupTight: { gap: space.lg, paddingVertical: 0 },
  identity: { alignItems: 'center', gap: space.lg },
  identityTight: { gap: space.md },
  column: { flex: 1, maxWidth: 400 },
  // As wide as the fan or the title, so Resume beside it gets the rest. A first visit keeps half
  // the width, which the prompt over the fan needs to stay clear of New game.
  columnCramped: { flexGrow: 0, flexShrink: 0 },
  title: { fontFamily: font.display.semibold, fontSize: 54, lineHeight: 58, textAlign: 'center', color: palette.text },
  compactTitle: { fontSize: 46, lineHeight: 50 },
  tightTitle: { fontSize: 40, lineHeight: 44 },
  crampedTitle: { fontSize: 36, lineHeight: 40 },
  name: { alignItems: 'center', gap: space.xs },
  tagline: { maxWidth: 360, textAlign: 'center', color: palette.muted },
  hero: { width: '100%', minHeight: 72, flexDirection: 'row', alignItems: 'center',
    gap: space.md, paddingVertical: space.md, paddingLeft: space.md, paddingRight: space.lg,
    borderRadius: radius.tile, borderWidth: 1, borderColor: palette.accent, overflow: 'hidden' },
  heroQuiet: { minHeight: 60, paddingVertical: space.sm },
  heroDense: { minHeight: 56, paddingVertical: space.sm },
  heroQuietDense: { minHeight: touch, paddingVertical: space.xxs },
  heroIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  // The play triangle's weight sits left of its box; nudge it to look centred.
  playIcon: { paddingLeft: 3 },
  heroText: { flex: 1, minWidth: 0, gap: space.xxs },
  heroLabel: { fontFamily: font.display.semibold, fontSize: 28, lineHeight: 32 },
  heroLabelNarrow: { fontSize: 24, lineHeight: 26 },
  navigation: { width: '100%', borderRadius: radius.tile, borderWidth: 1, overflow: 'hidden' },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: space.md, paddingRight: space.lg, paddingVertical: space.sm, minHeight: 64 },
  navItemCompact: { minHeight: 52 },
  navItemDense: { minHeight: touch, paddingVertical: space.xxs },
  navText: { flex: 1, minWidth: 0, gap: space.xxs },
  badgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.md, alignSelf: 'center' },
  badge: { width: 120, height: 45 },
  about: { minHeight: touch, flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.sm, borderRadius: radius.control },
  nudge: { flexDirection: 'row', alignItems: 'center', maxWidth: 420, borderRadius: touch / 2, borderWidth: 1, backgroundColor: '#100917f0', boxShadow: shadows.sheet },
  nudgeFollow: { flexShrink: 1, minHeight: touch, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingLeft: space.md, paddingRight: space.xs, borderRadius: touch / 2 },
  nudgeLabel: { flexShrink: 1, color: palette.text },
})

const actionsCss = { display: 'flex', flexDirection: 'column', gap: space.md, width: '100%' } as const

// The tokens are dealt onto the cloth once their art is ready, and the actions rise in beneath
// them. Under reduced motion nothing moves and the actions only fade.
const entranceCss = `
.home-artwork { position: relative; width: ${fan.width}px; height: ${fan.height}px; transform-origin: top left; }
.home-artwork:not(.home-dealt) { visibility: hidden; }
.home-token { position: absolute; transform: rotate(var(--angle)); animation: home-token-deal 550ms ${motion.css.ease} both paused; }
.home-dealt .home-token { animation-play-state: running; }
.home-token-0 { left: 0; top: 9px; --angle: -15deg; }
.home-token-1 { right: 0; top: 0; --angle: 16deg; animation-delay: 80ms; }
.home-token-2 { left: 49px; top: 44px; --angle: -3deg; animation-delay: 160ms; }
.home-rise { animation: home-rise 380ms ${motion.css.ease} 120ms both; }
@keyframes home-token-deal {
  from { opacity: 0; transform: translateY(32px) rotate(0deg) scale(.95); }
  to { opacity: 1; transform: translateY(0) rotate(var(--angle)) scale(1); }
}
@keyframes home-rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
/* Balanced lines, so a wrapped tagline never leaves a word or two alone. */
#home-tagline { text-wrap: balance; }
/* The first visit's prompt drops in once the tokens have landed. */
.home-nudge {
  position: absolute; top: calc(env(safe-area-inset-top) + ${space.sm}px); left: 0; right: 0; z-index: 2;
  display: flex; justify-content: center; padding: 0 ${space.sm}px; pointer-events: none;
  animation: home-nudge-in 320ms ${motion.css.ease} 600ms both;
}
.home-nudge > * { pointer-events: auto; }
.home-nudge-beside { justify-content: flex-start; }
.home-nudge-beside > * { max-width: 50%; }
@keyframes home-nudge-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
@keyframes home-fade { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .home-token { animation: none; }
  .home-rise { animation: home-fade ${motion.duration.fade}ms linear both; }
  .home-nudge { animation: home-fade ${motion.duration.fade}ms linear 600ms both; }
}
`
