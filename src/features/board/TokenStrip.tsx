import type { ReactNode } from 'react'
import { Children, isValidElement, useState } from 'react'
import { View } from 'react-native'
import { IconButton } from '../../ui/Button'
import { boardBlock, space, touch } from '../../ui/theme'
import { tokenStripHeight, tokenStripSlotWidth } from './boardGeometry'

export const TokenStrip = ({ children, previousLabel, nextLabel }: {
  readonly children: ReactNode
  readonly previousLabel: string
  readonly nextLabel: string
}) => {
  const [width, setWidth] = useState(0)
  const [page, setPage] = useState(0)
  const items = Children.toArray(children)
  // A full slot includes the grant label and breathing room for the token's shadow.
  const slot = tokenStripSlotWidth
  const availableWidth = width - 2
  const overflowing = items.length * slot > availableWidth
  const count = Math.max(1, Math.floor((availableWidth - (overflowing ? 2 * touch : 0)) / slot))
  const lastPage = Math.max(0, Math.ceil(items.length / count) - 1)
  const current = Math.min(page, lastPage)
  return <View pointerEvents="box-none" onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
    {overflowing ? <IconButton icon="back" label={previousLabel} disabled={current === 0} onPress={() => setPage(current - 1)} /> : null}
    <View pointerEvents="box-none" style={[boardBlock, { borderRadius: 999, height: tokenStripHeight, flexDirection: 'row', alignItems: 'center', paddingVertical: space.xs }]}>
      {items.slice(current * count, (current + 1) * count).map((item, index) => <View pointerEvents="box-none" key={isValidElement(item) ? item.key : index} style={{ width: slot, alignItems: 'center' }}>{item}</View>)}
    </View>
    {overflowing ? <IconButton icon="chevronRight" label={nextLabel} disabled={current === lastPage} onPress={() => setPage(current + 1)} /> : null}
  </View>
}
