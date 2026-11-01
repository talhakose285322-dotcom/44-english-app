#!/usr/bin/env node
/**
 * Local Claude Pro bridge (read-only prototype).
 * ChatGPT/user posts "@local-claude-pro <task>" on the configured GitHub issue.
 * This process polls comments and runs the locally authenticated Claude Code CLI.
 */
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const execFile = promisify(execFileCallback);
const args = process.argv.slice(2);
const value = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const repo = value("--repo", "talhakose285322-dotcom/44-english-app");
const issue = Number(value("--issue", ""));
const interval = Math.max(5, Number(value("--interval", "10")));
if (!Number.isInteger(issue) || issue < 1) {
  console.error("Usage: node scripts/factory/claude-pro-bridge.mjs --issue <number> [--repo owner/name]");
  process.exit(2);
}

const run = async (cmd, cmdArgs, options = {}) => {
  const result = await execFile(cmd, cmdArgs, { maxBuffer: 8 * 1024 * 1024, ...options });
  return result.stdout.trim();
};
const gh = async (...a) => run("gh", a);
const stateDir = path.join(homedir(), ".words44-claude-pro-bridge",
  createHash("sha256").update(repo + "#" + issue).digest("hex").slice(0, 12));
const statePath = path.join(stateDir, "state.json");
await mkdir(stateDir, { recursive: true });

console.log("Words 44 local Claude Pro bridge — READ-ONLY mode");
console.log("Repository:", repo, "| Issue:", issue);
console.log("Checking local tools and authentication…");
await gh("auth", "status");
const login = await gh("api", "user", "--jq", ".login");
const version = await run("claude", ["--version"]);
console.log("GitHub:", login, "| Claude Code:", version);
if (process.env.ANTHROPIC_API_KEY) {
  console.error("STOP: ANTHROPIC_API_KEY is set. Refusing to run to avoid unintended API billing.");
  console.error("In PowerShell, run: Remove-Item Env:ANTHROPIC_API_KEY");
  process.exit(3);
}

const fetchComments = async () => JSON.parse(await gh(
  "api", "--paginate", "--slurp", "--jq", "add", `repos/${repo}/issues/${issue}/comments`
));
let state;
try { state = JSON.parse(await readFile(statePath, "utf8")); }
catch { state = null; }

if (!state) {
  const comments = await fetchComments();
  const newest = comments.reduce((n, c) => Math.max(n, Number(c.id)), 0);
  state = { lastSeenId: newest };
  await writeFile(statePath, JSON.stringify(state, null, 2));
  console.log("Ready. Existing comments ignored; now add a NEW comment starting with @local-claude-pro.");
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
while (true) {
  try {
    const comments = await fetchComments();
    const pending = comments
      .filter(c => Number(c.id) > state.lastSeenId)
      .sort((a, b) => Number(a.id) - Number(b.id));
    for (const comment of pending) {
      state.lastSeenId = Math.max(state.lastSeenId, Number(comment.id));
      await writeFile(statePath, JSON.stringify(state, null, 2));
      const body = String(comment.body || "");
      const author = comment.user?.login || "";
      if (author !== login || !/^\s*@local-claude-pro\\b/i.test(body)) continue;

      const task = body.replace(/^\s*@local-claude-pro\s*/i, "").trim();
      if (!task) continue;
      console.log(`New task #${comment.id} from ${author}. Running Claude Code with Pro login (plan/read-only mode)…`);
      const prompt = [
        "You are responding to a task delivered through the user's local Claude Code Pro subscription.",
        "READ-ONLY ANALYSIS ONLY: do not edit/create/delete files, run mutating commands, create branches, commit, push, open PRs, or deploy.",
        "Read CLAUDE.md and relevant project context before answering.",
        "Be concise, state assumptions, and distinguish verified facts from recommendations.",
        "GitHub repository: " + repo + "; task issue: #" + issue,
        "User task:",
        task
      ].join("\n\n");
      let answer;
      try {
        const raw = await run("claude", ["-p", prompt, "--permission-mode", "plan",
          "--max-turns", "8", "--output-format", "json"]);
        try {
          const parsed = JSON.parse(raw);
          answer = parsed.result || raw;
        } catch { answer = raw; }
      } catch (error) {
        answer = "Claude Code çalıştırılamadı: " + (error.stderr || error.message || String(error));
      }
      const report = [
        "**Yerel Claude Code Pro köprüsü yanıtı**",
        "",
        "İşlem: read-only / plan modu; dosya değişikliği yapılmadı.",
        "",
        String(answer).slice(0, 50000)
      ].join("\n");
      await gh("issue", "comment", String(issue), "--repo", repo, "--body", report);
      console.log("Reply posted for task #" + comment.id);
    }
  } catch (error) {
    console.error("Polling error:", error.message || error);
  }
  await sleep(interval * 1000);
}
