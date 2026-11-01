// A custom script kept on this device (docs/app.md, Scripts). The file form is the official
// schema's array, so `script.items` is the file but for how it counts night positions; the
// record around it only says when it was last edited. A game embeds its own copy of the script,
// so editing or deleting one here never changes a game already played on it.
import type { CustomScript } from '../content'
import { scriptFile } from '../content'
import { randomId } from '../engine'

export type SavedScriptId = string & { readonly __brand: 'SavedScriptId' }

export interface SavedScript {
  readonly id: SavedScriptId
  readonly script: CustomScript
  readonly updatedAt: number
}

export const mintScriptId = (): SavedScriptId => randomId('s', 10) as SavedScriptId

// The file form, the official schema's array as other tools read it.
export const serializeScript = (script: CustomScript): string => JSON.stringify(scriptFile(script), null, 2)
