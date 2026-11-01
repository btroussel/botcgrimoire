import { mkdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const output = new URL('../public/icons/', import.meta.url)
const source = await readFile(new URL('../assets/art/logo/les-petites-fleches.svg', import.meta.url), 'utf8')
const texture = async (file) => {
  const png = await sharp(fileURLToPath(new URL(`../assets/art/${file}`, import.meta.url)))
    .resize(768, 768).png().toBuffer()
  return `data:image/png;base64,${png.toString('base64')}`
}
const [velvet, paper] = await Promise.all([
  texture('velvet/burgundy.webp'),
  texture('paper/warm-vellum.webp'),
])

const artwork = (scale) => Buffer.from(source
  .replace('../velvet/burgundy.webp', velvet)
  .replace('../paper/warm-vellum.webp', paper)
  .replace('scale(.88)', `scale(${scale})`))

await mkdir(output, { recursive: true })
const original = artwork('.88')
// Android may crop to a circle of radius 40% of the canvas. Keep the whole book inside it.
const maskable = artwork('.8')
for (const [file, size, source] of [
  ['icon-192.png', 192, original],
  ['icon-512.png', 512, original],
  ['apple-touch-icon.png', 180, original],
  ['icon-maskable-512.png', 512, maskable],
]) {
  // A 256-colour palette holds the velvet and vellum grain at a quarter of the true-colour bytes,
  // and every file here is part of the offline download.
  await sharp(source).resize(size, size).removeAlpha()
    .png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 })
    .toFile(fileURLToPath(new URL(file, output)))
  console.log(`Icon: public/icons/${file} (${size} x ${size})`)
}

// Below 48 px the dial's ticks and fine hands blur together, so the favicon has its own flat
// redraw: thick hands, a wider clasp, no texture. Expo turns this PNG into the 16, 32 and 48 px
// favicon.ico through `web.favicon`.
await sharp(fileURLToPath(new URL('../assets/art/logo/les-petites-fleches-favicon.svg', import.meta.url)))
  .resize(48, 48).removeAlpha()
  .png({ palette: true, effort: 10, compressionLevel: 9 })
  .toFile(fileURLToPath(new URL('favicon.png', output)))
console.log('Icon: public/icons/favicon.png (48 x 48)')
