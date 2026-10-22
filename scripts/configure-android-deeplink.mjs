import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const manifestPath = new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url);
if (!existsSync(manifestPath)) {
  throw new Error('Android project not found. Run npx cap add android first, then rerun npm run configure:android.');
}

let xml = await readFile(manifestPath, 'utf8');
const activityStart = /<activity\b[^>]*android:name=["']\.MainActivity["'][^>]*>/;
const match = xml.match(activityStart);
if (!match) {
  throw new Error('Could not find the standard .MainActivity element in AndroidManifest.xml; refusing to edit an unexpected manifest.');
}

const filter = [
  '            <intent-filter>',
  '                <action android:name="android.intent.action.VIEW" />',
  '                <category android:name="android.intent.category.DEFAULT" />',
  '                <category android:name="android.intent.category.BROWSABLE" />',
  '                <data android:scheme="com.words44.app" android:host="auth" android:path="/callback" />',
  '            </intent-filter>'
].join('\n');

if (xml.includes('android:scheme="com.words44.app"')) {
  console.log('Words 44 OAuth deep-link intent filter already exists; no changes made.');
} else {
  const insertAt = match.index + match[0].length;
  xml = xml.slice(0, insertAt) + '\n' + filter + xml.slice(insertAt);
  await writeFile(manifestPath, xml, 'utf8');
  console.log('Added Words 44 OAuth deep-link intent filter to the generated Android manifest.');
}
