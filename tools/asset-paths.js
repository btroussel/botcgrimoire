// Metro asset plugin. The host redirects any path that encodeURIComponent would spell
// differently, so a font under node_modules/@expo-google-fonts would cost a round trip before
// its bytes. The export writes each asset to the path its URL names, so dropping the scope's `@`
// moves both. The development server keeps Metro's own asset URLs.
module.exports = (asset) => asset.httpServerLocation.includes('?export_path=')
  ? { ...asset, httpServerLocation: asset.httpServerLocation.replaceAll('/@', '/') }
  : asset
