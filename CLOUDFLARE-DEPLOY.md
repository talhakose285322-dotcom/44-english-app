# Cloudflare Pages deployment

> **Migration status:** Do not treat Cloudflare as production until the deployed `pages.dev` site serves the current GitHub `main` commit and the production domain is verified. Keep Netlify available until that check passes. The existence of a `pages.dev` URL alone does not prove GitHub auto-deploy is connected.


Words 44 is a static PWA. This repository now includes a build script that creates a production-only `dist/` folder without changing the source app or the current Netlify setup.

## Cloudflare Pages settings

- **Connect repository:** `talhakose285322-dotcom/44-english-app`
- **Production branch:** `main`
- **Build command:** `node scripts/build-static.mjs`
- **Build output directory:** `dist`
- **Root directory:** leave blank (repository root)
- **Environment variables:** none required for the static build

The script copies only the app's runtime files (`index.html`, PWA manifest/service worker, icons, and PDF.js assets). It excludes tests, old backup HTML files, and other repository-only files from the deployed site.

## Safe migration order

1. Create a new Cloudflare Pages project connected to GitHub; do not change or delete the existing Netlify project.
2. Deploy `main` and test the generated `pages.dev` URL: app loads, install/PWA behavior works, PDF import works, Google login and cloud backup work.
3. Add the existing custom domain only after the preview is verified. Update DNS only when ready to switch.
4. Keep Netlify available until the new host and the production domain are confirmed working.

Cloudflare's Git integration creates preview deployments for pull requests. The app's Google OAuth redirect allowlist in Supabase must include the final production URL; temporary preview URLs may not be allowed. After switching domains, test Google sign-in on iPhone and desktop before announcing the migration.
