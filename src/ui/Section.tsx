import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { palette, space, type } from './theme'

// A titled group on a paper panel. The rule runs on from the label instead of a separate
// divider, so the groups read as one list rather than differently weighted blocks. The heading
// sits one level beneath the page title for assistive technology.
export const Section = ({ label, children }: { readonly label: string; readonly children: ReactNode }) => (
  <View style={styles.section}>
    <View style={styles.heading}>
      <Text accessibilityRole="header" aria-level={2} style={[type.display.title, { color: palette.inkMuted }]}>{label}</Text>
      <View style={styles.rule} />
    </View>
    {children}
  </View>
)

const styles = StyleSheet.create({
  section: { gap: space.md },
  heading: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rule: { flex: 1, height: 1, backgroundColor: palette.parchmentShade },
})
