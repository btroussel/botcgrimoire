// Imports across src/ flow downward only.
const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

// Each layer names the folders it may not import.
const layers = {
  app: ['ui', 'store', 'engine', 'content'],
  features: ['app', 'features'],
  ui: ['app', 'features', 'store', 'engine'],
  store: ['app', 'features', 'ui'],
  engine: ['app', 'features', 'ui', 'store'],
  content: ['app', 'features', 'ui', 'store', 'engine'],
}

// A feature's folder has no subfolders, so `../name` inside one always reaches another feature.
const siblingFeature = { regex: '^\\.\\./[^.]', message: 'features/ may not import another feature' }

const layering = Object.entries(layers).map(([layer, banned]) => ({
  files: [`src/${layer}/**/*.{ts,tsx}`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          ...banned.flatMap((other) => [
            { group: [`**/src/${other}`, `**/src/${other}/*`], message: `${layer}/ may not import ${other}/` },
            { group: [`../${other}`, `../${other}/*`, `../../${other}`, `../../${other}/*`, `../../../${other}`, `../../../${other}/*`], message: `${layer}/ may not import ${other}/` },
          ]),
          ...(layer === 'features' ? [siblingFeature] : []),
        ],
      },
    ],
  },
}))

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', '.expo/*', '.claude/**', '.wrangler/**', 'test-results/**', 'src/content/generated/*'] },
  {
    files: ['tools/**/*.mjs', '*.config.js', '*.config.mts'],
    languageOptions: {
      globals: { Buffer: 'readonly', process: 'readonly', console: 'readonly', URL: 'readonly', __dirname: 'readonly', require: 'readonly', module: 'writable' },
    },
  },
  ...layering,
])
