---
name: codebase-scorecard
description: Grades the running app first as a Storyteller's tool at a real table (game flow, UX, UI and motion), then its performance and code foundations, with one subagent per group, and replies with a scorecard of its current state. Use when asked to review, audit, grade or score the overall quality of the app or the codebase. Not for a single diff or pull request.
---

# App scorecard

Review the whole app and codebase as they are, not recent commits or diffs. The app is judged
first as the tool a Storyteller runs a live game from: a phone in one hand, in a dim room, walking
around a table, with players close enough to see the screen. Code matters only as far as it keeps
that experience working.

Grade each category out of 10, to one decimal. Start from the anchor that matches the worst
findings, then move within the band by how many there are and how much they cost:

| Grade | Anchor |
| --- | --- |
| 10 | Nothing worth changing |
| 8 | Minor findings only |
| 6 | One major finding |
| 4 | Several major findings |
| 2 | A blocker |
| 0 | Missing or broken |

A blocker stops a game, leaks a role or loses data. A major finding slows the table or misleads the
Storyteller often. A minor one is local friction. Be precise: every finding cites a screenshot with
its screen and width, a counted sequence of taps, a command and its output, or an exact
`file:line`, and gives numbers where it can (taps, milliseconds, pixels, contrast ratios,
kilobytes). A finding is graded once, in the category that owns it.

## Groups

Each category has one sentence saying what it means, then how to measure it. The bracket names
the source of the criterion: a general one, or this project's own rule.

### Game: running a real game

Play a full game as the Storyteller on a phone width: a Trouble Brewing game at 10 seats, from
setup to End game, over at least two nights and two days, then the same on a custom or homebrew
script. Judge against the paper grimoire and [docs/app.md](../../../docs/app.md).

- **Setup** [project]: getting from Home to the first night with a chosen script, seat count and
  bag, by draw, deal or discovery, is quick and never blocked by a rule. Measure: taps and screens
  from Home to "first night started", and any choice the app refuses.
- **Night** [project, Storyteller advice]: the Storyteller can follow the night order and record
  each step (who woke, reminders, a card shown) one-handed while walking, without losing their
  place. Measure: taps per night step, and whether the next step to run is obvious after an
  interruption.
- **Day and vote** [project]: nominations, raised hands, ghost votes, the threshold and the marked
  nominee keep up with a live table and never need a correction afterwards. Measure: taps for one
  nomination with 10 voters, and whether the count shown matches the hands recorded.
- **Secrecy** [project, Storyteller advice]: nothing a player is handed or can glance at reveals a
  role or alignment that player should not know. Measure: try discovery, the draw, every card, the
  back gesture, quick hides and a glance at the board during a vote, and record any frame that
  shows a hidden role.
- **Grimoire fidelity** [project, Nielsen 2 "match with the real world"]: the board shows
  everything the paper grimoire does (alive or dead, ghost vote, reminders such as poisoned or
  drunk, bluffs, Travellers and Fabled) as legibly, and adds nothing the table lacks. Measure: list
  each piece of paper state and whether it is visible on the board without opening anything.
- **Manual coverage** [project, AGENTS.md]: any character's consequence, bundled or homebrew, can
  be recorded with the shared controls, and the app never resolves, filters or decides anything
  itself. Measure: record the outcome of hard cases (Pit-Hag, Barber, Summoner, Boffin, Drunk,
  Marionette, a Traveller exile, a homebrew character) and note any that cannot be recorded or are
  automated.
- **Mistakes and recovery** [Nielsen 3, 5 and 9, Storyteller advice]: a wrong tap or a forgotten
  step is fixed in one move, a destructive action asks first, and history or replay shows what
  happened. Measure: taps to undo each frequent edit, and which actions can lose work without a
  prompt.

### UX: practicality

General usability criteria, applied to every screen and journey, not only the game.

