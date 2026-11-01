// Checks that every relative inline link and image in the tracked Markdown names a file that
// exists and, when its #anchor points into Markdown, a heading there. Run from the repository root.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

// A file deleted but not yet staged is still listed, with nothing left to check.
const files = execFileSync('git', ['ls-files', '-z', '*.md'], { encoding: 'utf8' })
  .split('\0').filter((file) => file && existsSync(file))

// A file's lines with fenced code blanked out, since GitHub shows it as written. A fence closes on
// a run of its own character at least as long, alone on its line. A backtick fence's info string
// holds no backtick, so a line such as "```js``` is" opens nothing.
const prose = (file) => {
  let fence = ''
  return readFileSync(file, 'utf8').split('\n').map((line) => {
    const [, run, rest] = line.match(/^ {0,3}(`{3,}(?=[^`]*$)|~{3,})(.*)/) ?? []
    if (!fence && run) fence = run
    else if (fence && run?.startsWith(fence) && !rest.trim()) fence = ''
    else if (!fence) return line
    return ''
  })
}

// GitHub's anchor for a heading is its text in lower case, keeping only letters, digits, `_`, `-`
// and spaces, each space made a hyphen. A repeated anchor gets -1, -2 and so on.
const anchors = new Map()
const anchorsIn = (file) => {
  if (!anchors.has(file)) {
    const found = new Set()
    for (const line of prose(file)) {
      const heading = line.match(/^ {0,3}#{1,6}\s+(.*?)(?:\s+#+)?\s*$/)?.[1]
      if (!heading) continue
      const base = heading.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/<[^>]*>/g, '')
        .toLowerCase().replace(/[^\p{L}\p{M}\p{Nd}\p{Pc} -]/gu, '').replaceAll(' ', '-')
      let anchor = base
      for (let n = 1; found.has(anchor); n++) anchor = `${base}-${n}`
      found.add(anchor)
    }
    anchors.set(file, found)
  }
  return anchors.get(file)
}

let links = 0
const broken = []
for (const file of files) {
  // Brackets inside a code span are not a link. Link text may wrap onto the next line.
  const text = prose(file).join('\n').replace(/`[^`\n]*`/g, (span) => ' '.repeat(span.length))
  for (const match of text.matchAll(/\[[^\]]*\]\(\s*<?([^\s)>]+)/g)) {
    const target = match[1]
    if (/^([a-z][a-z\d+.-]*:|\/\/)/i.test(target)) continue
    links++
    const where = `${file}:${text.slice(0, match.index).split('\n').length}`
    // GitHub's own links to a heading percent-encode letters outside ASCII, so the anchor is
    // decoded like the path.
    let pathname, anchor
    try {
      [pathname, anchor] = target.split('#').map((part) => decodeURIComponent(part))
    } catch {
      broken.push(`${where}: ${target} holds a malformed percent escape`)
      continue
    }
    // GitHub resolves a link from the file that holds it, or from the root when it starts with `/`.
    const resolved = pathname
      ? path.join(target.startsWith('/') ? '.' : path.dirname(file), pathname)
      : file
    if (!existsSync(resolved)) broken.push(`${where}: ${target} names no file`)
    else if (anchor && resolved.endsWith('.md') && !anchorsIn(resolved).has(anchor)) {
      broken.push(`${where}: ${target} names no heading`)
    }
  }
}
for (const problem of broken) console.error(problem)
console.log(`Links: ${links - broken.length} of ${links} relative links in ${files.length} Markdown files resolve`)
if (broken.length) process.exitCode = 1
