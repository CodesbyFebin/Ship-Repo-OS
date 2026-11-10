# Contributing to ShipOS

Use Node.js 24, Bun 1.3.4, and Git. Install locked dependencies with `bun install --frozen-lockfile`, then follow the README's local setup.

- Keep the browser and CLI on the shared Workbench modules in `src/lib/shipos/workbench/`.
- Add a regression case for any false positive, incorrect transformation, or export conflict.
- Run `bun run test`, `bun run lint:workbench`, and `bun run typecheck` before opening a pull request.
- For UI changes, include a screenshot or recording and check narrow layouts. For media changes, check that the PNG stays below 1 MB and review the captions against the MP4.
- For generated content, distinguish observed facts, user-supplied details, and drafts.
