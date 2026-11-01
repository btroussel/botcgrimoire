// The header stays put while content scrolls. Paper pages sit within the same velvet
// frame as the library; the board keeps its own layout and ornamental corners.
import { useLayoutEffect } from 'react'
import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { usePhone } from './breakpoint'
import { IconButton } from './Button'
import { PaperTexture } from './PaperTexture'
import { PageVelvet } from './Velvet'
import { useViewport } from './Viewport'
import { gutter, layout, motion, palette, radius, space, touch, type } from './theme'

export interface ScreenProps {
  readonly surface?: 'felt' | 'paper'
  readonly title?: string
  readonly children: ReactNode
  readonly onBack?: () => void // draws the back arrow; the route decides where back goes
  readonly backLabel?: string // the arrow's accessibility label, from t('common.back')
  readonly right?: ReactNode // a corner control on the header's right: settings, print, share
  readonly scroll?: boolean // false for a screen that lays out its own scrolling
  readonly contentMax?: number // the home cover has room for artwork beside its title
}

export const Screen = ({ title, children, onBack, backLabel, right, scroll = true, surface = 'felt', contentMax = layout.contentMax }: ScreenProps) => {
  const p = palette
  const insets = useSafeAreaInsets()
  const viewport = useViewport()
  const pad = usePhone() ? gutter.phone : gutter.tablet
  const hasHeader = title !== undefined || onBack !== undefined || right !== undefined
  const header = hasHeader ? (
    <View style={[styles.header, { maxWidth: contentMax, paddingHorizontal: pad, paddingTop: insets.top + space.md }]}>
      {onBack ? <IconButton icon="back" label={backLabel ?? ''} onPress={onBack} surface={surface} /> : null}
      <Text accessibilityRole={title ? 'header' : undefined} style={[type.display.title, styles.title, { color: surface === 'paper' ? p.ink : p.text, marginLeft: onBack ? 0 : space.xs }]} numberOfLines={1}>
        {title ?? ''}
      </Text>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  ) : null
  const content = (
    <View style={[styles.content, scroll ? styles.scrollContent : styles.fill, { maxWidth: contentMax, paddingHorizontal: pad, paddingBottom: insets.bottom + pad, paddingTop: hasHeader ? space.sm : insets.top + pad }]}>
      {children}
    </View>
  )
  return (
    <View style={[styles.root, { maxHeight: viewport.height || undefined, top: viewport.top, backgroundColor: p.felt, padding: surface === 'paper' ? pad : space.sm }]}>
      <PageVelvet />
      <PageEnter>
      <View style={[styles.page, surface === 'paper' ? [styles.paperPage, { maxWidth: contentMax, backgroundColor: p.parchment }] : null]}>
        {surface === 'paper' ? <PaperTexture radius={radius.tile} /> : null}
        {header}
        {scroll ? (
          <ScrollView style={styles.fill} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {content}
          </ScrollView>
        ) : (
          <View style={styles.fill}>{content}</View>
        )}
      </View>
      </PageEnter>
    </View>
  )
}

// A new page fades in over the fabric instead of snapping into place. It is CSS so the static
// export shows the page before JavaScript runs, and it only fades, so nothing shifts under a tap.
// The export's controls do nothing until React hydrates them, and a tap then is lost: hydration
// runs inside it and the measured layout moves the control from under the finger. So they look
// disabled and take no taps until the root is marked, while the text keeps its full strength.
const enterCss = `
.grimoire-screen { animation: grimoire-screen-in ${motion.duration.mark}ms ${motion.css.ease} both; }
@keyframes grimoire-screen-in { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .grimoire-screen { animation-duration: ${motion.duration.fade}ms; } }
#root:not([data-hydrated]) .grimoire-screen :is(a, button, label, [role="button"]) {
  opacity: ${motion.disabledOpacity} !important; pointer-events: none !important;
}
`
const pageFrame = { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0 } as const

// The fade for a page that lays itself out, as the board does: a flex column that fills its parent.
// Each route draws it inside its own Suspense boundary, which React hydrates after the layouts
// around it, so its effect is the moment the page has handlers. The mark lasts the visit; as a
// layout effect it also lands before a page drawn without an export first paints.
export const PageEnter = ({ children }: { readonly children: ReactNode }) => {
  useLayoutEffect(() => { document.getElementById('root')?.setAttribute('data-hydrated', '') }, [])
  return <>
    <style href="grimoire-screen" precedence="default">{enterCss}</style>
    <div className="grimoire-screen" style={pageFrame}>{children}</div>
  </>
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  page: { flex: 1 },
  paperPage: { width: '100%', alignSelf: 'center', borderRadius: radius.tile, overflow: 'hidden' },
  fill: { flex: 1 },
  scroll: { flexGrow: 1 },
  scrollContent: { flexGrow: 1, flexShrink: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: touch,
    paddingBottom: space.sm,
    width: '100%',
    maxWidth: layout.contentMax,
    alignSelf: 'center',
  },
  title: { flex: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  content: {
    gap: space.lg,
    width: '100%',
    maxWidth: layout.contentMax,
    alignSelf: 'center',
  },
})
