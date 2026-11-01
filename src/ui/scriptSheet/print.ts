// Print is the browser's paper, not a palette: white and black whatever the setting.
const print = { paper: '#ffffff', ink: '#000000' } as const

export const printCss = `
.script-jinx-markers, .script-reference-title, .script-count-table { display: none; }
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
  /* The first team after the Demons, Travellers, Fabled or Loric, starts the second page. */
  #script-sheet-block-demon + [id^="script-sheet-block-"], #script-sheet-references { break-before: page; }
  [id^="script-sheet-column-"] { width: 50% !important; }
  [id^="script-sheet-jinx-"] { break-inside: avoid; }
  #script-sheet-jinxes > :first-child { break-after: avoid; }
  [id^="script-sheet-row-"] { width: 100% !important; break-inside: avoid; }
  #script-sheet-head { padding: 0 0 3mm !important; }
  #script-sheet-head > div { gap: 3mm !important; }
  #script-sheet-logo, #script-sheet-logo * { width: 16mm !important; height: 12mm !important; }
  #script-sheet-title { font-size: 14pt !important; line-height: 1.2 !important; }
  #script-sheet-author { font-size: 9pt !important; line-height: 1.2 !important; }
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
  #script-sheet-team-townsfolk [id^="script-sheet-name-"],
  #script-sheet-team-outsider [id^="script-sheet-name-"] { color: #00689b !important; }
  #script-sheet-team-minion [id^="script-sheet-name-"],
  #script-sheet-team-demon [id^="script-sheet-name-"] { color: #8b1616 !important; }
  #script-sheet-references {
    display: grid !important;
    grid-template-columns: 32mm minmax(0, 1fr) 32mm;
    grid-template-rows: auto auto 1fr auto;
    column-gap: 4mm;
    min-height: 275mm;
    align-items: start;
  }
  #script-sheet .script-reference-title { display: block; grid-column: 2; grid-row: 1; text-align: center; font-size: 15pt; padding-bottom: 6mm; }
  #script-sheet .script-reference-title small { display: block; font-size: 8pt; margin-top: 1mm; }
  #script-sheet-nights { display: contents !important; }
  #script-sheet-nights > div { grid-row: 1 / 5; min-width: 0; max-width: 100% !important; gap: 3mm !important; }
  #script-sheet-nights > div:first-child { grid-column: 1; padding-right: 2mm; border-right: 0.3mm solid #d5cec5; }
  #script-sheet-nights > div:last-child { grid-column: 3; padding-left: 2mm; border-left: 0.3mm solid #d5cec5; }
  #script-sheet-nights > div > :first-child { font-size: 10pt !important; line-height: 1.15 !important; }
  #script-sheet-nights > div > div { gap: 1mm !important; }
  #script-sheet-nights > div > div > div { min-height: 8mm !important; gap: 1mm !important; }
  #script-sheet-nights [dir="auto"] { font-size: 7.5pt !important; line-height: 1.15 !important; }
  #script-sheet-nights > div > div > div > div:first-child,
  #script-sheet-nights > div > div > div > div:first-child *,
  #script-sheet-nights img { width: 7mm !important; height: 7mm !important; }
  #script-sheet-jinxes { grid-column: 2; grid-row: 2; padding: 0 0 5mm !important; gap: 3mm !important; }
  #script-sheet-counts { grid-column: 2; grid-row: 4; padding: 5mm 0 0 !important; }
  #script-sheet-counts-screen { display: none !important; }
  #script-sheet .script-count-table { display: table !important; width: calc(100% + 8mm); margin-left: -4mm; table-layout: fixed; border-collapse: collapse; font-size: 8.5pt; line-height: 1.2; }
  #script-sheet .script-count-table th, #script-sheet .script-count-table td { height: 5.5mm; padding: 0.4mm 0; box-sizing: border-box; border: 0.2mm solid #9b8872; text-align: center; font-weight: normal; }
  #script-sheet .script-count-table th:first-child { width: 25mm; text-align: left; padding-left: 1.5mm; }
  #script-sheet .script-count-table thead th { font-weight: bold; }
  #script-sheet-jinxes > [id^="script-sheet-jinx-"] { gap: 2mm !important; }

  #script-sheet-jinxes [dir="auto"] { font-size: 9pt !important; line-height: 1.2 !important; }
  #script-sheet-footnote { font-size: 8pt !important; line-height: 1.15 !important; padding: 2mm 0 0 !important; }

}
`


// Measure the actual translated lines at the fixed A4 print width. Text and icons shrink
// together, down to 8 pt; an unusually large script then continues onto another page.
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
    const available = 275 * 96 / 25.4 // Reserve 6 mm of the printable A4 height for the footnote.
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
