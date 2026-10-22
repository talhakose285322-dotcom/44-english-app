import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';

const required = ['dist/index.html', 'dist/icon.svg', 'dist/icons', 'dist/manifest.json', 'dist/vendor/pdfjs', 'dist/native-auth-bridge.js'];
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
assert.ok(packageJson.scripts['configure:android'], 'Android deep-link configuration command must exist');
const manifestScript = readFileSync('scripts/configure-android-deeplink.mjs', 'utf8');
assert.ok(manifestScript.includes('android:scheme="com.words44.app"'), 'Android manifest script must register the OAuth scheme');
assert.ok(manifestScript.includes('android:host="auth"'), 'Android manifest script must constrain the OAuth host');
for (const path of required) assert.ok(existsSync(path), `Missing staged runtime asset: ${path}`);

const html = readFileSync('dist/index.html', 'utf8');
assert.ok(html.includes('!window.Capacitor?.isNativePlatform?.()'), 'Native build must guard PWA service-worker registration');
assert.ok(html.includes('signInWithOAuth'), 'Existing account flow should remain in the staged app');
assert.ok(html.includes('./native-auth-bridge.js'), 'Native staging must load the bundled OAuth bridge');
assert.ok(html.includes('Words44NativeAuth.startGoogleSignIn(c)'), 'Android Google sign-in must use the native bridge');

const manifest = JSON.parse(readFileSync('dist/manifest.json', 'utf8'));
assert.equal(manifest.short_name, 'Words 44', 'Manifest short name must remain Words 44');
assert.equal(manifest.display, 'standalone', 'PWA manifest should preserve standalone display');

assert.ok(statSync('dist/vendor/pdfjs').isDirectory(), 'PDF.js runtime directory must be copied');
const bridge = readFileSync('dist/native-auth-bridge.js', 'utf8');
assert.ok(bridge.includes('appUrlOpen'), 'Bundled native bridge must listen for deep-link callbacks');
assert.ok(bridge.includes('exchangeCodeForSession'), 'Bundled native bridge must exchange the PKCE code');
console.log('Native staging smoke tests passed. These checks do not validate Android compilation or OAuth on a device.');
