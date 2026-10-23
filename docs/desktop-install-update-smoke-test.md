# Words 44 — Desktop installation and update smoke test

## Installer downloads
- Public release page: https://github.com/talhakose285322-dotcom/44-english-app/releases/latest
- Windows installer: https://github.com/talhakose285322-dotcom/44-english-app/releases/latest/download/Words44-Setup.exe
- macOS installer: https://github.com/talhakose285322-dotcom/44-english-app/releases/latest/download/Words44-macOS.dmg
- SHA-256 checksums are attached to each public release as `SHA256SUMS`.
- The desktop wrapper loads the hosted Words 44 app, so it requires an internet connection. It is not a fully offline native app.
- macOS packages are not Apple-signed/notarized yet and may trigger Gatekeeper warnings.

## Install
1. Download the package for the correct operating system from the public release page.
2. On Windows, run the `.exe` installer and follow the setup steps.
3. On macOS, open the `.dmg` and move/open Words 44 as macOS allows. If Gatekeeper blocks it, do not bypass security unless the publisher and file are trusted; Apple signing/notarization remains a distribution task.
4. Launch Words 44 and verify it opens without browser tabs.
5. Sign in if cloud account features are needed. Verify existing word lists and articles remain intact.

## Update
1. Download and install the newer release from the stable links above.
2. Launch the app while online and confirm it loads the latest hosted web app.
3. Confirm saved word lists and articles remain available.
4. Repeat offline: this desktop wrapper requires internet to load the app, so do not promise offline desktop use.

## Platform distinction
- Desktop wrapper: separate `.exe` / `.dmg` installer; web content loads from the production site and therefore updates as the hosted app changes.
- Desktop PWA: separately installable through a compatible browser.
- iPhone home-screen web app: installed via Safari Add to Home Screen; updates depend on iOS web-app cache/service-worker lifecycle.
- Android PWA: installed through a compatible browser; updates depend on browser and service worker.
- App Store/Play Store packages: separate packaging, store review, release and update mechanisms. Do not claim store releases update automatically from a web deployment.

## Safety
Never clear localStorage, IndexedDB, caches or unregister the service worker merely to force an update without first preserving user data. Do not alter existing app data schema or UI during installer smoke tests.
