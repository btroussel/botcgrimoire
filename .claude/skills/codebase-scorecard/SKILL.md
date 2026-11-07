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

Keep it short. Each subagent returns one or two sentences on its group (what works, what holds it
back), then one section per category with at most three findings, the most severe first:

```markdown
### <Category>: <grade>/10
- [blocker|major|minor] <finding> (<evidence>)

Next step: <the change that would gain the most, left out at 10>
```

The report has three parts, in this order: the table of grades, a description per group, then
the sections per category. A group's grade is the mean of its categories and the global grade the
mean of all categories, both to one decimal.

```markdown
# Scorecard: <project>

| Group | Category | Grade |
| --- | --- | --- |
| Code | Architecture and layers | 9.5 |
| **Code** | | **8.4** |
| **Global** | | **7.9** |

Lowest: <category> (<grade>)

## Summary

**Code (8.4).** <one or two sentences>

**UI (8.0).** <one or two sentences>

## Details

### <Category>: <grade>/10
...
```
