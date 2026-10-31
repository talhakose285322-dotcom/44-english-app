// Claude Code PreToolUse hook: stops the operations that CLAUDE.md forbids, before they run. It reads the tool call
// (JSON on stdin) and exits with code 2 and a reason on stderr to block it, 0 to allow it.
// It is one safety layer, not the only one: branch protection, the Koruma check, required tests and the owner's
// approval still apply. Commands hidden inside scripts or other programs cannot all be recognised here.
// If the hook itself fails (bad input, an error), it blocks: an unchecked call is never let through.
import fs from 'node:fs';
import path from 'node:path';

const APPROVAL_LABELS = ['workflow-onay', 'onay'];
const GIT = /^(?:.*[\/\\])?git(?:\.exe)?$/i, GH = /^(?:.*[\/\\])?gh(?:\.exe)?$/i;
// git options before the subcommand (git -C dir, git -c k=v, git --no-pager ...); these take the next word
const GIT_OPT_VALUE = /^(-C|-c|--git-dir|--work-tree|--namespace|--super-prefix|--config-env)$/;
// programs that run the text they are given as a command: bash -c "...", pwsh -Command "...", cmd /c, eval, iex
const RUNNER = /(^|[\s&;|({])(?:[^\s"']*[\/\\])?(?:(?:bash|sh|zsh|dash|pwsh|powershell|cmd)(?:\.exe)?\s+(?:-\w+\s+)*(?:-[a-z]*c|-Command|\/c|\/k)|eval|iex|Invoke-Expression|xargs)(?=\s|$)/i;

// ---- shell commands (Bash, PowerShell) ----
function commandProblem(cmd, depth = 0) {
  if (depth > 4) return 'iç içe komutlar çok derin; denetlenemiyor.';
  // the text of a heredoc (a commit message, a file) is data, not commands
  const lines = [], hd = [];
  String(cmd || '').replace(/\\\r?\n/g, ' ').split(/\r?\n/).forEach(l => {
    if (hd.length) { if (l.trim() === hd[0]) hd.shift(); return; }
    lines.push(l);
    for (const m of l.matchAll(/<<-?\s*['"]?([A-Za-z_][\w]*)['"]?/g)) hd.push(m[1]);
  });
  const text = lines.join('\n');
  // command substitution runs its text even inside double quotes: $(git pull), `git pull`
  for (const m of text.replace(/'[^']*'/g, "''").matchAll(/\$\(([^()]*)\)|`([^`]*)`/g)) {
    const inner = commandProblem(m[1] ?? m[2], depth + 1);
    if (inner) return inner;
  }
  // a quoted command for another shell may itself be a chain: bash -c "cd x && git add -A"
  if (RUNNER.test(text)) for (const m of text.matchAll(/"([^"]*)"|'([^']*)'/g)) {
    const inner = commandProblem(m[1] ?? m[2], depth + 1);
    if (inner) return inner;
  }
  // every simple command of a chain: a && b ; c | d ; e & f
  const parts = text.split(/\r?\n|&&|\|\||;|\||&/).map(s => s.trim()).filter(Boolean);
  for (const full of parts) {
    // text handed to another shell is checked as a command of its own
    if (/(pwsh|powershell)/i.test(full) && /(^|\s)-(EncodedCommand|enc|ec|e)(\s|$)/i.test(full)) return 'kodlanmış (EncodedCommand) PowerShell komutu denetlenemez.';
    if (RUNNER.test(full)) {
      const inner = commandProblem(full.replace(RUNNER, '$1').replace(/["']/g, ' '), depth + 1);
      if (inner) return inner;
    }
    // quoted text (messages, titles) is not looked at for git/gh rules; a quoted path to git or gh still counts
    const p = full.replace(/"([^"]*)"|'([^']*)'/g, (m, a, b) => GIT.test(a ?? b) ? 'git' : GH.test(a ?? b) ? 'gh' : '""');
    const words = p.split(/[\s{}()]+/).map(w => w.replace(/["']/g, '')).filter(Boolean);
    const gi = words.findIndex(w => GIT.test(w));
    if (gi >= 0) {
      let i = gi + 1;
      for (; i < words.length && words[i].startsWith('-'); i++) {
        if (/^(-c|--config-env)$/.test(words[i]) && /^alias\./i.test(words[i + 1] || '')) return 'git takma adı (alias) ile komut gizlenemez.';
        if (GIT_OPT_VALUE.test(words[i])) i++;
      }
      const sub = words[i] || '', args = words.slice(i + 1), rest = args.join(' ');
      if (sub === 'config' && args.some(a => /^alias\./i.test(a))) return 'git takma adı (alias) ajanlar tarafından tanımlanmaz.';
      if (sub === 'reset' && /(^|\s)--hard(\s|$)/.test(rest)) return '`git reset --hard` yasak: kaydedilmemiş yerel değişiklikleri siler.';
      if (sub === 'restore' && (!/(^|\s)(--staged|-S)(\s|$)/.test(rest) || /(^|\s)(--worktree|-W|-[a-zA-Z]*W[a-zA-Z]*)(\s|$)/.test(rest))) return '`git restore` (çalışma kopyasını geri alma) yasak; yalnızca `git restore --staged <dosya>` serbest.';
      if (sub === 'checkout' && (/(^|\s)--(\s|$)/.test(rest) || /(^|\s)\.(\s|$)/.test(rest))) return '`git checkout .` ve `git checkout -- <dosya>` yasak: değişiklikleri siler.';
      if ((sub === 'checkout' || sub === 'switch') && args.some(a => a === '-f' || a === '--force' || a === '--discard-changes')) return 'zorla dal değiştirme (-f, --discard-changes) yasak: kaydedilmemiş değişiklikleri siler.';
      if (sub === 'stash' && /^(drop|clear)$/.test(args[0] || '')) return '`git stash drop/clear` yasak: saklanan değişiklikleri siler.';
      if (sub === 'pull') return '`git pull` yasak; `git fetch` ve dal + PR kullanılır.';
      if (sub === 'add' && /(^|\s)(-A|--all|-u|--update|\.|\*)(\s|$)/.test(rest)) return '`git add -A`, `git add .`, `git add -u` yasak; yalnızca adı verilen dosyalar: `git add -- <yol>`.';
      if (sub === 'commit' && (args.some(a => /^-[a-zA-Z]*a[a-zA-Z]*$/.test(a)) || /(^|\s)--all(\s|$)/.test(rest))) return '`git commit -a` yasak; önce adı verilen dosyalar stage edilir.';
      if (sub === 'clean' && args.some(a => /^-[a-zA-Z]*f/.test(a) || a === '--force')) return '`git clean -f` yasak: izlenmeyen dosyaları siler.';
      if (sub === 'push') {
        if (args.some(a => a === '-f' || a === '--force' || a.startsWith('--force-with-lease') || /^\+/.test(a))) return 'force push yasak.';
        if (args.some(a => /^(?:[^:]*:)?(?:refs\/heads\/)?(main|master)$/.test(a) && a !== 'origin')) return '`main`e doğrudan push yasak; değişiklik dal + PR ile gelir.';
        if (args.some(a => a === '--mirror' || a === '--all' || a === '--delete' || a === '-d')) return 'toplu ya da silen push (--mirror, --all, --delete) yasak.';
      }
      if (sub === 'branch' && args.some(a => a === '-D') && args.some(a => /^(main|master|pending-app-changes)$/.test(a))) return 'korunan dal silinemez.';
    }
    if (words.some(w => GH.test(w))) {
      const q = full; // label names may be quoted
      if (/\bpr\s+merge\b/.test(p)) return '`gh pr merge` (--auto, --admin dahil her biçimi) yasak: PR\'ı yalnızca depo sahibi birleştirir.';
      if (/--add-label\b/.test(p) && APPROVAL_LABELS.some(l => new RegExp('(^|[\\s,="\'])' + l + '([\\s,"\']|$)').test(q))) return 'onay etiketlerini (workflow-onay, onay) yalnızca depo sahibi ekler.';
      if (/\bapi\b/.test(p) && /\/labels\b/.test(q) && APPROVAL_LABELS.some(l => new RegExp('(^|[^\\w-])' + l + '([^\\w-]|$)').test(q))) return 'onay etiketlerini (workflow-onay, onay) yalnızca depo sahibi ekler.';
      if (/\bapi\b/.test(p) && /(branches\/[^\s]+\/protection|\/rulesets)/.test(p) && /(-X|--method)\s*(PUT|PATCH|POST|DELETE)\b/i.test(p)) return 'dal koruması ve kural setleri yalnızca depo sahibi tarafından değiştirilir.';
      if (/\bsecret\s+(set|delete|remove)\b/.test(p)) return 'GitHub gizli anahtarları yalnızca depo sahibi tarafından değiştirilir.';
      if (/\brepo\s+(delete|archive)\b/.test(p)) return 'depo silme/arşivleme yasak.';
    }
    // the local folder with unpublished work (branch pending-app-changes) is never deleted
    if (/(^|\s)(rm|rmdir|del|rd|Remove-Item)(\s|$)/i.test(full) && /44-english-app(?![-\w])/.test(full) && !/[\\/]\.claude[\\/]|scratchpad|Temp[\\/]/i.test(full)) return 'yerel proje klasörü ve içindeki dosyalar silinemez.';
  }
  return '';
}

// ---- file edits (Edit, Write, MultiEdit, NotebookEdit) ----
function gitBranchOf(file) {
  let d = path.dirname(path.resolve(file));
  for (let i = 0; i < 40; i++) {
    const g = path.join(d, '.git');
    try {
      let head;
      if (fs.statSync(g).isDirectory()) head = fs.readFileSync(path.join(g, 'HEAD'), 'utf8');
      else { // a worktree: .git is a file "gitdir: <path>"
        const gd = fs.readFileSync(g, 'utf8').replace(/^gitdir:\s*/, '').trim();
        head = fs.readFileSync(path.join(path.resolve(d, gd), 'HEAD'), 'utf8');
      }
      const m = head.match(/ref:\s*refs\/heads\/(.+)/);
      return m ? m[1].trim() : '';
    } catch {}
    const up = path.dirname(d); if (up === d) break; d = up;
  }
  return '';
}
const SECRET = /(sb_secret_[A-Za-z0-9_-]{8,}|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}|sk-ant-[A-Za-z0-9-]{10,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|GOCSPX-[A-Za-z0-9_-]{10,})/;
function editProblem(input) {
  const file = input.file_path || input.notebook_path || '';
  if (!file) return '';
  const norm = file.replace(/\\/g, '/');
  if (/(^|\/)\.git\//.test(norm)) return '.git klasörü elle değiştirilmez.';
  if (gitBranchOf(file) === 'pending-app-changes') return '`pending-app-changes` dalındaki yerel klasörde GitHub\'da kopyası olmayan çalışma var; oradaki dosyalar düzenlenmez. Ayrı bir worktree ve dal kullan.';
  const text = [input.content, input.new_string, ...(Array.isArray(input.edits) ? input.edits.map(e => e && e.new_string) : []), input.new_source].filter(Boolean).join('\n');
  if (SECRET.test(text)) return 'yazılan metinde gizli anahtar ya da token gibi görünen bir değer var; gizli bilgiler koda ve belgelere yazılmaz (yalnızca Supabase publishable anahtarı serbest).';
  return '';
}

let raw = '';
process.stdin.on('data', d => raw += d).on('end', () => {
  let problem = '';
  try {
    const ev = JSON.parse(raw);
    const tool = ev.tool_name || '', input = ev.tool_input || {};
    if (tool === 'Bash' || tool === 'PowerShell') problem = commandProblem(input.command);
    else if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tool)) problem = editProblem(input);
  } catch (e) {
    problem = 'güvenlik denetimi çalışamadı (' + (e && e.message || e) + '); işlem güvenlik için durduruldu.';
  }
  if (problem) {
    process.stderr.write('Words 44 güvenlik kuralı: ' + problem + ' (CLAUDE.md)\n');
    process.exit(2);
  }
  process.exit(0);
});
