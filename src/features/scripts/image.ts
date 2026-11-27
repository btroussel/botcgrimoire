// A picked image made into a homebrew icon, embedded in the record as a data URL so the game
// never fetches it (docs/content.md, Homebrew characters). The official icons are cutouts cropped
// to their visible pixels and about 280 pixels across, so an upload is cropped and sized the same
// way and sits on the token like one of them. A photo has no transparent edge to crop to, so it
// becomes a centred disc, which reads as a portrait on a round token instead of a square over its
// printed name.
// A script's logo is made the same way and embedded in its `_meta`, but keeps its own shape:
// logos are often wide lettering, which a disc would cut.

const iconSize = 288

// Three times the widest and the tallest slot a logo is drawn in, the 112 wide list row and the
// 76 tall phone one, so it stays sharp on a dense screen and on the printed sheet.
const logoBox = { width: 336, height: 228 }

export interface Bounds {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

// The smallest box holding every pixel that is not fully transparent, or nothing when none is.
export const visibleBounds = (alpha: (i: number) => number, width: number, height: number): Bounds | undefined => {
  let top = height, left = width, bottom = -1, right = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha(y * width + x) === 0) continue
      if (y < top) top = y
      if (y > bottom) bottom = y
      if (x < left) left = x
      if (x > right) right = x
    }
  }
  return bottom < 0 ? undefined : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 }
}

// Whether any pixel lets the table show through: a cutout rather than a photo.
export const hasTransparency = (alpha: (i: number) => number, pixels: number): boolean => {
  for (let i = 0; i < pixels; i++) if (alpha(i) < 255) return true
  return false
}

// Scaled to fit a box, a square of `maxWidth` when no height is given, never enlarged.
export const fitWithin = (width: number, height: number, maxWidth: number, maxHeight = maxWidth): { readonly width: number; readonly height: number } => {
  const scale = Math.min(1, maxWidth / width, maxHeight / height)
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

const decode = async (file: Blob): Promise<HTMLImageElement> => {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

const canvasOf = (width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('no canvas')
  return [canvas, context]
}

// WebP at the bundled art's quality where the browser can write it; PNG otherwise.
const encode = (canvas: HTMLCanvasElement): string => {
  const webp = canvas.toDataURL('image/webp', 0.9)
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png')
}

// The picked image on a canvas, and the part of it to keep: a cutout's visible pixels, or nothing
// for a photo, which has no transparent edge to crop to. The pixels are read at a working size,
// so a phone photo is not scanned at full resolution.
const read = async (file: Blob, workSize: number): Promise<{ readonly source: HTMLCanvasElement; readonly cutout: Bounds | undefined }> => {
  const image = await decode(file)
  const work = fitWithin(image.naturalWidth, image.naturalHeight, workSize)
  const [source, context] = canvasOf(work.width, work.height)
  context.drawImage(image, 0, 0, work.width, work.height)
  const { data } = context.getImageData(0, 0, work.width, work.height)
  const alpha = (i: number) => data[i * 4 + 3] ?? 0
  if (!hasTransparency(alpha, work.width * work.height)) return { source, cutout: undefined }
  const cutout = visibleBounds(alpha, work.width, work.height)
  if (!cutout) throw new Error('empty image')
  return { source, cutout }
}

export const iconFromFile = async (file: Blob): Promise<string> => {
  const { source, cutout } = await read(file, iconSize * 4)
  if (cutout) {
    const out = fitWithin(cutout.width, cutout.height, iconSize)
    const [canvas, context] = canvasOf(out.width, out.height)
    context.drawImage(source, cutout.x, cutout.y, cutout.width, cutout.height, 0, 0, out.width, out.height)
    return encode(canvas)
  }
  const side = Math.min(source.width, source.height)
  const out = Math.min(side, iconSize)
  const [canvas, context] = canvasOf(out, out)
  context.beginPath()
  context.arc(out / 2, out / 2, out / 2, 0, Math.PI * 2)
  context.clip()
  context.drawImage(source, (source.width - side) / 2, (source.height - side) / 2, side, side, 0, 0, out, out)
  return encode(canvas)
}

// A photo stays the rectangle it is, fitted and not cropped.
export const logoFromFile = async (file: Blob): Promise<string> => {
  const { source, cutout } = await read(file, logoBox.width * 4)
  const box = cutout ?? { x: 0, y: 0, width: source.width, height: source.height }
  const out = fitWithin(box.width, box.height, logoBox.width, logoBox.height)
  const [canvas, context] = canvasOf(out.width, out.height)
  context.drawImage(source, box.x, box.y, box.width, box.height, 0, 0, out.width, out.height)
  return encode(canvas)
}
