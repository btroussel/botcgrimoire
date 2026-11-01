import { StyleSheet, Text } from 'react-native'

import { abilityParts } from './abilityParts'
import { font } from './theme'

// Goes inside the caller's Text, which keeps its own size, colour, id and ref: only the setup
// change takes the bold face.
export const AbilityText = ({ text }: { readonly text: string }) =>
  <>{abilityParts(text).map((part, index) => part.setup ? <Text key={index} style={styles.setup}>{part.text}</Text> : part.text)}</>

const styles = StyleSheet.create({
  setup: { fontFamily: font.body.bold },
})
