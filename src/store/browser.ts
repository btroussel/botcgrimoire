// The browser's side of files: a file out and a file in. History and
// scripts both need them, so they live here below both (docs/app.md). The app is web only, so
// these reach the DOM directly and do nothing anywhere else; each fails quietly, since none of
// them is needed to run a game. File read failures reach the caller for an inline error.
import { Platform } from 'react-native'

export const isWeb = Platform.OS === 'web' && typeof document !== 'undefined' && typeof window !== 'undefined'

// A file out: a Blob behind an anchor click, the only way a page hands the browser a download.
export const downloadText = (fileName: string, text: string, mime = 'application/json'): void => {
  if (!isWeb) return
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoked after the click has been handed off; revoking in the same tick loses the download in Safari.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// A file in: a hidden input, clicked. Resolves to nothing when the picker is dismissed, so the
// caller has no error to show for a change of mind. Browsers without the `cancel` event leave
// the promise pending, which the caller treats the same as no file.
export const pickFile = (accept: string): Promise<File | undefined> =>
  new Promise((resolve) => {
    if (!isWeb) {
      resolve(undefined)
      return
    }
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.style.display = 'none'
    const done = (file: File | undefined) => {
      input.remove()
      resolve(file)
    }
    input.addEventListener('change', () => done(input.files?.[0]))
    input.addEventListener('cancel', () => done(undefined))
    document.body.appendChild(input)
    input.click()
  })

// A file in, read as text.
export const pickTextFile = async (accept = 'application/json,.json'): Promise<string | undefined> => {
  const file = await pickFile(accept)
  return file === undefined ? undefined : file.text()
}
