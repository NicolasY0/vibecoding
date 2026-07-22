---
name: codex-login-auto
description: |
  FULLY AUTOMATED Codex CLI login for restricted networks. Uses browser-use to
  control Chrome via CDP — auto-enables device code authorization in ChatGPT
  settings AND auto-enters the verification code on auth.openai.com.

  Use when user explicitly requests "fully automated login", "auto login",
  "no manual steps", or when running in a headless/remote environment with
  Chrome debugging enabled.

  Prerequisites: Chrome with remote debugging, browser-use installed, proxy/VPN
  running, Python < 3.14 (3.14 has Unicode surrogate bug on Windows).
---

# Codex Login Skill (Auto)

**Fully automated version** — uses `browser-use` to control Chrome via CDP.

> **Warning:** This is less reliable than the manual version. Common failure
> modes: CDP timeouts, 400 errors on account selection, clicking wrong buttons.
> Only use when full automation is explicitly requested AND `browser-use --doctor`
> passes all checks.

## Prerequisites

```bash
browser-use --doctor
# Must show: chrome running, daemon alive, active browser connections
```

**Python 3.14 note:** On Windows, Python 3.14 crashes when `exec()` encounters
lone surrogates in Chinese text. All browser-use heredocs MUST use only ASCII;
interact with Chinese page content exclusively via `js()`.

---

## Step 1: Detect Proxy

```bash
for port in 7890 7891 7893 7897 1080 1081 9090 8080 8888 5533 10809 10080 2080; do
  result=$(curl -s --max-time 1 -o /dev/null -w "%{http_code}" \
    -x "http://127.0.0.1:$port" "https://www.bing.com" 2>/dev/null)
  if [ "$result" != "000" ]; then
    echo "Port $port: $result (works)"
  fi
done
```

Pick one and set:
```bash
PROXY_URL="http://127.0.0.1:<port>"
export HTTPS_PROXY="$PROXY_URL" HTTP_PROXY="$PROXY_URL"
```

---

## Step 2: Check Login Status

```bash
codex login status 2>&1
```

If `Logged in using ChatGPT` → done. Otherwise continue.

---

## Step 3: Enable Device Code Auth (Auto)

Open the Codex settings page and toggle the switch via browser-use.

**Key gotcha:** The React page needs ~4 seconds to hydrate. The switch is a
`[role="switch"]` element; the first one on the page (16-char Chinese name)
is the device code auth toggle.

```bash
browser-use <<'PY'
new_tab("https://chatgpt.com/codex/settings/general#settings/Security")
import time
time.sleep(4)
wait_for_load()

# Check switch state and toggle if needed
state = js("""
(function() {
  var s = document.querySelector('[role="switch"]');
  return s ? s.getAttribute('data-state') + '|' + s.getAttribute('aria-checked') : 'none';
})()
""")
print("switch state:", state)

if "unchecked" in state or "false" in state:
    js("document.querySelector('[role=\"switch\"]').click()")
    time.sleep(1)
    after = js("""
    (function() {
      var s = document.querySelector('[role="switch"]');
      return s ? s.getAttribute('data-state') : 'none';
    })()
    """)
    print("after click:", after)
else:
    print("already ON")
PY
```

Verify output shows `checked` before continuing.

---

## Step 4: Device Auth Login (Auto)

### 4a. Start codex and get the device code

```bash
export HTTPS_PROXY="$PROXY_URL" HTTP_PROXY="$PROXY_URL"
codex login --device-auth > /tmp/codex_auth.txt 2>&1 &
CODEX_PID=$!
sleep 6
cat /tmp/codex_auth.txt
DEVICE_CODE=$(grep -oE '[A-Z0-9]{4}-[A-Z0-9]{5}' /tmp/codex_auth.txt | head -1)
echo "DEVICE_CODE=$DEVICE_CODE"
```

### 4b. Navigate to device auth page and select account

