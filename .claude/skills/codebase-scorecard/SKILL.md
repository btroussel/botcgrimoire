---
name: codebase-scorecard
description: Grades the whole codebase and the running app on code, UI, UX and performance, with one subagent per group, and replies with a scorecard of its current state. Use when asked to review, audit, grade or score the overall quality of the codebase or the app. Not for a single diff or pull request.
---

# Codebase scorecard

Review the whole codebase and the whole app as they are, not recent commits or diffs.

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

A blocker stops a task or loses data, a major finding costs users or maintainers often, a minor
one is local friction. Be precise: every finding cites an exact `file:line`, a command and its
output, or a screenshot with its screen and width, and gives numbers where it can (lines, taps,
milliseconds, kilobytes).

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

1. If UI, UX or Performance is in scope, build and serve the production app in the background, as
   the project's docs say, and wait until it answers. If it will not start, mark those groups n/a.
2. Launch one `general-purpose` subagent per group, all in a single message so they run in
   parallel. Give each its group's categories from above, the app URL, a temporary folder outside
   the repository for screenshots, and these rules: read only, evidence for every finding, answer
   in the format below.
3. Check each grade against its anchor and findings, then compute the means.
4. Give the report in the reply, without saving it to a file, and stop the server.

## Format

Each subagent returns, per category, its grade and at most three findings, the most severe first,
each with the fix that would gain the most:

```markdown
### <Category>: <grade>/10
- [blocker|major|minor] <finding> (<evidence>). Fix: <one line>
```

The report has two parts: a grid of grades with one column per group, then the findings to fix
first. A group's grade is the mean of its categories and the global grade the mean of all
categories, both to one decimal. Use short category names in the grid and bold grades under 7.
"Fix first" holds every blocker and major finding, then the minor findings that would gain the
most, up to eight items, ranked by severity and then by gain.

```markdown
# <project>: <global>/10

| Code 8.3 | UI 8.0 | UX 7.2 | Performance 8.3 |
| --- | --- | --- | --- |
| Architecture 9.4 | Visual identity 9.5 | Home 8.6 | Performance and offline 8.3 |
| Readability **5.8** | Design system 8.4 | Setup 8.1 | |
| Robustness 8.2 | Responsive **6.2** | Game **5.6** | |
| Tests 8.5 | Accessibility 7.8 | Texts **6.4** | |
| Documentation 9.6 | | | |

## Fix first

1. **<finding>.** <Severity>, <category> (<evidence>). <fix>
2. ...
```
