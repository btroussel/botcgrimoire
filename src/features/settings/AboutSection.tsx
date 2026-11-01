import { Image, StyleSheet, Text, View } from 'react-native'

import { communityArt } from '../../content/generated/art'
import { shop, TextLink, withLink } from '../../ui/TextLink'
import { palette, space, type } from '../../ui/theme'
import type { Translate } from '../../content'

const contact = 'contact@botcgrimoire.com'
const source = 'https://github.com/btroussel/botcgrimoire'

// The body of the About group; the settings screen draws its heading like every other group.
export const AboutSection = ({ t }: { readonly t: Translate }) => (
  <View style={styles.body}>
    <View style={styles.notice}>
      <Text style={[type.text.small, styles.muted]}>
        {t('common.unofficial')}{' '}
        {withLink(t('common.contact'), <TextLink href={`mailto:${contact}`} surface="paper">{contact}</TextLink>)}
      </Text>
      <Text style={[type.text.small, styles.muted]}>{t('common.ownership')}</Text>
    </View>
    <Text style={[type.text.body, styles.muted]}>
      {withLink(t('common.supportCreators'), <TextLink href={shop} external surface="paper">{t('common.buyGrimoire')}</TextLink>)}
    </Text>
    <Image source={communityArt['ccc-parchment']} style={styles.badge} resizeMode="contain" accessible={false} />
    {/* Last and smallest on purpose: there for whoever looks, never competing with the game. */}
    <Text style={[type.text.small, styles.muted, styles.source]}>
      <TextLink href={source} external surface="paper">{t('common.sourceCode')}</TextLink>
    </Text>
  </View>
)

const styles = StyleSheet.create({
  body: { gap: space.md },
  badge: { width: 176, height: 66, maxWidth: '100%', alignSelf: 'center' },
  notice: { gap: space.xs },
  muted: { color: palette.inkMuted },
  source: { textAlign: 'center' },
})