```bash
browser-use <<'PY'
new_tab("https://auth.openai.com/codex/device")
import time
time.sleep(3)
wait_for_load()

# Click the account button (look for email in button text)
result = js("""
(function() {
  var buttons = document.querySelectorAll('button');
  for (var i = 0; i < buttons.length; i++) {
    if (buttons[i].textContent.includes('@')) {
      buttons[i].click();
      return 'clicked account';
    }
  }
  return 'no account button found';
})()
""")
print("account click:", result)
time.sleep(3)
wait_for_load()

# Handle the known 400 error ("Route Error: Invalid content type")
body = js("document.body.textContent.substring(0, 200)")
print("body preview:", body)
if "400" in body or "Route Error" in body:
    print("Hit 400 error, clicking Retry...")
    js("document.querySelector('button').click()")
    time.sleep(3)
    wait_for_load()
    print("after retry:", page_info()["url"])
PY
```

### 4c. Fill the device code

The page uses 9 separate single-character inputs (`character_1` through
`character_9`). The dash in `XXXX-XXXXX` is auto-inserted — only send the
9 alphanumeric characters.

```bash
CHARS=$(echo "$DEVICE_CODE" | tr -d '-')
browser-use <<'PY'
chars = list("$CHARS")
for i, ch in enumerate(chars):
    js(f"""
    (function() {{
      var inp = document.querySelector('input[name="character_{i+1}"]');
      if (inp) {{
        var s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        s.call(inp, '{ch}');
        inp.dispatchEvent(new Event('input', {{bubbles: true}}));
        inp.dispatchEvent(new Event('change', {{bubbles: true}}));
      }}
    }})()
    """)
print("filled", len(chars), "chars")

# Verify
code = js("document.querySelector('input[name=\"user_code\"]').value")
print("user_code:", code)
PY
```

### 4d. Click "Continue" (not "Cancel"!)

Both buttons have 2-character Chinese text. Iterate from the END to click the
last short-text button (which is "继续", not "取消").

```bash
browser-use <<'PY'
import time

result = js("""
(function() {
  var buttons = document.querySelectorAll('button');
  // Iterate backwards - the submit button is after the cancel button
  for (var i = buttons.length - 1; i >= 0; i--) {
    var t = buttons[i].textContent.trim();
    if (t.length > 0 && t.length < 5) {
      buttons[i].click();
      return 'clicked button[' + i + ']: ' + t;
    }
  }
  return 'not found';
})()
""")
print("submit:", result)

time.sleep(5)
wait_for_load()
print("after submit:", page_info()["url"])
PY
```

### 4e. Wait for login

```bash
wait $CODEX_PID 2>/dev/null
export HTTPS_PROXY="$PROXY_URL" HTTP_PROXY="$PROXY_URL"
codex login status 2>&1
```

Expected: `Logged in using ChatGPT`

---

## Step 5: Verify

```bash
export HTTPS_PROXY="$PROXY_URL" HTTP_PROXY="$PROXY_URL"
codex login status 2>&1
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `RuntimeError: Could not compute box model` | Element scrolled out of view | Use `js()` to click instead of `click_at_xy()` |
| `UnicodeEncodeError` in browser-use | Python 3.14 surrogate bug | Move Chinese text handling into `js()` calls |
| Switch not found (0 switches) | React page not hydrated yet | Add `time.sleep(4)` after `new_tab()` |
| Click doesn't toggle switch | Wrong button clicked | Use `document.querySelector('[role="switch"]').click()` directly |
| 400 error after account selection | OpenAI server issue | Click "Retry" button (handled automatically in 4b) |
| Clicked "Cancel" instead of "Continue" | Button matching by text length is fragile | Iterate buttons backwards (continue is the last short button) |
| CDP timeout during `new_tab()` | Chrome connection lost | Run `browser-use --doctor`, restart if needed |
| `codex: command not found` | Not installed | `npm install -g @openai/codex --registry=https://registry.npmmirror.com` |
