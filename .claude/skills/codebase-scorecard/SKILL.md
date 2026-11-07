---
name: codebase-scorecard
description: Grades the whole codebase and the running app on code, UI, UX and performance, with one subagent per group, and writes a scorecard of its current state. Use when asked to review, audit, grade or score the overall quality of the codebase or the app. Not for a single diff or pull request.
---

# Codebase scorecard

Grade each category from 0 to 5, whole numbers only. Every score cites evidence (`file:line`, a
command's output or a screenshot) and says what would raise it by one.

## Groups

**Code**, from reading the code:
- Architecture and layers: modules follow the documented layers and imports flow one way.
- Readability and simplicity: the code is easy to read and change, with nothing dead or needless.
- Robustness: state changes, saved data and bad input do not break the app.
- Tests and guardrails: tests, types, lint and CI catch the costly mistakes.
- Documentation and compliance: the docs help and match the code, and the code keeps the
  project's own rules (AGENTS.md).

**UI**, in the running app at phone, tablet and desktop widths:
- Visual identity: one consistent look that fits the product.
- Design system: shared tokens and components everywhere, no hard-coded styles.
- Responsive: every screen works at every width, with no overflow or clipped text.
- Accessibility: keyboard, labels, contrast and focus meet WCAG 2.2 AA.

**UX**, in the running app, as the target user:
- One category per main journey. Here: Home and onboarding, Game setup, and Game (board, night,
  day, vote).
- Texts and translations: clear, consistent wording that holds up in other languages.

**Performance**, on the production build:
- Performance and offline: fast load and interaction, and everything works offline once loaded.

## Steps

1. Note the commit (`git rev-parse --short HEAD`). Grade the code as it is now, without reading
   earlier reports.
2. If UI, UX or Performance is in scope, build and serve the production app in the background, as
   the project's docs say, and wait until it answers. If it will not start, mark those groups n/a.
3. Launch one `general-purpose` subagent per group, all in a single message so they run in
   parallel. Give each its group's categories from above, the app URL, a folder for screenshots,
   and these rules: read only, evidence for every finding, answer in the format below.
4. Check each score against its findings, then compute the means.
5. Write `.claude/reviews/<YYYY-MM-DD>-<sha>.md`, show the table in the reply, and stop the server.

## Format

Each subagent returns, per category:

```markdown
### <Category>: <score>/5
- [blocker|major|minor] <finding> (<evidence>)
To reach <score + 1>: <one line>
```

The report is the table, then the subagents' sections. A group's score is the mean of its
categories and the global score the mean of all categories, both to one decimal.

```markdown
# Scorecard: <project> at <sha>, <date>

| Group | Category | Score |
| --- | --- | --- |
| Code | Architecture and layers | 4 |
| **Code** | | **3.8** |
| **Global** | | **3.9** |

Lowest: <category> (<score>)
```
