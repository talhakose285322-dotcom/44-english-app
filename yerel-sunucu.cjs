// 44 uygulamasını bu bilgisayarda açmak için küçük yerel sunucu.
// npm ya da ek paket gerekmez; yalnızca Node.js'in kendi modüllerini kullanır.
// Yalnızca bu bilgisayardan erişilebilir (127.0.0.1). Kapatmak için pencereyi kapat ya da Ctrl+C.
// Çalıştırma: node yerel-sunucu.cjs   (ya da Uygulamayi-Ac.cmd dosyasına çift tıkla)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const OPEN = process.argv.includes('--ac');
function openBrowser() { if (OPEN && process.platform === 'win32') exec('start "" "http://localhost:' + PORT + '/"'); }

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8044;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.wasm': 'application/wasm', '.bcmap': 'application/octet-stream', '.pfb': 'application/octet-stream',
  '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8'
};

const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400); return res.end(); }
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  // only files inside the project folder; never the backups folder
  if (!file.startsWith(ROOT + path.sep) || file.includes(path.sep + 'backups' + path.sep)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('Bulunamadı'); }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'content-type': TYPES[ext] || 'application/octet-stream',
      // always load the newest index.html / sw.js after an update
      'cache-control': ext === '.html' || path.basename(file) === 'sw.js' ? 'no-cache' : 'max-age=3600'
    });
    fs.createReadStream(file).pipe(res);
  });
});

server.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.log('Sunucu zaten çalışıyor gibi görünüyor: http://localhost:' + PORT + '/');
    openBrowser();
    process.exit(0);
  }
  console.error('Sunucu başlatılamadı:', e.message);
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('44 çalışıyor: http://localhost:' + PORT + '/');
  openBrowser();
  console.log('Bu pencere açık kaldığı sürece uygulama kullanılabilir. Kapatmak için pencereyi kapat.');
});
