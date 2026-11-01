import { font, motion, palette, radius, space, tokenMaterial, touch } from '../../ui/theme'

// Container queries settle the roster before paint. Measuring it after mount changes its
// number of columns and makes the open card, and every game below it, jump a second time.
export const HistoryStyles = () => <style>{`
  .history-count { color: ${palette.muted}; font: 16px/22px ${font.body.regular}; margin: 0; }
  .history-list { display: grid; gap: ${space.lg}px; min-width: 0; }
  .history-card {
    position: relative; isolation: isolate; min-width: 0; container: history-card / inline-size;
    background: ${palette.parchment}; border: 1px solid ${palette.parchmentShade};
    border-radius: ${radius.tile}px; color: ${palette.ink};
    font: 16px/22px ${font.body.regular}; scroll-margin-top: ${space.md}px;
    animation: history-appear ${motion.duration.mark}ms ${motion.css.ease};
    /* A long history skips layout, paint and image decoding for cards off screen, and keeps
       each card's real height once it has been seen. Nothing draws outside a card. */
    content-visibility: auto; contain-intrinsic-size: auto 200px;
  }
  .history-card[data-expanded="true"] { border-color: ${palette.accent}; }
  .history-summary {
    position: relative; width: 100%; display: grid; grid-template-columns: 60px minmax(0, 1fr) 20px;
    align-items: center; gap: ${space.lg}px; box-sizing: border-box; padding: ${space.lg}px ${space.xl}px;
    background: none; color: inherit; border: 0; border-radius: ${radius.tile}px;
    text-align: left; cursor: pointer; font: inherit; -webkit-tap-highlight-color: transparent;
    transition: background-color ${motion.duration.fade}ms ${motion.css.ease};
  }
  .history-summary:hover { background-color: ${palette.paperInset}; }
  .history-summary:active { background-color: ${palette.paperPressed}; }
  .history-summary:focus-visible { outline: 2px solid ${palette.ink}; outline-offset: -4px; }
  .history-heading { display: grid; gap: ${space.sm}px; min-width: 0; }
  .history-title-line { display: flex; flex-wrap: wrap; align-items: center; gap: ${space.sm}px ${space.lg}px; }
  .history-title { font: 28px/32px ${font.display.semibold}; overflow-wrap: anywhere; }
  .history-phase {
    display: inline-block; border-radius: ${radius.chipLabel}px; padding: 3px ${space.sm}px;
    font: 13px/18px ${font.body.bold}; color: ${palette.inkMuted}; background: ${palette.paperInset};
  }
  .history-metadata {
    display: flex; flex-wrap: wrap; align-items: center; gap: ${space.xs}px ${space.lg}px;
    color: ${palette.inkMuted}; font-size: 13px; line-height: 18px;
  }
  .history-meta-item { display: inline-flex; align-items: center; gap: ${space.xs}px; }
  .history-chevron { display: flex; transition: transform ${motion.duration.mark}ms ${motion.css.ease}; }
  .history-summary[aria-expanded="true"] .history-chevron { transform: rotate(180deg); }
  .history-card-footer {
    position: relative; display: flex; align-items: center; justify-content: space-between;
    flex-wrap: wrap; gap: ${space.sm}px ${space.lg}px; padding: 0 ${space.xl}px ${space.lg}px;
  }
  .history-previews[hidden] { display: none; }
  /* The tint tells the sides apart; a rule between them strands at the line start once evil wraps. */
  .history-previews { display: flex; flex-wrap: wrap; align-items: center; gap: ${space.xs}px ${space.xl}px; flex: 1 1 240px; min-width: 0; }
  .history-preview-side { display: flex; flex-wrap: wrap; align-items: center; gap: ${space.xs}px; max-width: 100%; }
  .history-preview-token { width: 36px; height: 40px; display: flex; align-items: center; flex-shrink: 0; }
  .history-preview-token[data-dead="true"] { filter: ${tokenMaterial.dead}; }
  .history-actions { display: flex; align-items: center; gap: ${space.sm}px; margin-left: auto; min-height: ${touch}px; }
  .history-failed { flex-basis: 100%; margin: 0; color: ${palette.danger}; font: 14px/19px ${font.body.bold}; text-align: right; }
  .history-details { position: relative; border-top: 1px solid ${palette.parchmentShade}; padding: ${space.xl}px; }
  .history-roster { display: grid; grid-template-columns: minmax(0, 1fr); gap: ${space.xl}px; animation: history-appear 160ms ease-out; }
  .history-details-footer {
    display: flex; justify-content: flex-end; margin-top: ${space.lg}px; padding-top: ${space.sm}px;
    border-top: 1px solid ${palette.parchmentShade};
  }
  .history-side { min-width: 0; }
  .history-side-title { display: flex; align-items: center; gap: ${space.md}px; margin: 0 0 ${space.lg}px; font: 24px/28px ${font.display.semibold}; }
  .history-side-title::after { content: ''; flex: 1; height: 1px; background: ${palette.parchmentShade}; }
  /* As many player columns as fit, up to three: two on a phone, so a short row leaves no empty
     half, and never so many on a wide card that a reminder breaks across lines. */
  .history-players {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, max(140px, (100% - ${2 * space.md}px) / 3)), 1fr));
    align-items: start; gap: ${space.lg}px ${space.md}px; list-style: none; margin: 0; padding: 0;
  }
  .history-player { display: grid; grid-template-columns: 44px minmax(0, 1fr); align-items: start; gap: ${space.sm}px; min-width: 0; }
  .history-player-text { display: grid; min-width: 0; overflow-wrap: anywhere; }
  .history-player-name { font: 16px/22px ${font.body.bold}; }
  .history-character-name { color: ${palette.inkMuted}; font-size: 14px; line-height: 19px; }
  .history-life { display: flex; align-items: center; gap: ${space.xs}px; margin-top: ${space.xxs}px; font-size: 12px; line-height: 16px; }
  .history-life-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
  .history-player-fact { margin-top: ${space.xxs}px; color: ${palette.inkMuted}; font-size: 12px; line-height: 16px; }
  /* Reminders take the cell's whole width, under the token, so a narrow column keeps each one on a line. */
  .history-reminders { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: ${space.xs}px; margin: 0; padding: 0; list-style: none; }
  .history-reminder {
    display: inline-flex; align-items: center; gap: ${space.xs}px; min-width: 0; max-width: 100%; box-sizing: border-box;
    padding: 1px ${space.sm}px 1px ${space.xxs}px; border-radius: 12px; background: ${palette.paperInset};
    font-size: 12px; line-height: 18px;
  }
  .history-note { padding-left: ${space.sm}px; font-style: italic; }
  .history-reminder > :first-child { flex-shrink: 0; }
  .history-reminder > span { min-width: 0; }
  .history-bluffs { margin-top: ${space.xl}px; padding-top: ${space.lg}px; border-top: 1px solid ${palette.parchmentShade}; }
  .history-bluffs-title { margin: 0 0 ${space.md}px; color: ${palette.inkMuted}; font: 13px/18px ${font.body.bold}; }
  .history-bluff-tokens { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: ${space.sm}px; max-width: 280px; margin: 0; padding: 0; list-style: none; }
  .history-bluff { display: flex; flex-direction: column; align-items: center; gap: ${space.sm}px; text-align: center; overflow-wrap: anywhere; font-size: 12px; line-height: 16px; min-width: 0; }
  .history-loose { grid-column: 1 / -1; }
  .history-muted { margin: 0; color: ${palette.inkMuted}; font-size: 13px; line-height: 18px; }
  .history-chronicle { margin-top: ${space.xl}px; }
  /* The chapters run down one column and then the next, so the story reads in order on any width. */
  .history-chapters { column-width: 260px; column-gap: ${space.xxl}px; }
  .history-chapter { break-inside: avoid; padding-bottom: ${space.lg}px; }
  .history-chapter-title { display: flex; align-items: center; gap: ${space.sm}px; margin: 0 0 ${space.sm}px; font: 19px/24px ${font.display.semibold}; }
  .history-facts { display: grid; gap: ${space.sm}px; margin: 0; padding: 0; list-style: none; }
  .history-fact { display: grid; grid-template-columns: 28px minmax(0, 1fr); align-items: start; gap: ${space.sm}px; font-size: 15px; line-height: 20px; }
  .history-fact-icon { display: flex; justify-content: center; }
  .history-fact-text { display: grid; min-width: 0; overflow-wrap: anywhere; padding-top: ${space.xxs}px; }
  .history-fact strong { font-family: ${font.body.bold}; font-weight: normal; }
  .history-fact-hands { color: ${palette.inkMuted}; font-size: 13px; line-height: 18px; }
  @container history-card (min-width: 520px) {
    .history-roster { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: ${space.xxl}px; }
  }
  @container history-card (min-width: 780px) {
    .history-roster[data-split-good="true"] { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); }
  }
  @container history-card (max-width: 519px) {
    .history-summary { grid-template-columns: 60px minmax(0, 1fr) 20px; padding: ${space.lg}px ${space.md}px; gap: ${space.sm}px; }
    .history-title { font-size: 24px; line-height: 28px; }
    .history-metadata { gap: ${space.xs}px ${space.md}px; }
    .history-metadata > span:first-child { flex-basis: 100%; }
    .history-card-footer { padding: 0 ${space.md}px ${space.md}px; }
    .history-previews { flex-basis: 100%; }
    .history-details { padding: ${space.lg}px; }
  }
  @keyframes history-appear { from { opacity: 0; } to { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) {
    .history-chevron { transition: none; }
    .history-card, .history-roster { animation-duration: ${motion.duration.fade}ms; }
  }
`}</style>
