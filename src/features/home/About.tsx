import type { RefObject } from 'react'
import { memo, useContext } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import type { Translate } from '../../content'
import { IconButton } from '../../ui/Button'
import { Icon } from '../../ui/icons'
import type { IconName } from '../../ui/icons'
import { shop, TextLink, withLink } from '../../ui/TextLink'
import { Velvet, VelvetColourContext } from '../../ui/Velvet'
import { font, hairline, motion, palette, radius, scrim, shadows, space, touch, type, velvetPanel } from '../../ui/theme'

// What the grimoire is, for a first visit, in the card the button beside the badge opens: the
// board, a name, one sentence and four lines, then a word for the game's makers. New game stays
// on Home, right behind the card. Search engines read the exported page and never press a button,
// so the card is a native dialog that keeps its text in the page while closed. Text no visitor
// could open at all would be hidden text, which they penalize.
const features: readonly (readonly [IconName, string])[] = [
  ['script', 'featureScripts'], ['setup', 'featureDraw'], ['order', 'featureNight'], ['vote', 'featureVotes'],
]

interface AboutProps {
  readonly t: Translate
  readonly dialog: RefObject<HTMLDialogElement | null>
}

export const About = memo(function About({ t, dialog }: AboutProps) {
  const colour = useContext(VelvetColourContext)
  const close = () => dialog.current?.close()
  return (
    // A tap on the scrim lands on the dialog itself, around its card.
    <dialog ref={dialog} className="home-about" aria-labelledby="home-about-title" onClick={(event) => { if (event.target === event.currentTarget) close() }}>
      <style href="grimoire-about" precedence="default">{aboutCss}</style>
      <View style={[styles.card, { borderColor: velvetPanel.borderColor }]}>
        <Velvet colour={colour} frame={false} />
        {/* First, so opening the card focuses it, as a sheet's header does; it sits over the picture
            on a dark disc, so it reads on any part of the board. */}
        <IconButton icon="close" label={t('common.close')} onPress={close} surface="felt" style={styles.close} />
        <ScrollView style={styles.scroll}>
          {/* The link preview's capture of a game in play, fetched only once the card opens. */}
          <img src="/share.jpg" width={1200} height={630} alt={t('home.boardAlt')} loading="lazy" decoding="async" className="home-about-board" />
          <View style={styles.content}>
            <View style={styles.words}>
              <Text role="heading" aria-level={2} id="home-about-title" style={styles.heading}>{t('home.heading')}</Text>
              <Text style={[type.text.body, styles.muted]}>{t('home.lead')}</Text>
            </View>
            <View role="list" style={styles.list}>
              {features.map(([icon, key]) => (
                <View key={key} role="listitem" style={styles.item}>
                  <Icon name={icon} color={palette.accent} size={22} />
                  <Text style={[type.text.body, styles.itemText]}>{t(`home.${key}`)}</Text>
                </View>
              ))}
            </View>
            <View style={styles.footer}>
              <Text style={[type.text.small, styles.muted]}>
                {withLink(t('common.supportCreators'), <TextLink href={shop} external surface="felt">{t('common.buyGrimoire')}</TextLink>)}
              </Text>
              <Text style={[type.text.small, styles.muted]}>{t('common.unofficial')}</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </dialog>
  )
})

// The dialog fills the screen inside the safe area and centres its card, as a sheet does. It
// fades in and out; a browser without discrete transitions shows and hides it at once.
const fade = `${motion.duration.mark}ms ${motion.css.ease}`
const inset = (gap: number) => (['top', 'right', 'bottom', 'left'] as const).map((side) => `calc(env(safe-area-inset-${side}) + ${gap}px)`).join(' ')
const aboutCss = `
.home-about {
  position: fixed; inset: 0; box-sizing: border-box; width: 100%; height: 100%; max-width: none; max-height: none;
  margin: 0; border: 0; background: transparent; overflow: hidden; padding: ${inset(space.md)};
  opacity: 0; transition: opacity ${fade}, overlay ${fade} allow-discrete, display ${fade} allow-discrete;
}
.home-about[open] { display: flex; align-items: center; justify-content: center; opacity: 1; }
.home-about::backdrop { background-color: transparent; transition: background-color ${fade}, overlay ${fade} allow-discrete, display ${fade} allow-discrete; }
.home-about[open]::backdrop { background-color: ${scrim.dialog}; }
@starting-style {
  .home-about[open] { opacity: 0; }
  .home-about[open]::backdrop { background-color: transparent; }
}
@media (min-width: 600px) { .home-about { padding: ${inset(space.xl)}; } }
/* On a short window the picture gives up height before the words do. */
.home-about-board { display: block; width: 100%; height: auto; aspect-ratio: 1200 / 630; max-height: 38vh; object-fit: cover; border-bottom: ${hairline}px solid ${String(velvetPanel.borderColor)}; }
`

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 420, maxHeight: '100%', overflow: 'hidden', borderRadius: radius.sheet, borderWidth: hairline, boxShadow: shadows.sheet },
  scroll: { flexGrow: 0, flexShrink: 1, minHeight: 0 },
  content: { gap: space.lg, paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.xl },
  words: { gap: space.sm },
  heading: { fontFamily: font.display.semibold, fontSize: 28, lineHeight: 32, color: palette.text },
  muted: { color: palette.muted },
  list: { gap: space.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  itemText: { flex: 1, minWidth: 0, color: palette.text },
  footer: { gap: space.sm },
  close: { position: 'absolute', top: space.sm, right: space.sm, zIndex: 1, borderRadius: touch / 2, borderColor: velvetPanel.borderColor, backgroundColor: '#100917e6' },
})
