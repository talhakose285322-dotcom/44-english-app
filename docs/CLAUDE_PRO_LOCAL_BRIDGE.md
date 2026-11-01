# Local Claude Pro bridge (prototype)

This bridge lets ChatGPT and the user's locally authenticated Claude Code CLI exchange messages through a GitHub Issue. It does **not** connect to the same interactive VS Code conversation; it starts a separate local CLI run authenticated with the same Claude account/plan.

## Requirements

- Windows PowerShell, macOS, or Linux
- Node.js 18+
- GitHub CLI (`gh`) installed and authenticated with an account that can read/write comments in this repository
- Claude Code installed and logged in using the user's Claude Pro account
- Do not configure an Anthropic Console API key. The script refuses to start if `ANTHROPIC_API_KEY` is present, to avoid unexpected API billing.

Verify locally:

```powershell
gh auth status
claude --version
```

## Start

From the repository root:

```powershell
node scripts/factory/claude-pro-bridge.mjs --issue 95
```

Keep this terminal open. The process polls every 10 seconds. Existing comments are ignored at startup. Add a **new** comment to Issue #95 beginning with:

```text
@claude-pro Explain the current authentication flow. Do not change files.
```

The local CLI runs Claude Code in **plan/read-only mode** and posts its answer as an Issue comment. ChatGPT can then read that reply through GitHub.

## Important limitations

- This is a prototype and only handles read-only analysis. It deliberately does not enable file edits, commits, PRs, merges, or deployment.
- The computer must remain on, connected to the internet, and the bridge process must remain running.
- This is a separate CLI run under the same Pro login, not a live connection to the existing VS Code conversation or its in-memory context.
- Pro usage limits apply. The script does not opt into API credits and refuses to run when `ANTHROPIC_API_KEY` is set.
- The bridge only accepts new `@claude-pro` comments authored by the GitHub account authenticated by `gh`.
- State is stored under the user's home directory in `.words44-claude-pro-bridge`, not in the repository.
