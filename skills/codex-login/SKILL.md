---
name: codex-login
description: |
  Log into Codex CLI from restricted networks (e.g. China). Detects proxy/VPN,
  guides user through device code authorization setup, and completes device auth.
  Use when user mentions "codex login", "codex denglu", "cannot log into Codex",
  "Codex phone verification", "device code authorization", or "codex 登录".
  Also use for any Codex authentication issue in regions where OpenAI is blocked.
---

# Codex Login Skill (Manual)

Logs into Codex CLI from networks where OpenAI is blocked (e.g. mainland China).
The skill handles proxy detection and the CLI side; the user handles the browser
steps manually — which is the most reliable approach.

## Flow Summary

```
Detect proxy → Check login → Enable device code auth (user, browser)
→ Get device code (CLI) → Enter code (user, browser) → Done
```

---

## Step 1: Detect Proxy

Scan common proxy ports. Use `www.bing.com` as the test target (more reliable
than Google through some proxies):

```bash
for port in 7890 7891 7893 7897 1080 1081 9090 8080 8888 5533 10809 10080 2080; do
  result=$(curl -s --max-time 1 -o /dev/null -w "%{http_code}" \
    -x "http://127.0.0.1:$port" "https://www.bing.com" 2>/dev/null)
  if [ "$result" != "000" ]; then
    echo "Port $port: $result (works)"
  fi
done
```

- **Exactly one port found**: use it automatically.
- **Multiple ports**: ask the user which one.
- **None found**: ask the user to enter their proxy address manually.
  Common examples: `http://127.0.0.1:7890` (Clash default),
  `http://127.0.0.1:7897` (Clash alt), `http://127.0.0.1:10809` (V2Ray).

Set the proxy for all subsequent commands:
```bash
PROXY_URL="http://127.0.0.1:<port>"
export HTTPS_PROXY="$PROXY_URL" HTTP_PROXY="$PROXY_URL"
```

Optionally verify the exit region:
```bash
curl -s -x "$PROXY_URL" "http://ip-api.com/json/" | grep -E "country|city|query"
```
OpenAI supports: Singapore, Japan, US, Taiwan, etc. **Mainland China is blocked.**

## Step 2: Check Login Status

```bash
export HTTPS_PROXY="$PROXY_URL" HTTP_PROXY="$PROXY_URL"
codex login status 2>&1
```

- `Logged in using ChatGPT` → already done. Exit.
- `Not logged in` → continue.

If `codex: command not found`, install it:
```bash
npm install -g @openai/codex --registry=https://registry.npmmirror.com
```

## Step 3: Enable Device Code Authorization (User)

Tell the user:

> **Open this URL in your browser (make sure your VPN/proxy is on):**
>
> **`https://chatgpt.com/codex/settings/general#settings/Security`**
>
> You must be logged into ChatGPT in that browser first.
>
> Find the toggle: **"Enable device code authentication for Codex"**
> (or "为 Codex 启用设备代码授权") and **turn it ON**.
>
> This is a Codex-specific settings page, NOT the general ChatGPT settings.

Wait for the user to confirm the toggle is ON before proceeding.

## Step 4: Device Auth Login

### 4a. Run the login command

```bash
export HTTPS_PROXY="$PROXY_URL" HTTP_PROXY="$PROXY_URL"
codex login --device-auth 2>&1
```

This prints something like:

```
Welcome to Codex [v0.145.0]
OpenAI's command-line coding agent

Follow these steps to sign in with ChatGPT using device code authorization:

1. Open this link in your browser and sign in to your account
   https://auth.openai.com/codex/device

2. Enter this one-time code (expires in 15 minutes)
   L476-MA4MO
```

### 4b. Tell the user what to do

Extract the 9-character code (format `XXXX-XXXXX`) from the output. Then tell
the user:

> **1.** Open **`https://auth.openai.com/codex/device`** in your browser
> (VPN/proxy must be on).
>
> **2.** Select your ChatGPT account.
> *If you see "Route Error (400)", click "Retry" (重试) — it usually works
> the second time.*
>
> **3.** On the consent page, enter the 9-character code: **`<CODE>`**
> (The dash is auto-inserted — just type the letters and numbers.)
>
> **4.** Click **"继续"** (Continue).

The CLI will wait and print `Successfully logged in` once the browser flow
completes. If the 15-minute window expires before the user finishes, re-run
Step 4a for a fresh code.

## Step 5: Verify

```bash
export HTTPS_PROXY="$PROXY_URL" HTTP_PROXY="$PROXY_URL"
codex login status 2>&1
```

Expected: `Logged in using ChatGPT`

---

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `403 Forbidden` or `unsupported_country_region_territory` | Proxy IP is mainland China | Switch VPN to Singapore/Japan/US/Taiwan node. Verify with ip-api.com |
| "在 ChatGPT 安全设置中为 Codex 启用设备代码授权" | Device code auth toggle is OFF | Go to Step 3 and enable it |
| "Route Error (400)" after selecting account | OpenAI server hiccup | Click "Retry" (重试), usually works on 2nd attempt |
| `codex: command not found` | Codex CLI not installed | `npm install -g @openai/codex --registry=https://registry.npmmirror.com` |
| Login command hangs with no output | Proxy not set for this terminal | Re-export `HTTPS_PROXY` and `HTTP_PROXY` |
| Code expired before entering in browser | 15-min window passed | Re-run Step 4a for a new code |
| Settings page shows no toggle | Not logged into ChatGPT in that browser | Log in at `chatgpt.com` first, then revisit the settings URL |

## Notes

- The proxy env vars (`HTTPS_PROXY`, `HTTP_PROXY`) must be set **in every
  terminal session** where you use Codex. Consider adding them to your
  `.bashrc` or `.zshrc`.
- The device code authorization toggle is a one-time setup. Once enabled,
  future logins only need Step 4.
- This skill was tested with Codex CLI v0.145.0, Clash proxy on Windows 11,
  and ChatGPT Plus accounts. Free accounts should also work.
