// The Claude Code safety hook (.claude/hooks/guard.mjs): fed tool calls exactly as Claude Code sends them (JSON on
// stdin), it blocks what CLAUDE.md forbids (exit 2 with a reason) and lets everyday work through (exit 0).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync, execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ROOT} from './lib/browser.mjs';

const HOOK = path.join(ROOT, '.claude', 'hooks', 'guard.mjs');
function run(tool, input) {
  const r = spawnSync(process.execPath, [HOOK], {input: JSON.stringify({hook_event_name: 'PreToolUse', tool_name: tool, tool_input: input}), encoding: 'utf8'});
  return {code: r.status, err: r.stderr};
}
const bash = command => run('Bash', {command});

test('ayarlar: hook her komut ve dosya düzenlemesinden önce çalışıyor', () => {
  const s = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude', 'settings.json'), 'utf8'));
  const h = s.hooks.PreToolUse[0];
  assert.match(h.matcher, /Bash/); assert.match(h.matcher, /PowerShell/); assert.match(h.matcher, /Edit/); assert.match(h.matcher, /Write/);
  assert.match(h.hooks[0].command, /\.claude\/hooks\/guard\.mjs/);
});

test('yasak git ve gh işlemleri engelleniyor', () => {
  const blocked = [
    'git reset --hard', 'git reset --hard origin/main', 'git restore .', 'git restore index.html', 'git checkout .', 'git checkout -- index.html',
    'git pull', 'git pull origin main', 'git add -A', 'git add .', 'git add --all', 'git add -u', 'git commit -a -m x', 'git commit -am "x"',
    'git clean -fd', 'git push --force', 'git push -f origin feature', 'git push origin +feature', 'git push --force-with-lease',
    'git push origin main', 'git push origin HEAD:main', 'git push origin feature:refs/heads/main', 'git push --mirror',
    'cd /c/x && git status && git reset --hard', 'git fetch -q; git pull',
    'gh pr merge 79 --admin --merge', '/c/Users/talha/tools/gh/bin/gh.exe pr merge 79 --merge --admin',
    'gh pr edit 79 --add-label onay', "gh pr edit 79 --add-label 'workflow-onay'", 'gh api repos/o/r/issues/79/labels -f labels[]=onay',
    'gh api -X PUT repos/o/r/branches/main/protection --input p.json', 'gh api --method DELETE repos/o/r/rulesets/1',
    'gh secret set X', 'gh repo delete o/r --yes',
    'rm -rf /c/Users/talha/44-english-app', 'rm /c/Users/talha/44-english-app/index.html', 'Remove-Item -Recurse C:\\Users\\talha\\44-english-app'
  ];
  for (const c of blocked) {
    const r = bash(c);
    assert.equal(r.code, 2, 'engellenmeliydi: ' + c);
    assert.match(r.err, /Words 44 güvenlik kuralı/);
  }
  assert.equal(run('PowerShell', {command: 'git reset --hard'}).code, 2, 'PowerShell de denetleniyor');
});

test('günlük işler engellenmiyor (yanlış alarm yok)', () => {
  const allowed = [
    'git status --short', 'git fetch -q', 'git log --oneline -5', 'git diff --stat', 'git add -- index.html tests/a.test.mjs',
    'git add -- .claude/settings.json', 'git restore --staged index.html', 'git commit -q -m "Add x" -m "Do not use git pull or git reset --hard here"',
    'git commit -q -F msg.txt', 'git commit --amend --no-edit', 'git push -q -u origin feature-main', 'git push -u origin safety-hooks',
    'git switch -c x origin/main', 'git worktree add -b x ../wt origin/main', 'git merge --ff-only origin/main', 'git checkout -b feature origin/main',
    'gh pr create --title "x" --body-file b.md', 'gh pr merge 79 --auto --merge', 'gh pr view 79 --json labels', 'gh pr checks 79',
    'gh api repos/o/r/branches/main/protection', 'gh label list', 'gh pr edit 79 --add-label documentation',
    'node --test --test-concurrency=4', 'rm -rf /tmp/x', 'rm -rf C:/Users/talha/AppData/Local/Temp/claude/scratchpad/x',
    'rm -f /c/Users/talha/44-english-app-docs/tests/tmp.txt',
    "git commit -q -F - <<'EOF'\nFix: never git pull\ngit reset --hard is forbidden\nEOF\ngit log -1"
  ];
  for (const c of allowed) assert.deepEqual(bash(c), {code: 0, err: ''}, 'serbest olmalıydı: ' + c);
});