- **Interaction cost** [NN/g interaction cost, Hick's law]: every frequent task takes the fewest
  moves its decisions allow, with no extra screen, scroll, confirmation or choice. Measure: a table
  of taps per task against the minimum (one tap per real decision) for: mark dead or alive, spend a
  ghost vote, add, move and remove a reminder, change a character, show a card, nominate and vote,
  next phase, undo, and open the night order at the current step. Each excess tap on a frequent
  task is a finding.
- **Reach and touch** [Fitts's law, Hoober thumb zone, WCAG 2.5.8]: frequent controls are big and
  sit within thumb reach of a phone held in one hand, and rare or destructive ones sit apart.
  Measure: target sizes (44 points or more, [docs/ui.md](../../../docs/ui.md#controls)), which
  frequent controls sit in the top third or a corner at 390 px wide, and gaps between neighbours.
- **Status at a glance** [Nielsen 1]: the phase, day or night number, who is alive, an open
  nomination and the effect of the last tap are visible without opening anything. Measure: for
  each, whether it shows on the board and how long a reader needs to find it.
- **Recognition over recall** [Nielsen 6]: what the Storyteller needs (abilities, reminders, the
  night order, the script) is on screen when needed, so nothing has to be remembered from another
  screen. Measure: moments in the game where the Storyteller must leave the board to look
  something up.
- **Consistency** [Nielsen 4, Pinelle et al. "consistent responses"]: the same gesture, word and
  position mean the same thing everywhere, and editions and custom scripts behave alike. Measure:
  list controls that act differently in different places for the same thing.
- **Learnability** [Nielsen 10, Pinelle et al. "instructions and help"]: a Storyteller who knows the
  paper game runs a first game without instructions, and the less common controls are
  discoverable. Measure: controls you only find by accident (long press, drag, hidden menus) and
  whether anything tells you they exist.
- **Texts and translations** [project]: wording is short, clear and consistent, sounds like the
  game, and holds up in every bundled locale. Measure: unclear or inconsistent strings, and labels
  that clip or wrap badly in the longest locale.

### UI: design and motion

In the running app at 320, 390, 768 and 1280 px wide, portrait and landscape.

- **Visual identity and hierarchy** [project, Nielsen 8 "aesthetic and minimalist design"]: one
  look that matches the physical grimoire, where the board and the art dominate, chrome stays
  minimal and every style comes from the shared theme. Measure: elements that compete with the
  tokens, and styles that do not come from `theme.ts` or a shared component.
- **Legibility in the dark** [WCAG 1.4.3 and 1.4.11, project]: text and tokens read at arm's length
  in a dim room, and the screen does not glare. Measure: contrast ratios (4.5:1 for text, 3:1 for
  icons and borders), the smallest text size used for ability text, and bright areas on the board.
- **Motion** [project, WCAG 2.2.2 and 2.3.3, common motion guidelines]: animation explains a change
  of state, stays short (about 100 to 150 ms for a press, 200 to 300 ms for a menu, 300 to 500 ms
  for a drawer or window, exits shorter than entrances), never delays an accepted tap or hides the
  current state, and reduced motion keeps only short fades. The three show moments (revealing a
  token, the deal, the win) may run longer but never block. Measure: durations from a performance
  trace or a recording, state changes that snap, and what changes with reduced motion turned on.
- **Responsive layout** [project]: every screen works at every width and orientation, with no
  overflow, clipped text, covered seat or jump when a drawer, menu or keyboard opens. Measure:
  screenshots per screen and width, with each defect marked.
- **Accessibility** [WCAG 2.2 AA]: keyboard, focus, screen reader names, contrast and target size
  meet WCAG 2.2 AA. Measure: failed success criteria by number, from a keyboard pass and an axe or
  Lighthouse run.

### Performance: on the production build

With 4x CPU throttling and a slow 4G profile in Chromium.

- **Load and offline** [Core Web Vitals, project]: the app opens fast and every route works with
  the network off once loaded. Measure: LCP (good under 2.5 s), CLS (under 0.1), transferred
  kilobytes on first load, and each route reloaded offline.
- **Responsiveness** [Nielsen response time limits, Core Web Vitals]: every tap shows feedback
  within 100 ms and the board stays as fast at the end of a long game as at the start. Measure: INP
  (good under 200 ms) for the frequent tasks, early in a game and after 200 edits.

### Code: foundations

From reading the code, kept to what protects the game.

- **Saved games** [project]: a game survives reloads, crashes, app updates and saves from older
  versions, and bad input never corrupts it. Measure: load an old save, kill the tab mid-edit,
  import a malformed script, and cite any path in `src/store/` that can lose an event.
- **Guardrails and compliance** [project, AGENTS.md]: tests, types, lint and CI catch the costly
  mistakes, the docs match the code, and the code keeps the project's rules. Measure: risks in the
  categories above that no test covers, and any rule from AGENTS.md the code breaks.

## Steps

1. Build and serve the production app in the background, as [docs/ci.md](../../../docs/ci.md)
   says, and wait until it answers. If it will not start, mark Game, UX, UI and Performance n/a.
2. Launch one `general-purpose` subagent per group, all in a single message so they run in
   parallel. Give each its group's categories from above, the app URL, a temporary folder outside
   the repository for screenshots, and these rules: read only, evidence for every finding, answer
   in the format below.
3. Check each grade against its anchor and findings, then compute the means.
4. Give the report in the reply, without saving it to a file, and stop the server.

## Format

Each subagent returns, per category, its grade, the count of findings by severity, and at most
three findings, the most severe first, each with the fix that would gain the most:

```markdown
### <Category>: <grade>/10 (<blockers>/<majors>/<minors>)
- [blocker|major|minor] <finding> (<evidence>). Fix: <one line>
```

The Game and UX subagents also return the table of taps per task: task, taps, minimum.

The report has three parts: a grid of grades with one column per group, the taps table, then the
findings to fix first. A group's grade is the mean of its categories, to one decimal. The global
grade weighs the groups by what comes first: Game 30%, UX 25%, UI 25%, Performance 10%, Code 10%;
a group marked n/a drops out and the other weights scale up. Use short category names in the grid
and bold grades under 7. "Fix first" holds every blocker and major finding, then the minor findings
that would gain the most, up to eight items, ranked by severity and then by gain.

```markdown
# <project>: <global>/10

| Game <g> | UX <g> | UI <g> | Performance <g> | Code <g> |
| --- | --- | --- | --- | --- |
| Setup <g> | Interaction cost <g> | Identity <g> | Load and offline <g> | Saved games <g> |
| Night <g> | Reach <g> | Legibility <g> | Responsiveness <g> | Guardrails <g> |
| Day and vote <g> | Status <g> | Motion <g> | | |
| Secrecy <g> | Recognition <g> | Responsive <g> | | |
| Fidelity <g> | Consistency <g> | Accessibility <g> | | |
| Coverage <g> | Learnability <g> | | | |
| Recovery <g> | Texts <g> | | | |

| Task | Taps | Minimum |
| --- | --- | --- |
| <task> | <n> | <n> |

## Fix first

1. **<finding>.** <Severity>, <category> (<evidence>). <fix>
2. ...
```

## Sources

- [Nielsen's 10 usability heuristics](https://www.nngroup.com/articles/ten-usability-heuristics/)
- [Nielsen's response time limits](https://www.nngroup.com/articles/response-times-3-important-limits/)
- [Interaction cost](https://www.nngroup.com/articles/interaction-cost-definition/)
- [Laws of UX](https://lawsofux.com/): Fitts's law, Hick's law
- [Hoober, how we hold our gadgets](https://alistapart.com/article/how-we-hold-our-gadgets/)
- Pinelle, Wong and Stach, Heuristic evaluation for games, CHI 2008
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [Core Web Vitals](https://web.dev/articles/vitals)
- [Storyteller advice](https://wiki.bloodontheclocktower.com/Storyteller_Advice)
- The project's own rules: [AGENTS.md](../../../AGENTS.md), [docs/app.md](../../../docs/app.md),
  [docs/ui.md](../../../docs/ui.md), [docs/model.md](../../../docs/model.md)
