import { font, palette } from '../theme'

// Print is the browser's paper, not a palette: white and black whatever the setting.
const print = { paper: '#ffffff', ink: '#000000' } as const

// The one colour left on paper: each team's words, its band, character names and count row, so a
// player finds the evil half of the sheet at a glance.
const teamInk = {
  townsfolk: '#00689b',
  outsider: '#00689b',
  minion: '#8b1616',
  demon: '#8b1616',
  traveller: palette.teamOnPaper.traveller,
  fabled: palette.teamOnPaper.fabled,
  loric: palette.teamOnPaper.loric,
} as const

const teamColours = Object.entries(teamInk)
  .map(([team, ink]) => [
    `#script-sheet-band-${team} [dir="auto"]`,
    `#script-sheet-team-${team} [id^="script-sheet-name-"]`,
    `#script-sheet-reference-${team} [role="heading"]`,
    `#script-sheet-reference-${team} [id^="script-sheet-refname-"]`,
    `#script-sheet .script-sheet-npc-${team} > span`,
    `#script-sheet tr.script-count-${team} > *`,
  ].join(', ') + ` { color: ${ink} !important; }`)
  .join('\n  ')

// The foot of every page holds the ownership line and the asterisk's meaning; the characters stop
// this far above the paper's printable bottom edge.
const footHeight = 7 // mm
const pageHeight = 281 // mm: A4 less the top and bottom margins

