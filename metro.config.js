// Metro is Expo's bundler. The asset plugin keeps exported paths free of characters the host
// redirects.
const { createHash } = require('node:crypto')
const path = require('node:path')
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)
config.transformer.assetPlugins.push(require.resolve('./tools/asset-paths.js'))

// Inline requires: a module runs when a screen first uses it, not when the bundle starts, so
// opening one screen does not pay for the others. Code that must run at page load belongs in a
// module the navigator reaches on its first render, as the service worker registration in
// ui/pwa.ts.
const defaults = config.transformer.getTransformOptions
config.transformer.getTransformOptions = async (...args) => {
  const options = await defaults(...args)
  return { ...options, transform: { ...options.transform, inlineRequires: true } }
}

// Module ids. Expo's default numbers modules in the order they are first reached, and an export
// builds the page's bundle and its static-rendering bundle at once on one counter, so the same
// sources could give a different bundle, and a new service-worker version would then update every
// installed app for nothing. A hash of the module's path is the same in any order. Expo writes
// modules in id order, which makes the compressed bundle about 6% larger. Two paths that hash
// alike stop the build; reading other bytes of the digest renumbers every module.
config.serializer.createModuleIdFactory = () => {
  const ids = new Map()
  const names = new Map()
  return (modulePath) => {
    if (!ids.has(modulePath)) {
      // A virtual module, or an optional dependency that did not resolve, comes by name.
      const name = path.isAbsolute(modulePath)
        ? path.relative(__dirname, modulePath).replaceAll(path.sep, '/')
        : modulePath
      const id = createHash('sha256').update(name).digest().readUInt32BE(0)
      if (names.has(id)) throw new Error(`${names.get(id)} and ${name} hash to module id ${id}`)
      names.set(id, name)
      ids.set(modulePath, id)
    }
    return ids.get(modulePath)
  }
}

module.exports = config
