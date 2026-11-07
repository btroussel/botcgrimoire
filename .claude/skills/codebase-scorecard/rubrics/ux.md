# UX

Grade the running app as its target user would meet it. project.md names the user and the main
journeys, and each journey is one category. Without project.md, pick the three journeys a new
user is most likely to take and name them in the report.

## Each journey

Walk it end to end at phone and desktop width. Count the steps, screenshot each one, and note every
place you hesitated or had to guess. Then check:

- The user can tell where they are and what just happened.
- The next step is visible. Nothing depends on memory or on a hidden gesture alone.
- Mistakes are hard to make and easy to undo. A destructive action asks first.
- Labels use the user's words, not the code's.
- Frequent actions are quick, and a returning user has shortcuts.

## Texts and translations

- Interface text is short, clear, and consistent in terms and tone.
- No text is hard-coded in components: every string goes through translations.
- Switch to two other languages, one with long words such as German or Finnish. Look for missing
  keys, truncation and broken layouts.
- Dates, numbers and plurals follow the locale.