export const printCss = `
.script-jinx-markers, .script-reference-title, .script-count-table, .script-print-only, #script-sheet-page-foot { display: none; }
@media print {
  /* Leave printable margins without room for the browser's automatic header and footer. */
  @page { size: A4; margin: 8mm 12mm; }
  html, body { background: ${print.paper} !important; }
  * { overflow: visible !important; }
  body * { visibility: hidden; }
  #script-sheet, #script-sheet * { visibility: visible; }
  #script-sheet { position: absolute !important; top: 0; left: 0; width: 186mm; height: auto !important; background: ${print.paper} !important; }
  #script-sheet * { color: ${print.ink} !important; background-color: transparent !important; box-shadow: none !important; outline: none !important; }
  #script-sheet-scroll { flex: none !important; height: auto !important; }
  /* The unknown-id notice speaks to the Storyteller about this app, not to the players. */
  #script-sheet-toolbar, #script-sheet-footer, #script-sheet-notice, #script-sheet .paper-texture { display: none !important; }
  [id^="script-sheet-band-"] { position: static !important; break-after: avoid; }
  #script-sheet-references { break-before: page; }
  /* Travellers and Fabled print on the second page, so their bands leave the first. */
  #script-sheet:has(#script-sheet-references) :is(#script-sheet-block-traveller, #script-sheet-block-fabled) { display: none !important; }
  #script-sheet .script-print-only { display: block; }
  [id^="script-sheet-column-"] { width: 50% !important; }
  [id^="script-sheet-jinx-"] { break-inside: avoid; }
  #script-sheet-jinxes > :first-child { break-after: avoid; }
  [id^="script-sheet-row-"] { width: 100% !important; break-inside: avoid; }
  /* The logo and the title are the largest things on the paper: they tell a player which script
     they hold. */
  #script-sheet-head { padding: 0 0 4mm !important; }
  #script-sheet-head > div { gap: 5mm !important; }
  #script-sheet-logo, #script-sheet-logo * { width: 24mm !important; height: 24mm !important; }
  #script-sheet-title { font-size: 24pt !important; line-height: 1.1 !important; }
  #script-sheet-author { font-size: 11pt !important; line-height: 1.3 !important; }
  #script-sheet .script-sheet-npcs { display: flex; flex-direction: column; align-items: flex-end; align-self: flex-start; gap: 1.5mm; }
  .script-sheet-npcs > span { display: inline-flex; align-items: center; gap: 1.5mm; font-family: ${font.body.regular}; font-size: 9pt; }
  .script-sheet-npcs > span > :first-child, .script-sheet-npcs img { width: 7mm !important; height: 7mm !important; }
  #script-sheet .script-jinx-markers { display: inline-flex; align-items: center; gap: 0.5mm; }
  #script-sheet .script-jinx-markers img,
  #script-sheet .script-jinx-markers div { width: calc(4mm * var(--print-density, 1)) !important; height: calc(4mm * var(--print-density, 1)) !important; }
  [id^="script-sheet-band-"] { height: calc(7mm * var(--print-density, 1)) !important; padding: 0 !important; }
  [id^="script-sheet-band-"] > :nth-child(2),
  [id^="script-sheet-band-"] > div:last-child { border-top: 0.2mm solid #9b8872; }
  [id^="script-sheet-band-"] [dir="auto"] { font-size: 10pt !important; line-height: 1.1 !important; }
  [id^="script-sheet-team-"] { padding: 0 !important; }
  [id^="script-sheet-column-"]:first-child { padding-right: 3mm; }
  [id^="script-sheet-column-"]:last-child { padding-left: 3mm; }
  #script-sheet-team-fabled > div, #script-sheet-team-loric > div { width: 100% !important; padding: 0 !important; }
  [id^="script-sheet-row-"] > div { min-height: 0 !important; gap: 2mm !important; padding: calc(1.2mm * var(--print-density, 1)) 0 !important; }
  [id^="script-sheet-row-"] > div > :first-child,
  [id^="script-sheet-row-"] > div > :first-child > div,
  [id^="script-sheet-row-"] img { width: calc(15mm * var(--print-density, 1)) !important; height: calc(15mm * var(--print-density, 1)) !important; }
  [id^="script-sheet-row-"] > div > :nth-child(2),
  [id^="script-sheet-row-"] > div > :nth-child(2) > div { padding: 0 !important; gap: 0 !important; }
  [id^="script-sheet-name-"], [id^="script-sheet-ability-"], #script-sheet-rules [dir="auto"] { font-size: calc(10.5pt * var(--print-density, 1)) !important; line-height: 1.15 !important; }
  #script-sheet-rules { gap: 2mm !important; padding-top: 1mm !important; }
  ${teamColours}
  /* The night orders take the outer columns; everything else stacks between them, the count
     table at the foot. */
  #script-sheet-references {
    display: grid !important;
    grid-template-columns: 32mm minmax(0, 1fr) 32mm;
    grid-template-rows: 1fr auto;
    column-gap: 4mm;
    min-height: ${pageHeight - footHeight}mm;
    align-items: start;
  }
  #script-sheet-centre { grid-column: 2; grid-row: 1; min-width: 0; display: flex !important; flex-direction: column; gap: 5mm; }
  /* A plain element, so it names the sheet's faces itself rather than print in the browser's serif. */
  #script-sheet .script-reference-title { display: block; text-align: center; font-family: ${font.display.semibold}; font-size: 18pt; line-height: 1.15; padding-bottom: 1mm; }
  #script-sheet .script-reference-title small { display: block; font-family: ${font.body.regular}; font-size: 9pt; margin-top: 1mm; }
  #script-sheet-nights { display: contents !important; }
  #script-sheet-nights > div { grid-row: 1 / 3; min-width: 0; max-width: 100% !important; gap: 3mm !important; }
  #script-sheet-nights > div:first-child { grid-column: 1; padding-right: 2mm; border-right: 0.3mm solid #d5cec5; }
  #script-sheet-nights > div:last-child { grid-column: 3; padding-left: 2mm; border-left: 0.3mm solid #d5cec5; }
  #script-sheet-nights > div > :first-child { font-size: 10pt !important; line-height: 1.15 !important; }
  #script-sheet-nights > div > div { gap: 1mm !important; }
  #script-sheet-nights > div > div > div { min-height: 8mm !important; gap: 1mm !important; }
  #script-sheet-nights [dir="auto"] { font-size: 7.5pt !important; line-height: 1.15 !important; }
  #script-sheet-nights > div > div > div > div:first-child,
  #script-sheet-nights > div > div > div > div:first-child *,
  #script-sheet-nights img { width: 7mm !important; height: 7mm !important; }
  #script-sheet-jinxes { padding: 0 !important; gap: 3mm !important; }
  [id^="script-sheet-reference-"] { padding: 0 !important; gap: 2.5mm !important; break-inside: avoid; }
  [id^="script-sheet-reference-"] > div { gap: 2mm !important; }
  [id^="script-sheet-reference-"] > div > :first-child,
  [id^="script-sheet-reference-"] img { width: 9mm !important; height: 9mm !important; }
  #script-sheet-counts { grid-column: 2; grid-row: 2; padding: 5mm 0 0 !important; }
  #script-sheet-counts-screen { display: none !important; }
  /* The official sheet's table: a double gold frame, no inner rules, a row per team in its colour. */
  #script-sheet .script-count-table {
    display: table !important;
    margin: 0 auto;
    padding: 1.5mm 2.5mm;
    border: 0.8mm double ${palette.teamOnPaper.fabled};
    border-collapse: separate;
    border-spacing: 0;
    font-family: ${font.display.medium};
    font-size: 13pt;
    font-variant-numeric: lining-nums tabular-nums;
    line-height: 1.1;
  }
  #script-sheet .script-count-table th, #script-sheet .script-count-table td { min-width: 6mm; border: none; padding: 0.6mm 0.8mm; text-align: center; font-weight: normal; }
  #script-sheet .script-count-table th:first-child { text-align: right; padding-right: 3mm; font-size: 0.7em; letter-spacing: 0.08em; text-transform: uppercase; }
  #script-sheet .script-count-table thead th { color: ${palette.teamOnPaper.fabled} !important; }
  #script-sheet-jinxes > [id^="script-sheet-jinx-"] { gap: 2mm !important; }

  #script-sheet-jinxes [dir="auto"], [id^="script-sheet-reference-"] [dir="auto"] { font-size: 9pt !important; line-height: 1.2 !important; }
  /* Repeated at the foot of every page, so the asterisk is explained wherever it appears. */
  #script-sheet-footnote { display: none !important; }
  #script-sheet-page-foot {
    display: flex !important;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    justify-content: space-between;
    align-items: flex-end;
    gap: 8mm;
    font-family: ${font.body.regular};
    font-size: 6.5pt;
    line-height: 1.25;
  }
  #script-sheet #script-sheet-page-foot, #script-sheet #script-sheet-page-foot * { color: #666666 !important; }
  #script-sheet-page-foot > span + span { flex-shrink: 0; white-space: nowrap; }

}
`


