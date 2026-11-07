---
name: codebase-scorecard
description: Scores the app on its UI and UX as a Storyteller running a real game uses it, then its performance and code, and replies with a scorecard. Use when asked to score the app, review the UI or UX, or grade the app's overall quality. Not for a single diff or pull request.
---

# App scorecard

Judge the app as it is, as the tool a Storyteller runs a live game from: a phone in one hand, a dim
room, players close enough to see the screen.

Grade each category out of 10, to one decimal, from the anchor that matches the worst findings,
then within the band by how many there are:

| Grade | Anchor |
| --- | --- |
| 10 | Nothing worth changing |
| 8 | Minor findings only |
| 6 | One major finding |
| 4 | Several major findings |
| 2 | A blocker |
| 0 | Missing or broken |

A blocker stops a game, leaks a role or loses data, a major finding slows the table or misleads the
Storyteller often, a minor one is local friction. Every finding cites a screenshot with its width, a
counted tap sequence, a command's output or a `file:line`, with numbers where it can.

## Groups

**Game**, playing a full 10-seat Trouble Brewing game over two nights and two days, then a homebrew
script:
- Setup: Home to the first night with a script, seats and bag is quick and never blocked.
- Night: the night order can be followed and each step recorded one-handed without losing your place.
- Day and vote: nominations, hands, ghost votes and the threshold keep up with a live table.
- Secrecy: nothing a player is handed or can glance at reveals a role they should not know.
- Fidelity: the board shows everything the paper grimoire does, as legibly, and nothing more.
- Coverage: any character's consequence can be recorded by hand, and nothing is automated.
- Recovery: a wrong tap or forgotten step is fixed in one move, and destructive actions ask first.

**UX**, on every screen:
- Interaction cost: each frequent task takes one tap per real decision, no extra screen or choice.
- Reach: frequent controls are 44 points or more and within thumb reach, rare ones set apart.
- Status: phase, who is alive, an open vote and the last change show without opening anything.
- Recognition: abilities, reminders and the night order are at hand, nothing to remember.
- Consistency: the same gesture and word mean the same everywhere, on editions and custom scripts.
- Learnability: a Storyteller who knows the paper game finds every control without instructions.
- Texts: wording is short, clear and consistent, and fits in every bundled locale.

**UI**, at 320, 390, 768 and 1280 px, portrait and landscape:
- Identity: one look true to the physical grimoire, the art first, styles from the shared theme.
- Legibility: text and tokens read at arm's length in a dim room, contrast 4.5:1 for text.
- Motion: animation explains a change, stays short (100 to 500 ms) and never delays a tap, and
  reduced motion keeps only fades.
- Responsive: no overflow, clipped text, covered seat or jump at any width.
- Accessibility: keyboard, focus, names, contrast and targets meet WCAG 2.2 AA.

**Performance**, on the production build with 4x CPU throttling:
- Load and offline: LCP under 2.5 s, and every route works offline once loaded.
- Responsiveness: a tap shows within 100 ms, still after 200 edits.

**Code**, from reading it:
- Saved games: a game survives reloads, crashes, updates, old saves and bad input.
- Guardrails: tests, lint and CI catch the costly mistakes, and the code keeps AGENTS.md.

## Steps

1. Build and serve the production app in the background, as `docs/ci.md` says. If it will not
   start, mark every group but Code n/a.
2. Go through the groups in order, read only, with screenshots in a temporary folder outside the
   repository. While playing, count taps against the minimum for the frequent tasks.
3. Check each grade against its anchor, compute the means, give the report in the reply and stop
   the server.

## Format

Note per category its grade and at most three findings, the worst first.

```markdown
### <Category>: <grade>/10
- [blocker|major|minor] <finding> (<evidence>). Fix: <one line>
```

The report opens with the global grade, the mean of all categories, then a grid with one column per
group headed by the group's mean, grades under 7 in bold. Then the taps table, then "Fix first":
every blocker and major finding, then the most useful minor ones, up to eight.

```markdown
# <project>: <global>/10

| Game <g> | UX <g> | UI <g> | Performance <g> | Code <g> |
| --- | --- | --- | --- | --- |
| Setup <g> | Interaction cost <g> | Identity <g> | Load and offline <g> | Saved games <g> |

| Task | Taps | Minimum |
| --- | --- | --- |

## Fix first

1. **<finding>.** <Severity>, <category> (<evidence>). <fix>
```