test('dosya düzenleme: pending-app-changes dalındaki klasör, .git ve gizli anahtarlar korunuyor', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'w44-hook-'));
  try {
    const pend = path.join(dir, 'pend'), work = path.join(dir, 'work');
    execFileSync('git', ['init', '-q', '-b', 'pending-app-changes', pend]);
    execFileSync('git', ['init', '-q', '-b', 'feature', work]);
    assert.equal(run('Edit', {file_path: path.join(pend, 'index.html'), old_string: 'a', new_string: 'b'}).code, 2, 'pending-app-changes klasörü');
    assert.equal(run('Write', {file_path: path.join(pend, 'sub', 'new.txt'), content: 'x'}).code, 2, 'alt klasör de');
    assert.equal(run('Edit', {file_path: path.join(work, 'index.html'), old_string: 'a', new_string: 'b'}).code, 0, 'normal dal serbest');
    assert.equal(run('Write', {file_path: path.join(work, '.git', 'config'), content: 'x'}).code, 2, '.git');
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjAwMDAwMDAwfQ.abcdefghijklmnopqrstuv';
    for (const secret of [jwt, 'sb_secret_abcdefghijklmnop', 'sk-ant-api03-abcdefghijklmn', 'ghp_abcdefghijklmnopqrstuvwxyz0123', 'GOCSPX-abcdefghijklmnop', '-----BEGIN PRIVATE KEY-----'])
      assert.equal(run('Write', {file_path: path.join(work, 'a.js'), content: 'const k = "' + secret + '";'}).code, 2, 'gizli: ' + secret.slice(0, 12));
    assert.equal(run('Edit', {file_path: path.join(work, 'a.js'), old_string: 'x', new_string: "var SB_KEY='sb_publishable_n8lqUgWjGVlo0AGRvsXW2Q_FceME-db';"}).code, 0, 'publishable anahtar serbest');
    assert.equal(run('MultiEdit', {file_path: path.join(work, 'a.js'), edits: [{old_string: 'x', new_string: 'sb_secret_abcdefghijklmnop'}]}).code, 2, 'MultiEdit de denetleniyor');
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

test('başka biçimlerde yazılan yasak komutlar da yakalanıyor', () => {
  const blocked = [
    // git options before the subcommand, git.exe or a full path
    'git -C /c/Users/talha/44-english-app reset --hard', 'git -c core.pager=cat pull', 'git --no-pager pull', 'git --git-dir=.git --work-tree=. reset --hard',
    'git.exe pull', '/usr/bin/git pull', '"C:\\Program Files\\Git\\cmd\\git.exe" reset --hard', '& "C:\\Program Files\\Git\\cmd\\git.exe" pull',
    // commands handed to another shell, substitutions, chains
    'bash -c "git pull"', "sh -c 'git reset --hard'", 'bash -lc "cd x && git add -A"', 'pwsh -NoProfile -Command "git reset --hard"',
    'powershell -Command "& {git pull}"', 'cmd /c git pull', 'eval "git pull"', 'Invoke-Expression "git reset --hard"', 'iex \'git pull\'',
    'echo $(git pull)', 'echo "$(git reset --hard)"', 'echo `git pull`', 'git fetch & git pull', 'Get-Date; git checkout -- .',
    'pwsh -EncodedCommand ZwBpAHQAIABwAHUAbABsAA==', "echo index.html | xargs git checkout --",
    // other ways of throwing away local work, and hiding a command behind an alias
    'git restore --staged --worktree index.html', 'git restore -SW index.html', 'git checkout -f main', 'git checkout --force feature',
    'git switch -f main', 'git switch --discard-changes main', 'git stash drop', 'git stash clear',
    "git -c alias.up='pull' up", 'git config alias.sync pull', 'git config --global alias.x "reset --hard"'
  ];
  for (const c of blocked) assert.equal(bash(c).code, 2, 'engellenmeliydi: ' + c);
  for (const c of ['git -C ../wt status', 'git --no-pager log -3', 'bash -c "node --test"', 'pwsh -Command "Get-ChildItem"', 'echo $(git rev-parse HEAD)',
    'git stash list', 'git switch feature', 'git checkout feature', 'git config user.name', 'node a.js 2>&1 | tail -5'])
    assert.deepEqual(bash(c), {code: 0, err: ''}, 'serbest olmalıydı: ' + c);
});

test('hook bozulursa ya da çalışamazsa işlem durur (güvenli taraf)', () => {
  for (const input of ['not json', '', '{"tool_name":"Bash","tool_input":'])
    assert.equal(spawnSync(process.execPath, [HOOK], {input, encoding: 'utf8'}).status, 2, 'bozuk girdi: ' + JSON.stringify(input));
  assert.equal(run('Read', {file_path: '/x'}).code, 0, 'denetlenmeyen araç serbest');
  // the command from settings.json, as Claude Code runs it: a missing hook file or a missing node also blocks
  const bashOk = spawnSync('bash', ['-c', 'true']).status === 0;
  if (!bashOk) return;
  const cmd = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude', 'settings.json'), 'utf8')).hooks.PreToolUse[0].hooks[0].command;
  const sh = (env, input) => spawnSync('bash', ['-c', (env.PATH ? 'PATH=' + env.PATH + '; ' : '') + cmd], {input, encoding: 'utf8',
    env: {...process.env, ...env, PATH: process.env.PATH}}).status;
  const ev = tool => JSON.stringify({hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: {command: tool}});
  const dir = ROOT.replace(/\\/g, '/');
  assert.equal(sh({CLAUDE_PROJECT_DIR: dir}, ev('git status')), 0, 'ayarlardaki komut normalde çalışıyor');
  assert.equal(sh({CLAUDE_PROJECT_DIR: dir}, ev('git pull')), 2, 'ayarlardaki komut engelliyor');
  assert.equal(sh({CLAUDE_PROJECT_DIR: dir + '/yok'}, ev('git status')), 2, 'hook dosyası yoksa durur');
  assert.equal(sh({CLAUDE_PROJECT_DIR: dir, PATH: '/nonexistent'}, ev('git status')), 2, 'node yoksa durur');
});
