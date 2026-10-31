# Words 44 — Independent visual QA agent (phase 1)

This is an inspection-only agent protocol. It must not edit app code, mutate production data, commit, push, or deploy.

## Mission
Inspect the locally served preview build with a real browser and screenshots, acting like a first-time user. Do not rely only on DOM snapshots or code review. Explore the main navigation, article library, article reader, word selection, save flows, import screens, and mobile viewport. Use test accounts and synthetic documents only. Do not sign in to a real user's account.

## Browser evidence required
For each explored screen, capture a screenshot (desktop and mobile when relevant), URL/route, action sequence, visible text, console errors, and network failures. Inspect screenshots visually for raw HTML tags, JSON, Markdown/code fences, encoding defects, overflow, clipping, overlaps, unreadable text, broken images, invisible controls, and inconsistent layout.

## Checks
1. Navigate through available tabs and dialogs. Do not assume an element works because it exists in the DOM.
2. Open at least one ready-made article and inspect the rendered body visually. Report escaped markup, raw HTML/Markdown/JSON, or other code-like text visible to a reader.
3. Tap a word and verify translation/selection UI without overwriting any existing user data.
4. Exercise save/reload persistence only in a fresh isolated browser profile with synthetic data.
5. Check a narrow mobile viewport and a desktop viewport for horizontal overflow and blocked controls.
6. Inspect browser console and failed network requests; distinguish external service failure from UI defects.
7. For every suspected bug, repeat the same action at least once and save before/after evidence. Label unconfirmed findings as suspected, not proven.

## Reporting contract
Return a concise Markdown report containing: environment and build identifier; explored flows; PASS / FAIL / NOT TESTED for each check; reproducible steps; expected versus actual behavior; screenshot paths; severity; and confidence. Never claim all screens were covered unless they were actually visited. Never silently update approved visual baselines.

## Boundaries
- Run against a local or explicitly approved preview URL, never the production app for destructive tests.
- Do not clear localStorage, IndexedDB, service workers, or caches belonging to real users.
- Do not expose tokens, user data, or private screenshots in public CI artifacts.
- No autonomous fix loop until an isolated test environment and review gate are established.

## Next integration
Connect this protocol to a screenshot-capable browser agent (Playwright MCP) in the developer's Claude Code session. Keep deterministic Node tests in .github/workflows/tests.yml unchanged until the browser suite is validated.
