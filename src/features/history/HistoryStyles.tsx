import { font, hairline, motion, palette, radius, shadows, space, tokenMaterial, touch } from '../../ui/theme'

// Container queries settle the roster before paint. Measuring it after mount changes its
// number of columns and makes the page jump a second time.
// The timeline's rail: a phase's sun or moon sits on it, and each line's dot. Its column is as
// wide as a player's token, so the rail runs under the middle of the tokens above it and a name
// starts on the same edge in the players and in the days.
export const railMarker = 26
const railColumn = 36
const railGap = space.md
const railDot = 8
const railIndent = railColumn + railGap
// A voter's token in a vote's line.
export const voteToken = 16
// Nothing here is read smaller than this: the page is the one turned round to the table after a
// game, in the room the body face was chosen for.
const small = 'font-size: 14px; line-height: 20px'
const rule = `${hairline}px solid ${palette.parchmentShade}99`
const launch = '#3a2c22'

// The list, a game's page and the board's window each draw these rules, and the document keeps one copy.
export const HistoryStyles = () => <style href="grimoire-history" precedence="default">{`
  .history-count { color: ${palette.muted}; font: 16px/22px ${font.body.regular}; margin: 0; }
  .history-list { display: grid; gap: ${space.md}px; min-width: 0; }
  .history-group { display: grid; gap: ${space.sm}px; min-width: 0; }
  .history-group-title { margin: ${space.xs}px ${space.xs}px 0; color: ${palette.muted}; font: 14px/20px ${font.body.bold}; font-weight: normal; }
  /* A month's name starts with a small letter in most languages, and a heading with a capital. */
  .history-group-title::first-letter { text-transform: uppercase; }
  .history-sheet {
    position: relative; isolation: isolate; min-width: 0; overflow: hidden;
    background: ${palette.parchment}; border: 1px solid ${palette.parchmentShade};
    border-radius: ${radius.tile}px; color: ${palette.ink};
    animation: history-appear ${motion.duration.mark}ms ${motion.css.ease};
  }
  .history-rows { position: relative; list-style: none; margin: 0; padding: 0; }
  /* A link and, beside it, one action: never a button inside the link. */
  .history-row {
    display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; column-gap: ${space.sm}px;
    padding-right: ${space.md}px; scroll-margin: ${space.md}px;
  }
  .history-row + .history-row { border-top: 1px solid ${palette.parchmentShade}; }
  .history-row-link {
    display: grid; grid-template-columns: 40px minmax(0, 1fr); align-items: center; gap: ${space.md}px;
    box-sizing: border-box; min-height: 84px; padding: ${space.md}px 0 ${space.md}px ${space.md}px;
    color: inherit; text-decoration: none; font: 16px/22px ${font.body.regular};
    border-radius: ${radius.tile}px; cursor: pointer; -webkit-tap-highlight-color: transparent;
    transition: background-color ${motion.duration.fade}ms ${motion.css.ease};
  }
  .history-row-link:hover { background-color: ${palette.paperInset}; }
  .history-row-link:active { background-color: ${palette.paperPressed}; }
  .history-row-link:focus-visible { outline: 2px solid ${palette.ink}; outline-offset: -4px; }
  .history-row-text { display: grid; min-width: 0; }
  .history-row-title { font-family: ${font.body.bold}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .history-row-line { display: flex; align-items: center; gap: ${space.sm}px; min-width: 0; color: ${palette.inkMuted}; ${small}; }
  /* The winner is a word in its side's colour, on the bare paper: a wash under it costs contrast. */
  .history-row-state { flex-shrink: 0; font-family: ${font.body.bold}; white-space: nowrap; }
  .history-row-state[data-progress="true"] { padding: 0 ${space.sm}px; border-radius: ${radius.chipLabel}px; background: ${palette.paperPressed}; color: ${palette.inkMuted}; }
  .history-row-when, .history-row-names { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .history-row-names { color: ${palette.inkMuted}; ${small}; }
  .history-launch {
    display: flex; align-items: center; justify-content: center; box-sizing: border-box; width: ${touch}px; height: ${touch}px;
    margin: 0; padding: 0; background: none; border: 1px solid ${palette.parchmentShade}; border-radius: ${radius.control}px;
    cursor: pointer; -webkit-tap-highlight-color: transparent;
  }
  .history-launch:hover { background-color: ${palette.paperInset}; }
  .history-launch:active { background-color: ${palette.paperPressed}; }
  .history-launch[data-primary="true"] { background: ${launch}; border-color: ${launch}; box-shadow: ${shadows.ticket}; }
  .history-launch[data-primary="true"]:active { background: ${palette.ink}; box-shadow: ${shadows.ticketPressed}; }
  .history-launch:focus-visible { outline: 2px solid ${palette.ink}; outline-offset: 2px; }
  .history-launch:disabled { opacity: ${motion.disabledOpacity}; cursor: default; }
  .history-failed { grid-column: 1 / -1; margin: 0 0 ${space.md}px ${space.md}px; color: ${palette.danger}; font: 14px/20px ${font.body.bold}; }

  /* A game's page: the result, the players, the days and nights, one under the other. */
  .history-game { min-width: 0; container: history-card / inline-size; color: ${palette.ink}; font: 16px/22px ${font.body.regular}; outline: none; }
  .history-game .history-failed { margin: ${space.sm}px 0 0; }
  .history-result { display: grid; grid-template-columns: 56px minmax(0, 1fr); align-items: center; gap: ${space.md}px; }
  .history-result-text { display: grid; min-width: 0; }
  .history-result-text p { margin: 0; }
  .history-result-state { font: 28px/32px ${font.display.semibold}; overflow-wrap: anywhere; }
  .history-result-meta { color: ${palette.inkMuted}; ${small}; }
  .history-actions { display: flex; gap: ${space.sm}px; max-width: 420px; margin-top: ${space.md}px; }
  /* The titled rule every section of a paper page gets. */
  .history-section-title {
    display: flex; align-items: center; gap: ${space.md}px; margin: ${space.xl}px 0 ${space.xs}px;
    color: ${palette.inkMuted}; font: 24px/28px ${font.display.semibold}; font-weight: normal;
  }
  .history-section-title::after { content: ''; flex: 1; height: 1px; background: ${palette.parchmentShade}; }
  .history-game-footer {
    display: flex; justify-content: flex-end; margin-top: ${space.lg}px; padding-top: ${space.xs}px;
    border-top: 1px solid ${palette.parchmentShade};
  }

  .history-sides { display: grid; grid-template-columns: minmax(0, 1fr); gap: ${space.sm}px ${space.xxl}px; animation: history-appear 160ms ease-out; }
  .history-side { min-width: 0; }
  .history-side-title { display: flex; align-items: baseline; gap: ${space.sm}px; margin: ${space.sm}px 0 ${space.xxs}px; font: 20px/26px ${font.display.semibold}; font-weight: normal; }
  .history-side-count { color: ${palette.inkMuted}; font: 14px/20px ${font.body.regular}; font-variant-numeric: tabular-nums; }
  /* One column on a phone, read top to bottom, and as many as fit a wide side. Each row draws
     its rule above itself and the list cuts off the first one, so every column starts clean.
     Only the top is cut: a token's shadow falls outside the list on the other three sides. */
  .history-players {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr)); column-gap: ${space.xl}px;
    clip-path: inset(0 -${space.xl}px -${space.xl}px -${space.xl}px); list-style: none; margin: 0; padding: 0;
  }
  .history-player {
    display: grid; grid-template-columns: ${railColumn}px minmax(0, 1fr); align-items: center; column-gap: ${railGap}px;
    min-width: 0; margin-top: -${hairline}px; padding: 6px 0 7px; border-top: ${rule};
  }
  .history-player-text { display: grid; min-width: 0; }
  /* The death keeps the end of the name's line, however long the name: the name wraps under itself. */
  .history-player-line { display: flex; align-items: baseline; justify-content: space-between; gap: ${space.md}px; }
  .history-player-name { min-width: 0; overflow-wrap: anywhere; font-family: ${font.body.bold}; }
  .history-fate { display: inline-flex; align-items: center; gap: ${space.xs}px; flex-shrink: 0; align-self: flex-start; font-size: 14px; line-height: 22px; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .history-player-role { display: flex; flex-wrap: wrap; align-items: center; gap: ${space.xxs}px ${space.sm}px; color: ${palette.inkMuted}; ${small}; overflow-wrap: anywhere; }
  .history-player-fact { color: ${palette.inkMuted}; ${small}; }
  .history-reminders { display: flex; flex-wrap: wrap; gap: ${space.xs}px; min-width: 0; margin: 0; padding: 0; list-style: none; }
  .history-reminder {
    display: inline-flex; align-items: center; gap: ${space.xs}px; min-width: 0; max-width: 100%; box-sizing: border-box;
    padding: 1px 9px 1px 3px; border-radius: 12px; background: ${palette.paperInset}; color: ${palette.ink};
    ${small};
  }
  .history-note { padding-left: 9px; font-style: italic; }
  .history-reminder > :first-child { flex-shrink: 0; }
  .history-reminder > span { min-width: 0; }
  .history-bluffs, .history-loose { margin-top: ${space.sm}px; padding-top: ${space.md}px; border-top: 1px solid ${palette.parchmentShade}; }
  .history-bluffs-title { margin: 0 0 ${space.sm}px; color: ${palette.inkMuted}; font: 14px/20px ${font.body.bold}; font-weight: normal; }
  .history-bluff-tokens { display: flex; flex-wrap: wrap; gap: ${space.sm}px ${space.lg}px; margin: 0; padding: 0; list-style: none; }
  .history-bluff { display: inline-flex; align-items: center; gap: 6px; min-width: 0; overflow-wrap: anywhere; ${small}; }
  .history-loose { grid-column: 1 / -1; }
  .history-muted { margin: 0; color: ${palette.inkMuted}; ${small}; }

  /* The board's window is not a page, so it sets the text the page would. */
  .history-log { color: ${palette.ink}; font: 16px/22px ${font.body.regular}; }
  .history-log .history-chapter:last-child { padding-bottom: 0; }
  /* The chapters run down one column and then the next, so the story reads in order on any width. */
  .history-chapters { column-width: 280px; column-gap: ${space.xxl}px; padding-top: ${space.sm}px; }
  /* A rail runs down each phase from its sun or moon, and every line hangs off it by a dot, so
     the game reads as one thread and a phase needs no box to stand apart. */
  .history-chapter { position: relative; break-inside: avoid; padding-bottom: ${space.md}px; }
  .history-chapter::before {
    content: ''; position: absolute; left: ${railColumn / 2 - 1}px; top: ${railMarker + space.xs}px; bottom: ${space.xxs}px;
    width: 2px; background: ${palette.parchmentShade};
  }
  .history-chapter-title {
    display: grid; grid-template-columns: ${railColumn}px minmax(0, 1fr); align-items: center; column-gap: ${railGap}px;
    margin: 0 0 ${space.xxs}px; font: 19px/${railMarker}px ${font.display.semibold}; font-weight: normal;
  }
  .history-chapter-title > :first-child { justify-self: center; }
  /* The story ends on who won: a flag where the rail stops. */
  .history-ending { padding-bottom: 0; }
  .history-ending::before { display: none; }
  .history-flag { display: flex; align-items: center; justify-content: center; width: ${railMarker}px; height: ${railMarker}px; border-radius: 50%; background: ${palette.ink}; }
  .history-facts { display: grid; margin: 0 0 0 ${railIndent}px; padding: 0; list-style: none; }
  .history-fact { position: relative; display: flex; align-items: center; gap: ${space.sm}px; min-height: 34px; }
  .history-fact::before, .history-placed::before {
    content: ''; position: absolute; left: ${-(railIndent - railColumn / 2 + railDot / 2)}px; top: ${17 - railDot / 2}px;
    width: ${railDot}px; height: ${railDot}px; box-sizing: border-box; border-radius: 50%; background: ${palette.inkMuted};
  }
  /* A vote's dot stays beside its line when the names open under it. */
  .history-fact[data-vote]::before { top: ${touch / 2 - railDot / 2}px; }
  .history-fact-icon { display: flex; justify-content: center; flex-shrink: 0; width: 22px; }
  .history-fact-text { min-width: 0; overflow-wrap: anywhere; }
  .history-fact strong { font-family: ${font.body.bold}; font-weight: normal; }
  .history-vote { flex: 1; min-width: 0; }
  .history-vote-line { display: flex; align-items: center; gap: ${space.sm}px; min-height: ${touch}px; }
  summary.history-vote-line { cursor: pointer; list-style: none; border-radius: ${radius.chipLabel}px; -webkit-tap-highlight-color: transparent; }
  summary.history-vote-line::-webkit-details-marker { display: none; }
  summary.history-vote-line:focus-visible { outline: 2px solid ${palette.ink}; outline-offset: 2px; }
  .history-vote-names { min-width: 0; overflow-wrap: anywhere; }
  /* One row high, so the tokens that do not fit wrap out of sight whole. */
  .history-vote-tokens {
    display: flex; flex-wrap: wrap; justify-content: flex-end; align-content: flex-start; gap: 0 ${space.xxs}px;
    flex: 1 1 0; min-width: 0; height: ${voteToken}px; overflow: hidden;
  }
  /* The gap stands for the space between a tally and its word, in the languages that have none too. */
  .history-vote-count { display: flex; align-items: baseline; gap: 3px; flex-shrink: 0; white-space: nowrap; color: ${palette.inkMuted}; font-size: 14px; font-variant-numeric: tabular-nums; }
  .history-vote-count strong { color: ${palette.ink}; font-size: 16px; }
  .history-vote-chevron { display: flex; flex-shrink: 0; transition: transform ${motion.duration.mark}ms ${motion.css.ease}; }
  .history-vote[open] .history-vote-chevron { transform: rotate(180deg); }
  /* Columns as wide as a first name, three on a phone, so the tokens line up under each other.
     A longer name is cut short, never broken over two lines: its token and first letters still
     tell the voter, and the names in the vote's own line are in full. */
  .history-hands {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); gap: ${space.xs}px;
    margin: 0 0 ${space.sm}px; padding: 0; list-style: none; color: ${palette.inkMuted}; ${small};
  }
  .history-hand { display: flex; align-items: center; gap: 3px; min-width: 0; }
  .history-hand-token, .history-hand-skull { display: flex; flex-shrink: 0; align-items: center; }
  .history-hand-name { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .history-hand-token[data-ghost="true"] { filter: ${tokenMaterial.dead}; }
  .history-spoken { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  /* The reminders hang off the rail by an open dot, apart from what happened to a player. */
  .history-placed { position: relative; margin: 0 0 0 ${railIndent}px; padding: 5px 0; }
  .history-placed::before { top: ${16 - railDot / 2}px; background: ${palette.parchment}; border: 2px solid ${palette.inkMuted}; }
  @container history-card (min-width: 520px) {
    .history-sides { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  }
  @container history-card (min-width: 780px) {
    .history-sides[data-split-good="true"] { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); }
  }
  @keyframes history-appear { from { opacity: 0; } to { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) {
    .history-vote-chevron, .history-row-link { transition: none; }
    .history-sheet, .history-sides { animation-duration: ${motion.duration.fade}ms; }
  }
`}</style>
