import { createHash } from 'node:crypto'
import { readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../dist/', import.meta.url))
// The host cannot serve a file name holding `[` or `+`: it redirects to the percent-encoded
// URL forever. A dynamic route's template takes `_` (no game ID is one, see mintGameId), the
// not-found page the name the host serves for a missing route. public/_redirects and the
// service worker below name the same files. For the same reason app.json turns off Expo
// Router's async routes on the web, which would name script chunks after these route files.
for (const [from, to] of [
  ['game/[id]', 'game/_'], ['game/[id].html', 'game/_.html'],
  ['history/[id].html', 'history/_.html'], ['+not-found.html', '404.html'],
]) await rename(path.join(root, from), path.join(root, to))
// Each language's Home is exported under its own name, so its template serves nothing.
await rm(path.join(root, '[lang].html'))
// Expo's built-in pages bypass our navigator and its search metadata.
for (const file of ['404.html', '_sitemap.html']) {
  const location = path.join(root, file)
  const html = await readFile(location, 'utf8')
  await writeFile(location, html.replace('</head>', '<meta name="robots" content="noindex, follow"/></head>'))
}
// Include exported routes, the script, fonts and all art, even files never opened online. The
// search thumbnail is for crawlers only, so it stays out of the offline download.
const files = (await readdir(root, { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile())
  .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
  .filter((file) => !['sw.js', '_headers', '_redirects', 'search.jpg'].includes(file) && !file.endsWith('.map'))
  .sort()
const hash = createHash('sha256')
const template = await readFile(new URL('./service-worker.js', import.meta.url), 'utf8')
hash.update(template)
const precache = []
for (const file of files) {
  const bytes = await readFile(path.join(root, file))
  hash.update(file)
  hash.update(bytes)
  precache.push({ url: `/${file}`, hash: createHash('sha256').update(bytes).digest('hex') })
}
const version = hash.digest('hex').slice(0, 20)
await writeFile(path.join(root, 'sw.js'), template
  .replace('__VERSION__', version)
  .replace('/* __PRECACHE__ */ []', JSON.stringify(precache)))
console.log(`PWA: ${files.length} files precached, version ${version}`)
