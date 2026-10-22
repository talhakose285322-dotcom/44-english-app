const fs = require('node:fs');
const path = require('node:path');

const pkg = require('../package.json');
const gradlePath = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
let gradle = fs.readFileSync(gradlePath, 'utf8');
const version = String(pkg.version || '1.0.0');
const nums = version.match(/\d+/g) || ['1', '0', '0'];
const versionCode = Number(nums[0]) * 1000000 + Number(nums[1] || 0) * 1000 + Number(nums[2] || 0);
if (!/versionCode\s+\d+/.test(gradle) || !/versionName\s+["'][^"']+["']/.test(gradle)) {
  throw new Error('Could not locate Android versionCode/versionName in app/build.gradle');
}
gradle = gradle.replace(/versionCode\s+\d+/, 'versionCode ' + versionCode);
gradle = gradle.replace(/versionName\s+["'][^"']+["']/, 'versionName "' + version + '"');
fs.writeFileSync(gradlePath, gradle);
console.log('Android preview version set to ' + version + ' (code ' + versionCode + ').');
