# Words 44 native packaging experiment

This branch is intentionally separate from `main`. It adds only a Capacitor scaffold and a staging script; it does not modify the deployed web app.

## Build preparation

1. Install a current Node.js LTS release.
2. Run `npm install`.
3. Run `npm run build:native-web` to stage the existing app in `dist/`.
4. Run `npx cap add android` once, then `npm run cap:sync` and `npm run android`.

## Important limitations

- This is **not** a Play Store-ready app and no APK/AAB has been built or tested here.
- Android Studio and its Android SDK are required to compile and sign an Android package.
- Authentication redirects, local storage, PDF import, offline behavior, and cloud backup must be tested in a real emulator/device before release.
- The existing iPhone home-screen app and production web deployment are untouched.
- Do not merge this branch into `main` until the native build and core flows have been tested.

## Native Google sign-in is a release blocker

The current app calls Supabase OAuth with `redirectTo: location.origin + location.pathname` and relies on the browser URL for the PKCE callback. In a Capacitor Android WebView that origin is not the deployed website origin, so **Google sign-in must not be considered working in a native package yet**.

Before enabling sign-in in an APK/AAB, implement and test the native OAuth return flow using Capacitor's Browser/App plugins and a dedicated app URL scheme or verified HTTPS app link. Register that exact callback URL in Supabase Auth's allowed redirect URLs and configure the Android intent filter. The callback must return the PKCE code to the app and complete `exchangeCodeForSession`; do not place Supabase secret keys in the client. Keep the existing website redirect behavior unchanged.

## Data safety and migration

- Keep local-first use available; authentication should remain optional for basic study features.
- Never clear localStorage or IndexedDB during packaging, login changes, app updates, or migration.
- Test restore against a disposable account/dataset first; confirm a cloud restore cannot silently replace non-empty local data.
- A PWA installed from the old Netlify origin and an app opened from Cloudflare Pages are separate browser origins. They do not share origin storage or service-worker updates. Do not promise a cross-origin in-place update; provide an explicit, tested export/import or authenticated cloud-sync migration before asking users to switch.
- Release gate: build an Android package on a machine with Android Studio/SDK, install it on a physical device, and verify Google login/callback, logout, offline launch, PDF import, local persistence after update, and cloud backup/restore. This repository branch is scaffolding only until that gate passes.
