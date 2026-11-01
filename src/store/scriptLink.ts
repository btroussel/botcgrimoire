// A custom script carried in a link (docs/store.md, Script links). The script
// file rides in the address fragment, which a browser never sends to the host, so sharing needs
// no server and opening the link works offline once the app is installed.
import type { CustomScript, CustomScriptItem } from '../content'
import { scriptFile } from '../content'

export const linkKey = '#script='

export const canLink = typeof CompressionStream === 'function' && typeof DecompressionStream === 'function'

const isEmbedded = (image: unknown): boolean =>
  (typeof image === 'string' ? [image] : Array.isArray(image) ? image : []).some((src) => typeof src === 'string' && src.startsWith('data:'))

const withoutArt = (item: CustomScriptItem): CustomScriptItem => {
  if (typeof item === 'string' || !('image' in item) || !isEmbedded(item.image)) return item
  const { image: _image, ...rest } = item
  return rest
}

// One embedded icon is tens of thousands of characters, past a chat message or a QR code, so a
// homebrew character travels without it and the receiving app draws its team's icon. A web
// address is short and stays.
export const hasEmbeddedArt = (script: CustomScript): boolean => script.items.some((item) => typeof item !== 'string' && 'image' in item && isEmbedded(item.image))

const deflate = async (bytes: Uint8Array): Promise<Uint8Array> =>
  new Uint8Array(await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer())

// A shared link inflates to a few kilobytes. One made by hand to inflate without end is refused
// at this size rather than filling the page's memory.
const maxFile = 5_000_000

const inflate = async (bytes: Uint8Array, format: CompressionFormat = 'deflate-raw'): Promise<Uint8Array> => {
  const reader = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream(format)).getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > maxFile) {
      await reader.cancel()
      throw new RangeError('a script link past the size limit')
    }
    chunks.push(value)
  }
  const file = new Uint8Array(size)
  let at = 0
  for (const chunk of chunks) {
    file.set(chunk, at)
    at += chunk.length
  }
  return file
}

// Base64url, so the fragment needs no escaping in a chat app or a QR code.
const toBase64url = (bytes: Uint8Array): string => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const fromBase64url = (text: string): Uint8Array =>
  Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

// The fragment for a script: its file form without embedded art, compact, deflated.
export const scriptFragment = async (script: CustomScript): Promise<string> => {
  const file = JSON.stringify(scriptFile(script).map(withoutArt))
  return linkKey + toBase64url(await deflate(new TextEncoder().encode(file)))
}

// The official Script Tool's link, which botcscripts.com makes too: the file gzipped, in base64,
// in a `script` query parameter that the tool escapes once and the address escapes again. It
// carries the whole script as ours does, so it opens offline.
const toolLink = /[?&]script=([\w%+/=-]+)/

const unescaped = (text: string): string => {
  let out = text
  for (let i = 0; i < 3 && out.includes('%'); i++) out = decodeURIComponent(out)
  return out
}

const utf8 = (bytes: Uint8Array): string => new TextDecoder('utf-8', { fatal: true }).decode(bytes)

// The file text a link carries, ours or the Script Tool's, from a whole address or the fragment
// alone, with whatever a message put around it, such as the full stop that ends a sentence;
// nothing when the text holds no script link. A link cut short rejects, so the caller can tell
// it from no link at all.
export const linkedScriptText = async (link: string): Promise<string | undefined> => {
  const at = link.indexOf(linkKey)
  if (at >= 0) {
    const payload = /^[\w-]*/.exec(link.slice(at + linkKey.length))?.[0] ?? ''
    return utf8(await inflate(fromBase64url(payload)))
  }
  const tool = toolLink.exec(link)?.[1]
  if (tool === undefined) return undefined
  return utf8(await inflate(fromBase64url(unescaped(tool).replace(/ /g, '+')), 'gzip'))
}
