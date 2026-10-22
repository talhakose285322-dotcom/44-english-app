import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

const CALLBACK_PREFIX = 'com.words44.app://auth/callback';
let listening = false;
let activeClient = null;

function getClient() {
  if (!activeClient) throw new Error('Words 44 auth client is not ready.');
  return activeClient;
}

async function handleCallback(rawUrl) {
  if (!rawUrl || !rawUrl.startsWith(CALLBACK_PREFIX)) return false;
  const url = new URL(rawUrl);
  const authError = url.searchParams.get('error_description') || url.searchParams.get('error');
  if (authError) throw new Error(authError);
  const code = url.searchParams.get('code');
  if (!code) throw new Error('Google giriş dönüşünde yetkilendirme kodu bulunamadı.');
  const client = getClient();
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

async function startGoogleSignIn(client) {
  activeClient = client;
  if (!listening) {
    listening = true;
    App.addListener('appUrlOpen', ({ url }) => {
      handleCallback(url).catch(reportError);
    });
    const launch = await App.getLaunchUrl();
    if (launch?.url) handleCallback(launch.url).catch(reportError);
  }
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: CALLBACK_PREFIX, skipBrowserRedirect: true }
  });
  if (error) throw error;
  if (!data?.url) throw new Error('Google giriş sayfası oluşturulamadı.');
  await Browser.open({ url: data.url });
}

window.Words44NativeAuth = { startGoogleSignIn };
