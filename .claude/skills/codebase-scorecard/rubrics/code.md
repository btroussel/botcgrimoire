# Code

Read the code; the app does not need to run. Start from the largest and most changed files
(`git ls-files | xargs wc -l | sort -n | tail`, `git log --format= --name-only | sort | uniq -c | sort -n | tail`):
that is where problems collect.

## Architecture and layers

- Modules follow the documented layers, imports flow one way, and a tool (lint, a test) enforces
  it rather than habit alone.
- Each module has one job. No file that everything imports and that does everything.
- Domain logic is separate from UI code and can be tested without rendering.

## Readability and simplicity

- Names say what a thing is. A function fits in your head on one read.
- No dead code, no abstraction with a single use, no copied blocks that drifted apart.
- Comments explain why, not what.
- Long UI components are split by concern, not left to grow screen by screen.

## Robustness

- State changes go through one path, and its invariants are checked or impossible to break.
- Saved data is versioned and migrated, and an old or corrupt record does not crash the app.
- Failures at the edges (storage, imported files, URLs) are handled and shown to the user.
- Untrusted input is validated before use.

## Tests and guardrails

- Run the project's quick check command and report whether it passes.
- Tests cover the logic that would hurt most if it were wrong, and check behavior, not
  implementation details.
- Types, lint and CI run on every change, and one local command reproduces CI.

## Documentation and compliance

- A newcomer can install, run and contribute from the docs alone.
- The docs record decisions and constraints. Pick three concrete claims and check them against
  the code.
- The code keeps the project's own rules (project.md lists them). Look for breaks in the area
  most likely to tempt one.
