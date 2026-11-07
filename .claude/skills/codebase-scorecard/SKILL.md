---
name: codebase-scorecard
description: Grades a whole codebase and its running app on four groups (code, UI, UX, performance and offline) with a 0 to 5 rubric, one subagent per group, and writes a dated scorecard to compare runs over time. Use when asked to review, audit, grade or score the overall quality of the codebase or the app. Not for reviewing a single diff or pull request.
---

# Codebase scorecard

A review that ends in grades you can compare from one run to the next. Each grade follows from
findings with evidence, so a change in score points at something that changed in the code.

## Groups and categories

| Group | Categories | Rubric | Needs the app |
| --- | --- | --- | --- |
| Code | Architecture and layers, Readability and simplicity, Robustness, Tests and guardrails, Documentation and compliance | [rubrics/code.md](rubrics/code.md) | No |
| UI | Visual identity, Design system, Responsive, Accessibility | [rubrics/ui.md](rubrics/ui.md) | Yes |
| UX | One per main user journey, Texts and translations | [rubrics/ux.md](rubrics/ux.md) | Yes |
| Performance | Performance and offline | [rubrics/performance.md](rubrics/performance.md) | Production build |

[project.md](project.md) holds what is specific to this repository: how to run the app, where
things live, the rules that count as findings, and the user journeys. When the skill moves to
another repository, rewrite that file and leave the rest alone.

## Scale

Every category gets a whole number from 0 to 5. The reviewer does not pick it by feel: it
classifies each finding, and the worst findings set the score.

| Severity | Meaning |
| --- | --- |
| Blocker | Stops a user from finishing a task, loses data, or makes a change unsafe to ship |
| Major | A cost paid often: a confusing step, a broken layer rule, a risky path with no test |
| Minor | Local friction or inconsistency |

| Score | Condition |
| --- | --- |
| 5 | No major finding, at most two minor ones, and a strength worth copying elsewhere |
| 4 | No major finding |
| 3 | One major finding, no blocker |
| 2 | Two or more major findings, no blocker |
| 1 | At least one blocker |
| 0 | The subject is missing or does not work at all |
| n/a | Could not be assessed, with the reason |

A finding without evidence (`file:line`, a command and its output, or a screenshot) does not
count. A group's score is the mean of its categories, the global score the mean of all
categories, both to one decimal. The report always shows the lowest category next to the global
score, since a mean hides it.

## Steps

1. **Scope.** All groups unless the user names some groups or categories.
2. **Context.** Read the project instructions (`AGENTS.md`, `CLAUDE.md`), the README and
   [project.md](project.md). Note the commit with `git rev-parse --short HEAD` and whether the
   working tree is clean. Do not open earlier reports yet: seeing old scores pulls new ones toward
   them.
3. **Run the app.** If UI, UX or Performance is in scope, install, build and serve it as
   project.md says, in the background, and wait until the URL answers. If it will not start, mark
   those groups n/a with the error rather than grading them from the code.
4. **Review.** Launch one `general-purpose` subagent per group in scope, all in the same message so
   they run in parallel, each with the prompt below.
5. **Check.** For each category, drop findings without evidence and recompute the score from the
   scale. If your score differs from the subagent's, keep yours and say why in one line.
6. **Compare.** Only now open the latest earlier report in `.claude/reviews/` and add a delta
   column. If a rubric file changed between the two runs (`git log` on this folder), say the
   scores of those categories are not comparable.
7. **Report.** Write `.claude/reviews/<YYYY-MM-DD>-<sha>.md` in the shape below, show the
   scorecard table in the reply, and stop the server you started.

Write the report in the language the user asked in.

## Subagent prompt

Fill the angle brackets.

```text
You review one group of a codebase scorecard for <repository path>. Read only: do not edit,
stage or commit tracked files. You may run the app, the project's check commands and Playwright.

Group: <group>
Rubric: <absolute path to rubrics/x.md>. Read it first.
Scale and severities: the "Scale" section of <absolute path to SKILL.md>.
Project notes: <absolute path to project.md>
App URL: <url, or "not needed">
Save screenshots to: <absolute path to .claude/reviews/<date>-<sha>/>

For each category of the rubric:
1. Inspect what the rubric lists: the code, and the running app where it says so.
2. List findings. Each has a severity, one sentence, and evidence: `file:line`, a command and
   its output, or a screenshot path. No evidence, no finding.
3. Name one strength, with evidence.
4. Give the score the scale yields from those findings.
5. Say what would raise the score by one.

Return one Markdown section per category:
### <Category>: <score>/5
Strength: <one line> (<evidence>)
- [blocker|major|minor] <finding> (<evidence>)
To reach <score + 1>: <one or two lines>
```

## Report

```markdown
# Scorecard: <project> at <sha>, <date>

| Group | Category | Score | Change | Main finding |
| --- | --- | --- | --- | --- |
| Code | Architecture and layers | 4 | +1 | ... |
| ... | | | | |
| **Code** | | **3.8** | | |
| ... | | | | |
| **Global** | | **3.9** | | Lowest: <category> (<score>) |

## <Group>

<the subagent sections, after your checks>
```
