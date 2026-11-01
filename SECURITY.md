# Security

BotC Grimoire runs entirely in the browser. botcgrimoire.com serves static files, with no server
code, no account and no analytics script. Games, scripts, homebrew characters and settings stay in
the browser's storage on the device. A shared script link carries the script in the address
fragment, which the browser never sends to the host.

## Reporting a vulnerability

Report it privately, not in a public issue: use
[Report a vulnerability](https://github.com/btroussel/botcgrimoire/security/advisories/new) on the
repository's Security tab, or write to `contact@botcgrimoire.com`. Say what an attacker could do
and how to reproduce it, for example with the script file, link or QR code that triggers it.

Only the current version is supported. Fixes ship to botcgrimoire.com from `main`, and an
installed app takes them at its next update check.
