// The IndexedDB database: one database, two object stores, `games` keyed by id and `settings`
// with the preferences, the saved lists and the editors' drafts under their own keys (docs/store.md). Each game is written whole; a log is a few kilobytes
// and partial writes would be machinery for its own sake.
import type { SavedScript, SavedScriptId } from './customScripts'
import type { SavedCharacter } from './homebrew'
import { scriptWithCurrentWake, withCurrentWake, withHomebrew } from './homebrew'
import type { GameId, SavedGame } from './saved'
import { deserialize, migrate, mintGameId, serialize } from './saved'
import { startsWith } from './session'
import type { Settings } from './settings'

// Not 'botc-grimoire': the app this one replaced at botcgrimoire.com left a database of that
// name, at another version and with other stores, in returning browsers.
const DB_NAME = 'botcgrimoire'
const DB_VERSION = 1
const SETTINGS_KEY = 'settings'
// The custom scripts live as one list under their own key in the settings store: a script is a
// few dozen ids, a Storyteller keeps a handful, and a third object store would mean a database
// version for a list that fits in one write. The Storyteller's own characters are the same kind
// of list; an image is a few tens of kilobytes, so even dozens of them are still one write.
const SCRIPTS_KEY = 'scripts'
const CHARACTERS_KEY = 'characters'

// How long an older version kept a deleted game before purging it.
export const PURGE_AFTER_MS = 30 * 24 * 60 * 60 * 1000

const request = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

const done = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })

let opening: Promise<IDBDatabase> | undefined

const openDb = (): Promise<IDBDatabase> => {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('games')) db.createObjectStore('games', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return opening
}

// For tests, which replace the database between runs.
export const closeDb = async () => {
  if (!opening) return
  const db = await opening
  db.close()
  opening = undefined
}

let persistenceAsked = false

// Ask the browser once to keep the games, scripts and characters out of storage eviction, on the
// first write of any of them: someone who only writes scripts needs it as much. A refusal
// changes nothing.
const askPersistence = () => {
  if (persistenceAsked) return
  persistenceAsked = true
  if (typeof navigator !== 'undefined' && navigator.storage?.persist) void navigator.storage.persist().catch(() => false)
}

export const putGame = async (game: SavedGame): Promise<void> => {
  const db = await openDb()
  const tx = db.transaction('games', 'readwrite')
  tx.objectStore('games').put(game)
  await done(tx)
  askPersistence()
}

// The write of a game a window holds open. Windows of the app share this database and each
// writes a game whole, so a window still holding an older copy must not put it back. The write
// is refused when the stored copy is no longer `seen`, the one this window last read or wrote,
// and either this copy's log does not begin with the stored log, so writing would drop events
// another window added, or the game is gone, deleted in another window. A refusal writes
// nothing and returns the stored copy, or null for a deleted game, for the window to take and
// replay its own new edits onto.
export const putGameOver = async (game: SavedGame, seen: SavedGame | undefined): Promise<SavedGame | null | undefined> => {
  const db = await openDb()
  const tx = db.transaction('games', 'readwrite')
  const store = tx.objectStore('games')
  let refused: SavedGame | null | undefined
  // The put is made from the read's own callback, inside the same transaction, so no other
  // window's write can fall between the check and the write.
  const read = store.get(game.id)
  read.onsuccess = () => {
    const stored = read.result as SavedGame | undefined
    if (seen !== undefined && stored === undefined) refused = null
    else if (seen !== undefined && stored !== undefined && !sameRecord(stored, seen) && !startsWith(game.log, stored.log)) refused = stored
    else store.put(game)
  }
  await done(tx)
  if (refused === undefined) askPersistence()
  return refused
}

// Whole records, as the database returns them: a few kilobytes, compared once per write.
export const sameRecord = (a: SavedGame, b: SavedGame): boolean => JSON.stringify(a) === JSON.stringify(b)

export const getGame = async (id: GameId): Promise<SavedGame | undefined> => {
  const db = await openDb()
  const raw = await request(db.transaction('games').objectStore('games').get(id))
  if (raw === undefined) return undefined
  const game = migrate(raw)
  // Loading migrated it; write it back so the next open is a straight read.
  if ((raw as { version?: number }).version !== game.version) await putGame(game)
  return game
}

// Every game but those an older version flagged deleted, newest first. Games that fail to migrate
// are skipped here and left in place, so a bug in the app cannot lose a log.
export const listGames = async (): Promise<readonly SavedGame[]> => {
  const db = await openDb()
  const all = await request(db.transaction('games').objectStore('games').getAll())
  const games: SavedGame[] = []
  for (const raw of all) {
    try {
      const game = migrate(raw)
      if (game.deletedAt === undefined) games.push(game)
    } catch {
      // kept as is, invisible until a later version can read it
    }
  }
  return games.sort((a, b) => b.updatedAt - a.updatedAt)
}

export const deleteGame = async (id: GameId): Promise<void> => {
  const db = await openDb()
  const tx = db.transaction('games', 'readwrite')
  tx.objectStore('games').delete(id)
  await done(tx)
}

// Older versions kept deleted records for thirty days. Finish that cleanup without
// exposing a restore path or retaining newly deleted games.
export const purgeDeleted = async (now: number): Promise<number> => {
  const db = await openDb()
  const all = await request(db.transaction('games').objectStore('games').getAll())
  const gone = (all as SavedGame[]).filter((g) => g.deletedAt !== undefined && now - g.deletedAt > PURGE_AFTER_MS)
  if (gone.length === 0) return 0
  const tx = db.transaction('games', 'readwrite')
  for (const g of gone) tx.objectStore('games').delete(g.id)
  await done(tx)
  return gone.length
}

