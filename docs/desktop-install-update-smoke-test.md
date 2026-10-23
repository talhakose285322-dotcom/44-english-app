# Words 44 — Desktop installation and update smoke test

This checklist is for Chrome/Edge on Windows and macOS. It does not claim a native .exe/.dmg exists.

## Install
1. Open the published Words 44 application (not only the marketing page) in Chrome or Edge.
2. Use the browser's **Install app** command when offered.
3. Launch the installed window. Verify it opens without browser tabs and shows the same account and study data.
4. If install is not offered, use the web version; do not present a fake download link.

## Update
1. Record the version displayed in Profile and make a small, non-data-changing deployment.
2. Close and reopen the installed app while online. Allow the service worker to activate; if needed close all app windows and reopen.
3. Confirm the version changed and saved word lists and articles remain.
4. Repeat once offline: previously cached learning features should remain usable. Online dictionary, translation and sign-in may not work offline.

## Platform distinction
- Desktop PWA: installed through a compatible browser; app code updates from the deployed site.
- iPhone home-screen web app: installed via Safari Add to Home Screen; updates depend on iOS web-app cache/service-worker lifecycle.
- Android PWA: installed through compatible browser; updates depend on browser and service worker.
- App Store/Play Store packages: separate packaging, store review, release and update mechanisms. Do not claim store releases update automatically from a web deployment.

## Safety
Never clear localStorage, IndexedDB, caches or unregister the service worker merely to force an update without first preserving user data. Avoid changing existing UI or data schema for this smoke test.