// Measure the actual translated lines at the fixed A4 print width. Text and icons shrink
// together, down to 8 pt; an unusually large script then continues onto another page, and its
// first page fills to the bottom, where a row can meet the foot.
export const fitPrintedRoles = (): void => {
  const sheet = document.getElementById('script-sheet')
  if (!sheet) return
  const groups = sheet.querySelectorAll<HTMLElement>('#script-sheet-team-townsfolk, #script-sheet-team-outsider, #script-sheet-team-minion, #script-sheet-team-demon')
  const last = groups.item(groups.length - 1)
  if (!last) return
  // beforeprint can fire before the browser applies print media. Apply the same rules
  // synchronously for measurement, so the screen width cannot change the result.
  const measurement = document.createElement('style')
  measurement.textContent = printCss.replace('@media print', '@media all')
  document.head.appendChild(measurement)
  try {
    sheet.style.setProperty('--print-density', '1')
    const available = (pageHeight - footHeight) * 96 / 25.4
    let density = 1
    for (let attempt = 0; attempt < 8; attempt++) {
      const height = last.getBoundingClientRect().bottom - sheet.getBoundingClientRect().top
      if (height <= available || density <= 8 / 10.5) break
      density = Math.max(8 / 10.5, density * Math.min(0.98, available / height))
      sheet.style.setProperty('--print-density', String(density))
    }
  } finally {
    measurement.remove()
  }
}
