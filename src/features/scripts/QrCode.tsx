// A share link as a QR code (docs/app.md, Scripts). Black on white in every theme, since a
// camera reads contrast, with the four-module quiet zone the standard asks for. Drawn as plain
// SVG: crisp edges keep the joins between modules from showing as faint lines when scaled.
import { encodeQR } from 'qr'
import { memo, useMemo } from 'react'

export type QrModules = readonly (readonly boolean[])[]

// The modules for the text, or nothing when it is past what one code holds: about 2,300
// characters at the medium correction level, which survives glare on a phone screen.
export const qrModules = (text: string): QrModules | undefined => {
  try {
    return encodeQR(text, 'raw', { ecc: 'medium', border: 4 })
  } catch {
    return undefined
  }
}

// One path for the whole code, each row's dark runs as rectangles.
const qrPath = (modules: QrModules): string => {
  let d = ''
  modules.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (!row[x]) continue
      const start = x
      while (row[x + 1]) x++
      d += `M${start} ${y}h${x + 1 - start}v1h${start - x - 1}z`
    }
  })
  return d
}

export const QrCode = memo(function QrCode({ modules, label }: { readonly modules: QrModules; readonly label: string }) {
  const n = modules.length
  const d = useMemo(() => qrPath(modules), [modules])
  return (
    <svg viewBox={`0 0 ${n} ${n}`} role="img" aria-label={label} shapeRendering="crispEdges" style={{ display: 'block', width: '100%', height: 'auto' }}>
      <rect width={n} height={n} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  )
})
