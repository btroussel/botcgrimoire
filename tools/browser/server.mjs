import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'

const { createTestHarness } = createRequire(import.meta.url)('wrangler')

// Run the production routing rules. Only the worker script varies between test releases;
// a proxy is needed because browsers fetch worker updates outside Playwright's routing.
const host = createTestHarness({ workers: [{ configPath: './wrangler.jsonc' }] })
await host.listen()
const original = await readFile(new URL('../../dist/sw.js', import.meta.url), 'utf8')
let release = 'v1'
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1:4173')
    if (url.pathname === '/__test__/ready') { response.end('ready'); return }
    if (url.pathname === '/__test__/release' && request.method === 'POST') {
      const next = url.searchParams.get('version')
      if (!['v1', 'v2', 'broken'].includes(next)) {
        response.writeHead(400); response.end(); return
      }
      release = next
      response.end(release); return
    }
    if (url.pathname === '/sw.js') {
      let script = original.replace(/\$\{CACHE_PREFIX\}[^`]+/, '${CACHE_PREFIX}' + release)
      if (release === 'broken') script = script.replace('const PRECACHE = [',
        'const PRECACHE = [{"url":"/__test__/missing.js","hash":"' + '0'.repeat(64) + '"},')
      response.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' })
      response.end(script); return
    }
    if (url.pathname === '/__test__/missing.js') { response.writeHead(503); response.end(); return }
    const result = await host.fetch(url, { method: request.method, headers: request.headers, redirect: 'manual' })
    const headers = Object.fromEntries(result.headers)
    delete headers['content-length']
    delete headers['content-encoding']
    response.writeHead(result.status, headers)
    response.end(Buffer.from(await result.arrayBuffer()))
  } catch (error) {
    console.error(error)
    response.writeHead(500); response.end(String(error))
  }
})
server.listen(4173, '127.0.0.1')
const stop = async () => { server.closeAllConnections(); server.close(); await host.close() }
process.once('SIGTERM', stop)
process.once('SIGINT', stop)
