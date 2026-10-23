# Words 44 — Claude Code Handoff
Last updated: 2026-10-23 (Türkiye)

## Repository / source of truth
- GitHub: https://github.com/talhakose285322-dotcom/44-english-app
- Branch: `main`
- Current HEAD when this note was written: `bc4bbcf2103fde619b85a33cae81acb8279a0f76`
- Live app: https://44-english-app.pages.dev/
- Landing page: https://44-english-app.pages.dev/welcome.html
- Supabase project URL: https://pamebquqyvlzpznfrrvt.supabase.co

## Latest commits
- `bc4bbcf` Restrict desktop auth navigation to exact HTTPS origins.
- `ede99f6` Restrict desktop navigation to HTTPS trusted origins.
- `e579d59` Improve install guidance and direct checksum download.
Recent changes are mostly desktop navigation hardening and install/download instructions; they did NOT directly fix or prove the iPhone PWA update issue.

## CI / release status checked
- GitHub Actions test run `39939043593` on `bc4bbcf`: SUCCESS.
- Desktop installer workflow `39939043620` on `bc4bbcf`: SUCCESS.
- These results do not prove that Cloudflare Pages deployed the newest app or that the iPhone Home Screen PWA updated.
- Last known desktop release before this run: `desktop-v1.0.10-build.14`. Check Releases for a newer build before telling the user a new installer is available.
- The latest run for the Cloudflare/backup-site publish workflow needs checking; do not assume deployment succeeded without verifying the live asset/version.

## User's priorities (important)
1. Stop repeating tests/status reports without a meaningful product change. Make small, concrete improvements and commit them.
2. Immediate priority: diagnose and fix why the installed iPhone Home Screen app is not receiving the latest version. Verify the deployed HTML/version/cache headers/service worker and update path. Preserve local user data; do NOT tell the user to delete/reinstall the Home Screen app as a first step.
3. Fix iPhone Google OAuth return flow. PC Google login worked after recreating the Google OAuth web client, but iPhone sign-in/passkey/QR/return behavior remains unverified. Do not claim fixed without real-device verification.
4. Preserve existing UI and features; no redesign or broad refactor. Avoid unnecessary changes to `sw.js` / manifest unless root-cause evidence points there.
5. Protect cloud backup ownership and restore safety. Existing regression tests guard against account changes during save/restore; do not weaken them. Confirm actual Supabase RLS only if credentials/access are available; never expose secrets.
6. Get Words 44 ready for paid launch: dependable app/update/auth/data, then payment/subscription flow and customer acquisition. 100,000 LOC is not a goal by itself.
7. Report briefly and truthfully. Distinguish GitHub commit, successful CI, deployment, and real-device behavior. Do not claim one proves another.

## Known architecture / safety context
- Main app is largely in `index.html`; static build/tests are in `scripts/` and `.github/workflows/tests.yml`.
- PWA uses `manifest.json` and `sw.js`; local data includes localStorage keys `kelimelerim-v1`, `kelimelerim-v1-s`, `kelimelerim-v1-a`, plus IndexedDB `44-guvenlik`.
- Cloud backup table `cloud_backups` stores a text `data` payload; RLS and ownership checks matter. Cloud backup availability in the current deployed app must be checked in current source; do not assume local-only code is live.
- Desktop Electron source is in `desktop/main.cjs`; auth navigation currently allows the app origin and exact HTTPS origins `https://accounts.google.com` and `https://pamebquqyvlzpznfrrvt.supabase.co`.
- The app should remain usable without forcing a login unless existing product decisions/code explicitly require it.
- Do not put secrets, OAuth client secrets, service-role keys, or private user data in this handoff file.

## First concrete task for Claude Code
Inspect current source and latest deployment state, then fix the actual iPhone update path with the smallest safe change. Check what Cloudflare serves versus repository HEAD and current PWA cache/version logic. Only change cache/service-worker/manifest files if evidence supports it. Commit the fix and verify deployment/version separately. Then address the iPhone OAuth callback. Avoid broad scans and do not stop after merely proposing a plan.
