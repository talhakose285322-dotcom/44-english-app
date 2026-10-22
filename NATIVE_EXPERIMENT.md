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
