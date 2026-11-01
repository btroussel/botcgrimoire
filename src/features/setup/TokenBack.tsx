import { tokenArt } from '../../content/generated/art'
import { TokenDisc } from '../../ui/TokenDisc'

// One neutral back for every seat, with no alignment or game-dependent decoration.
export const TokenBack = ({ size }: { readonly size: number }) => (
  <TokenDisc size={size}>
    <img src={tokenArt.character_back?.uri} alt="" draggable={false} loading="eager" fetchPriority="high" decoding="sync" width={size} height={size} style={{ display: 'block', width: '100%', height: '100%' }} />
  </TokenDisc>
)
