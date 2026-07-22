# Codex Login Skill

Automates Codex CLI login from restricted networks (e.g. mainland China).

## What it does

- Detects your local proxy/VPN (Clash, V2Ray, etc.)
- Checks if Codex is already logged in
- Guides you through enabling device code authorization
- Runs `codex login --device-auth` and helps you enter the verification code

## Quick Start

1. Install the skill into Claude Code's `.claude/skills/codex-login/`
2. Make sure your VPN/proxy is running
3. Say: **"帮我登录 codex"** (or "log into codex")

The skill will auto-detect your proxy, check if you're logged in, and walk you through the rest.

## Requirements

- [Codex CLI](https://www.npmjs.com/package/@openai/codex) installed (`npm install -g @openai/codex`)
- A working VPN/proxy to reach OpenAI (Clash, V2Ray, etc.)
- A ChatGPT account (Plus or Free)
- A browser logged into ChatGPT

## Manual vs Auto

This is the **manual version**. The skill handles proxy detection and the CLI side; you handle the browser steps manually. This is the most reliable approach.

The browser steps are:
1. Open `https://chatgpt.com/codex/settings/general#settings/Security` and turn ON "Enable device code authentication for Codex"
2. Open `https://auth.openai.com/codex/device` and enter the code shown in your terminal

## Why this exists

OpenAI blocks connections from mainland China. The Codex CLI login flow also requires a hidden setting ("device code authorization") that many users can't find. This skill automates the hard parts.

## Install

Copy `SKILL.md` into `.claude/skills/codex-login/` in your project.

## License

MIT
