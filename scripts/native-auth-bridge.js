import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

const CALLBACK_PREFIX = 'com.words44.app://auth/callback';
let activeClient = null;
let callbackQueue = Promise.resolve();

async function getClient() {
  if (activeClient) return activeClient;
  if (typeof window.Words44GetAuthClient === 'function') {
    activeClient = await window.Words44GetAuthClient();
    return activeClient;
  }
  throw new Error('Words 44 auth client is not ready.');
}

async function handleCallback(rawUrl) {
  if (!rawUrl || !rawUrl.startsWith(CALLBACK_PREFIX)) return false;
  const url = new URL(rawUrl);
  const authError = url.searchParams.get('error_description') || url.searchParams.get('error');
  if (authError) throw new Error(authError);
  const code = url.searchParams.get('code');
  if (!code) throw new Error('Google giriş dönüşünde yetkilendirme kodu bulunamadı.');
  const client = await getClient();
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) throw error;
  try { await Browser.close(); } catch {}
  return true;
}

async function reportError(error) {
  try { await Browser.close(); } catch {}
  window.dispatchEvent(new CustomEvent('words44-native-auth-error', {
    detail: { message: error?.message || 'Google girişi tamamlanamadı.' }
  }));
}

function queueCallback(url) {
  callbackQueue = callbackQueue.then(() => handleCallback(url)).catch(reportError);
  return callbackQueue;
}

// Register on bridge load so callbacks also work when Android cold-starts the app.
App.addListener('appUrlOpen', ({ url }) => { queueCallback(url); });
App.getLaunchUrl().then(launch => {
  if (launch?.url) queueCallback(launch.url);
}).catch(reportError);

async function startGoogleSignIn(client) {
  activeClient = client;
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: CALLBACK_PREFIX, skipBrowserRedirect: true }
  });
  if (error) throw error;
  if (!data?.url) throw new Error('Google giriş sayfası oluşturulamadı.');
  await Browser.open({ url: data.url });
}

window.Words44NativeAuth = { startGoogleSignIn };
