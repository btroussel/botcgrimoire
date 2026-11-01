import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

import { tokenMaterial, tokenShadow } from './theme'

// The face clips its artwork, while the cut edge and contact shadow extend beyond the disc.
export const TokenDisc = ({ size, children }: { readonly size: number; readonly children: ReactNode }) => (
  <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tokenMaterial.edge, boxShadow: tokenShadow(size) }}>
    <View style={[StyleSheet.absoluteFill, styles.face, { borderRadius: size / 2 }]}>
      {children}
    </View>
    <View pointerEvents="none" aria-hidden style={[StyleSheet.absoluteFill, { borderRadius: size / 2, boxShadow: tokenMaterial.rim }]} />
  </View>
)

const styles = StyleSheet.create({
  face: { overflow: 'hidden' },
})