// Import keeps the file's id when the database has no such game, or the very same game (the
// same file imported twice is one game, and importing a deleted one restores it). A different
// game under that id is a copy from another device that went on being played, so the imported
// one gets a fresh id and both are kept.
export const importGame = async (text: string): Promise<GameId> => {
  const imported = deserialize(text)
  const existing = await getGame(imported.id)
  const game = existing && serialize(existing) !== serialize(imported) ? { ...imported, id: mintGameId() } : imported
  await putGame(game)
  return game.id
}

export const getSettings = async (): Promise<Partial<Settings> | undefined> => {
  const db = await openDb()
  return request(db.transaction('settings').objectStore('settings').get(SETTINGS_KEY))
}

export const putSettings = async (settings: Settings): Promise<void> => {
  const db = await openDb()
  const tx = db.transaction('settings', 'readwrite')
  tx.objectStore('settings').put(settings, SETTINGS_KEY)
  await done(tx)
}

const readList = async <T extends { readonly updatedAt: number }>(key: string): Promise<readonly T[]> => {
  const db = await openDb()
  const raw: unknown = await request(db.transaction('settings').objectStore('settings').get(key))
  return Array.isArray(raw) ? (raw as T[]).sort((a, b) => b.updatedAt - a.updatedAt) : []
}

// Read lists and write their replacements in one transaction, so two saves that overlap cannot
// each write a list as they found it and drop the other's change. The writes go out from the
// last read's callback: a transaction closes as soon as it has nothing left to do.
type Lists = readonly (readonly unknown[])[]
const updateLists = async (keys: readonly string[], change: (lists: Lists) => readonly (readonly unknown[] | undefined)[]): Promise<void> => {
  const db = await openDb()
  const tx = db.transaction('settings', 'readwrite')
  const store = tx.objectStore('settings')
  const lists: (readonly unknown[])[] = []
  keys.forEach((key, i) => {
    const req = store.get(key)
    req.onsuccess = () => {
      lists[i] = Array.isArray(req.result) ? req.result : []
      if (i === keys.length - 1) change(lists).forEach((list, j) => { if (list) store.put(list, keys[j]) })
    }
  })
  await done(tx)
  askPersistence()
}

// Through the wake migration, so a record from an older editor opens where it wakes now. It is
// written back with the next save.
const scriptsNow = (raw: readonly unknown[]): readonly SavedScript[] => (raw as readonly SavedScript[]).map((s) => {
  const script = scriptWithCurrentWake(s.script)
  return script === s.script ? s : { ...s, script }
})

const charactersNow = (raw: readonly unknown[]): readonly SavedCharacter[] => (raw as readonly SavedCharacter[]).map((c) => {
  const character = withCurrentWake(c.character)
  return character === c.character ? c : { ...c, character }
})

export const listScripts = async (): Promise<readonly SavedScript[]> => scriptsNow(await readList<SavedScript>(SCRIPTS_KEY))

// Saving under an id the list holds replaces that script; a new id joins the list.
export const putScript = (script: SavedScript): Promise<void> =>
  updateLists([SCRIPTS_KEY], ([scripts = []]) => [[script, ...scriptsNow(scripts).filter((s) => s.id !== script.id)]])

export const deleteScript = (id: SavedScriptId): Promise<void> =>
  updateLists([SCRIPTS_KEY], ([scripts = []]) => [scriptsNow(scripts).filter((s) => s.id !== id)])

export const listCharacters = async (): Promise<readonly SavedCharacter[]> => charactersNow(await readList<SavedCharacter>(CHARACTERS_KEY))

// A saved script carries a copy of each character it uses, so saving the character replaces that
// copy in the same write, and no script is left behind if the page closes in between.
export const putCharacter = (saved: SavedCharacter): Promise<void> =>
  updateLists([CHARACTERS_KEY, SCRIPTS_KEY], ([own = [], scripts = []]) => {
    const before = scriptsNow(scripts)
    const after = before.map((s) => {
      const script = withHomebrew(s.script, saved.character)
      return script === s.script ? s : { ...s, script }
    })
    return [
      [saved, ...charactersNow(own).filter((c) => c.character.id !== saved.character.id)],
      after.some((s, i) => s !== before[i]) ? after : undefined,
    ]
  })

export const deleteCharacter = (id: string): Promise<void> =>
  updateLists([CHARACTERS_KEY], ([own = []]) => [charactersNow(own).filter((c) => c.character.id !== id)])

// What each scripts-screen editor has written and not yet saved, kept as it changes so a reload,
// an automatic update or a closed tab gives it back. The screen that writes a draft reads it
// back and checks its shape; here it is only a value under its own key.
export type DraftSlot = 'script' | 'character'
const draftKey = (slot: DraftSlot) => `draft.${slot}`

export const getDraft = async (slot: DraftSlot): Promise<unknown> => {
  const db = await openDb()
  return request(db.transaction('settings').objectStore('settings').get(draftKey(slot)))
}

// Nothing to keep clears the slot.
export const putDraft = async (slot: DraftSlot, draft: unknown): Promise<void> => {
  const db = await openDb()
  const tx = db.transaction('settings', 'readwrite')
  if (draft === undefined) tx.objectStore('settings').delete(draftKey(slot))
  else tx.objectStore('settings').put(draft, draftKey(slot))
  await done(tx)
  askPersistence()
}
