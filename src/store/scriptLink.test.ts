import { deflateRawSync, gzipSync } from 'node:zlib'

import type { CustomScript, Homebrew } from '../content'
import { parseScript } from '../content'
import { serializeScript } from './customScripts'
import { hasEmbeddedArt, linkedScriptText, linkKey, scriptFragment } from './scriptLink'

const official: CustomScript = {
  kind: 'custom',
  name: 'Sample Script',
  items: [
    { id: '_meta', name: 'Sample Script', author: 'Élodie', logo: 'https://example.com/logo.png' },
    'washerwoman', 'librarian', 'investigator', 'chef', 'empath', 'fortuneteller', 'undertaker', 'monk', 'ravenkeeper',
    'virgin', 'slayer', 'soldier', 'mayor', 'butler', 'drunk', 'recluse', 'saint', 'poisoner', 'spy', 'scarletwoman',
    'baron', 'imp',
  ],
}

const brewer: Homebrew = {
  id: 'brewerx7k2', name: 'Brewer', team: 'townsfolk',
  ability: 'Each night, choose a player: you learn whether they are drunk or poisoned.',
  reminders: ['Chosen'], firstNight: 40.5, firstNightReminder: 'The Brewer points to a player.',
}

const withHomebrew = (image?: Homebrew['image']): CustomScript => ({
  ...official,
  items: [...official.items, image === undefined ? brewer : { ...brewer, image }],
})

const readBack = async (fragment: string) => JSON.parse((await linkedScriptText(`https://botcgrimoire.com/scripts${fragment}`))!)

describe('a script in a link', () => {
  test('an official script comes back as the same file and stays short enough for a chat message', async () => {
    const fragment = await scriptFragment(official)
    expect(fragment.startsWith(linkKey)).toBe(true)
    expect(fragment).toMatch(/^#script=[A-Za-z0-9_-]+$/)
    expect(fragment.length).toBeLessThan(400)
    const file = await readBack(fragment)
    expect(file).toEqual(official.items)
    expect(parseScript(file)).toEqual(official)
  })

  test('a homebrew character travels in full, without embedded art', async () => {
    const art = 'data:image/webp;base64,' + 'A'.repeat(20000)
    const script = withHomebrew(art)
    expect(hasEmbeddedArt(script)).toBe(true)
    const fragment = await scriptFragment(script)
    expect(fragment.length).toBeLessThan(1000)
    const file = await readBack(fragment)
    expect(file.at(-1)).toEqual({ ...brewer, firstNight: 41.5 })
    expect(parseScript(file)).toEqual(withHomebrew())
    expect(hasEmbeddedArt(withHomebrew([art, art]))).toBe(true)
  })

  test('a web address for art is short and stays', async () => {
    const script = withHomebrew('https://example.com/brewer.png')
    expect(hasEmbeddedArt(script)).toBe(false)
    expect((await readBack(await scriptFragment(script))).at(-1)).toEqual({ ...brewer, firstNight: 41.5, image: 'https://example.com/brewer.png' })
  })

  test('the fragment alone, or a link inside a message, reads the same', async () => {
    const fragment = await scriptFragment(official)
    expect(await linkedScriptText(fragment)).toBe(JSON.stringify(official.items))
    expect(await linkedScriptText(`  http://localhost:8081/scripts${fragment}\n`)).toBe(JSON.stringify(official.items))
    expect(await linkedScriptText(`Try this one: https://botcgrimoire.com/scripts${fragment}. See you Friday`)).toBe(JSON.stringify(official.items))
  })

  test('a link that inflates past any script is refused', async () => {
    const bomb = deflateRawSync(Buffer.alloc(6_000_000, 32)).toString('base64url')
    expect(bomb.length).toBeLessThan(10_000)
    await expect(linkedScriptText(`${linkKey}${bomb}`)).rejects.toThrow(RangeError)
  })

  test('a link without a script reads as nothing, and one cut short rejects', async () => {
    expect(await linkedScriptText('https://botcgrimoire.com/scripts')).toBeUndefined()
    expect(await linkedScriptText('')).toBeUndefined()
    const fragment = await scriptFragment(official)
    await expect(linkedScriptText(fragment.slice(0, fragment.length / 2))).rejects.toThrow()
    await expect(linkedScriptText(`${linkKey}not*base64`)).rejects.toThrow()
  })

  // The tool gzips the file, writes it in base64, escapes that, and the address escapes it again.
  test('a link from the official Script Tool or botcscripts.com reads as its file', async () => {
    const file = JSON.stringify(official.items)
    const address = new URL('https://script.bloodontheclocktower.com/')
    address.searchParams.append('script', encodeURIComponent(gzipSync(file).toString('base64')))
    expect(address.href).toMatch(/\?script=[\w%.-]+$/)
    expect(await linkedScriptText(address.href)).toBe(file)
    expect(await linkedScriptText(`Our next game: ${address.href}. See you there`)).toBe(file)
    await expect(linkedScriptText(address.href.slice(0, -40))).rejects.toThrow()
  })

  test('the exported file and the link carry the same items', async () => {
    expect(await linkedScriptText(await scriptFragment(official))).toBe(JSON.stringify(JSON.parse(serializeScript(official))))
  })
})
