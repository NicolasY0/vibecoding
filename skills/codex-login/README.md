# Codex Login Skill

Automates Codex CLI login from restricted networks (e.g. mainland China).

## What it does

- Detects your local proxy/VPN (Clash, V2Ray, etc.)
- Checks if Codex is already logged in
- Guides you through enabling device code authorization
- Runs `codex login --device-auth` and helps you enter the verification code

## Two Versions

| File | Mode | How it works |
|------|------|-------------|
| `SKILL.md` | **Manual** (recommended) | CLI handles proxy + code generation; you do browser steps manually |
| `SKILL_AUTO.md` | **Auto** (experimental) | `browser-use` automates everything including browser clicks via CDP |

**Use the Manual version** unless you have Chrome remote debugging set up and
are comfortable with CDP. The auto version is less reliable due to 400 errors,
CDP timeouts, and fragile button matching.

## Quick Start

1. Copy the desired `SKILL.md` into `.claude/skills/codex-login/`
2. Make sure your VPN/proxy is running
3. Say: **"help me log into codex"** or **"帮我登录 codex"**

## Requirements

- [Codex CLI](https://www.npmjs.com/package/@openai/codex) installed
- A working VPN/proxy (Clash, V2Ray, etc.)
- A ChatGPT account
- A browser logged into ChatGPT

**Auto version additionally requires:**
- Chrome with remote debugging enabled
- `browser-use` installed (`pip install browser-use`)
- Python < 3.14 (3.14 has Unicode surrogate bug on Windows)

## Install

```bash
# Manual version (recommended)
cp SKILL.md ~/your-project/.claude/skills/codex-login/

# Or auto version
cp SKILL_AUTO.md ~/your-project/.claude/skills/codex-login/SKILL.md
```

## License

MIT
