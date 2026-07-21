---
name: bilibili-dynamic-deleter
description: Delete all Bilibili (bilibili.com) dynamic posts automatically. Use when user wants to clear, remove, delete, or batch-delete Bilibili dynamics, posts, or timeline content. Trigger on: cleaning B站, wiping Bilibili feed, mass-deleting 动态/说说, Bilibili account cleanup.
---

# Bilibili Dynamic Deleter

Fully automated: launches Chrome → logs in via QR → deletes all dynamics via Bilibili's internal API.

## Prerequisites

```bash
npm i -g agent-browser && agent-browser install   # provides Chrome
npm install puppeteer-core                         # CDP client
```

## Usage

```bash
node scripts/run.js <UID>
```

Example: `node scripts/run.js 1675268210`

### What it does

1. Launches Chrome (reuses login state from `~/.bilibili-deleter-profile`)
2. Navigates to user's dynamic page
3. If not logged in: clicks login → shows QR → waits for user to scan (120s timeout)
4. Injects the API-based delete script
5. Script runs entirely in-browser: fetches dynamics via Bilibili API, deletes each one
6. Reports total deleted

### API approach (why this works reliably)

| Step | Endpoint |
|------|----------|
| List dynamics | `api.bilibili.com` (new, with `api.vc.bilibili.com` fallback) |
| Delete one | `POST api.vc.bilibili.com/dynamic_svr/v1/dynamic_svr/rm_dynamic` |

No DOM clicking. No fragile CSS selectors. Rate-limit detection with auto-backoff (429 → slow down, 412 → stop).

### Manual fallback

If automation fails, the user can also open `https://space.bilibili.com/{UID}/dynamic`, F12 → Console, and paste the script from `scripts/delete.js`.

## Error handling

| Code | Action |
|------|--------|
| 429 (rate limited) | Auto-backoff, increase delay |
| 412 (IP banned) | Stop, tell user to wait |
| 500404 | Already deleted, skip |