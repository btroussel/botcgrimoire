import { Image, StyleSheet, Text, View } from 'react-native'

import { communityArt } from '../../content/generated/art'
import { shop, TextLink, withLink } from '../../ui/TextLink'
import { palette, space, type } from '../../ui/theme'
import type { Translate } from '../../content'

// The body of the About group; the settings screen draws its heading like every other group.
export const AboutSection = ({ t, version }: { readonly t: Translate; readonly version: string | undefined }) => (
  <View style={styles.body}>
    <View style={styles.notice}>
      <Text style={[type.text.small, styles.muted]}>{t('common.unofficial')}</Text>
      <Text style={[type.text.small, styles.muted]}>{t('common.ownership')}</Text>
    </View>
    <Text style={[type.text.body, styles.muted]}>
      {withLink(t('common.supportCreators'), <TextLink href={shop} external surface="paper">{t('common.buyGrimoire')}</TextLink>)}
    </Text>
    <Image source={communityArt['ccc-parchment']} style={styles.badge} resizeMode="contain" accessible={false} />
    {/* Last and smallest on purpose: there for whoever looks, never competing with the game. The
        version is what a bug report asks for, so it sits where someone looking for it would look. */}
    {version ? <Text style={[type.text.small, styles.muted, styles.version]}>{t('common.version', { version })}</Text> : null}
  </View>
)

const styles = StyleSheet.create({
  body: { gap: space.md },
  badge: { width: 176, height: 66, maxWidth: '100%', alignSelf: 'center' },
  notice: { gap: space.xs },
  muted: { color: palette.inkMuted },
  version: { textAlign: 'center' },
})
