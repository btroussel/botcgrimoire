// A picked image made into a homebrew icon, embedded in the record as a data URL so the game
// never fetches it (docs/content.md, Homebrew characters). The official icons are cutouts cropped
// to their visible pixels and about 280 pixels across, so an upload is cropped and sized the same
// way and sits on the token like one of them. A photo has no transparent edge to crop to, so it
// becomes a centred disc, which reads as a portrait on a round token instead of a square over its
// printed name.

const iconSize = 288

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

// Scaled to fit a square of `size`, never enlarged.
export const fitWithin = (width: number, height: number, size: number): { readonly width: number; readonly height: number } => {
  const scale = Math.min(1, size / Math.max(width, height))
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

export const iconFromFile = async (file: Blob): Promise<string> => {
  const image = await decode(file)
  // Read the pixels at a working size first, so a phone photo is not scanned at full resolution.
  const work = fitWithin(image.naturalWidth, image.naturalHeight, iconSize * 4)
  const [source, read] = canvasOf(work.width, work.height)
  read.drawImage(image, 0, 0, work.width, work.height)
  const { data } = read.getImageData(0, 0, work.width, work.height)
  const alpha = (i: number) => data[i * 4 + 3] ?? 0
  if (hasTransparency(alpha, work.width * work.height)) {
    const box = visibleBounds(alpha, work.width, work.height)
    if (!box) throw new Error('empty image')
    const out = fitWithin(box.width, box.height, iconSize)
    const [canvas, context] = canvasOf(out.width, out.height)
    context.drawImage(source, box.x, box.y, box.width, box.height, 0, 0, out.width, out.height)
    return encode(canvas)
  }
  const side = Math.min(work.width, work.height)
  const out = Math.min(side, iconSize)
  const [canvas, context] = canvasOf(out, out)
  context.beginPath()
  context.arc(out / 2, out / 2, out / 2, 0, Math.PI * 2)
  context.clip()
  context.drawImage(source, (work.width - side) / 2, (work.height - side) / 2, side, side, 0, 0, out, out)
  return encode(canvas)
}
