/**
 * popup.js — Popup UI logic for Mock Typing.
 */

document.addEventListener('DOMContentLoaded', () => {
  // ── DOM refs ──
  const textarea = document.getElementById('target-text');
  const charCount = document.getElementById('char-count');
  const wpmSlider = document.getElementById('wpm');
  const errorSlider = document.getElementById('error-rate');
  const wpmValue = document.getElementById('wpm-value');
  const errorValue = document.getElementById('error-value');
  const btnStart = document.getElementById('btn-start');
  const btnPause = document.getElementById('btn-pause');
  const btnStop = document.getElementById('btn-stop');
  const progressSection = document.getElementById('progress-section');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const statusBadge = document.getElementById('status-badge');
  const presetChips = document.querySelectorAll('.chip');

  // ── State ──
  let isRunning = false;
  let isPaused = false;
  let currentState = 'IDLE';

  // ── Tab query helper ──
  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  async function sendToContent(action, params = {}) {
    const tab = await getActiveTab();
    return chrome.tabs.sendMessage(tab.id, { action, ...params });
  }

  // ── UI updates ──

  function updateCharCount() {
    charCount.textContent = textarea.value.length;
  }

  function updateWpmLabel() {
    wpmValue.textContent = `${wpmSlider.value} WPM`;
  }

  function updateErrorLabel() {
    errorValue.textContent = `${errorSlider.value}%`;
  }

  function setButtons(running, paused) {
    isRunning = running;
    isPaused = paused;

    if (!running) {
      btnStart.disabled = false;
      btnStart.textContent = '▶ Start';
      btnPause.disabled = true;
      btnPause.textContent = '⏸ Pause';
      btnStop.disabled = true;
    } else if (paused) {
      btnStart.disabled = true;
      btnPause.disabled = false;
      btnPause.textContent = '▶ Resume';
      btnStop.disabled = false;
    } else {
      btnStart.disabled = true;
      btnPause.disabled = false;
      btnPause.textContent = '⏸ Pause';
      btnStop.disabled = false;
    }
  }

  function updateProgress(progress) {
    if (!progress || progress.total === 0) return;

    progressSection.style.display = 'block';
    const pct = Math.round((progress.position / progress.total) * 100);
    progressFill.style.width = `${pct}%`;
    progressText.textContent = `${progress.position} / ${progress.total} (${pct}%)`;

    // Status badge
    const stateLabels = {
      'IDLE': 'Idle',
      'TYPING': 'Typing...',
      'ERROR': 'Error!',
      'CORRECTING': 'Fixing...',
      'PAUSED': 'Paused',
      'DONE': '✓ Done',
    };
    statusBadge.textContent = stateLabels[progress.state] || progress.state;
  }

  // ── Listen for updates from content script ──
  chrome.runtime.onMessage.addListener((msg) => {
    switch (msg.action) {
      case 'progress':
        updateProgress(msg);
        break;
      case 'stateChange':
        currentState = msg.state;
        if (msg.state === 'PAUSED') {
          setButtons(true, true);
        } else if (msg.state === 'DONE') {
          setButtons(false, false);
          updateProgress({ position: msg.position || 0, total: msg.total || 0, state: 'DONE' });
        } else if (msg.state === 'TYPING') {
          setButtons(true, false);
        }
        break;
      case 'done':
        setButtons(false, false);
        statusBadge.textContent = '✓ Done';
        break;
    }
  });

  // ── Button handlers ──

  btnStart.addEventListener('click', async () => {
    const text = textarea.value.trim();
    if (!text) {
      textarea.focus();
      textarea.style.borderColor = 'var(--danger)';
      setTimeout(() => { textarea.style.borderColor = ''; }, 1500);
      return;
    }

    const config = {
      baseWpm: parseInt(wpmSlider.value),
      errorRate: parseInt(errorSlider.value) / 100,
    };

    try {
      const result = await sendToContent('start', { text, config });
      if (result?.success) {
        setButtons(true, false);
        progressSection.style.display = 'block';
        statusBadge.textContent = 'Typing...';
        progressFill.style.width = '0%';
        progressText.textContent = `0 / ${text.length} (0%)`;
      } else {
        alert('Error: ' + (result?.error || 'Could not start typing.\nClick an input or textarea on the page first.'));
      }
    } catch (err) {
      alert('Could not connect to the page.\nMake sure you are on a regular web page (not chrome:// or about:).');
    }
  });

  btnPause.addEventListener('click', async () => {
    if (isPaused) {
      // Resume
      try {
        const result = await sendToContent('resume');
        if (result?.success) {
          setButtons(true, false);
          statusBadge.textContent = 'Typing...';
        }
      } catch (err) {
        console.error('Resume failed:', err);
      }
    } else {
      // Pause
      try {
        await sendToContent('pause');
        setButtons(true, true);
      } catch (err) {
        console.error('Pause failed:', err);
      }
    }
  });

  btnStop.addEventListener('click', async () => {
    try {
      await sendToContent('stop');
      setButtons(false, false);
      statusBadge.textContent = 'Stopped';
    } catch (err) {
      console.error('Stop failed:', err);
    }
  });

  // ── Slider handlers ──

  wpmSlider.addEventListener('input', updateWpmLabel);
  errorSlider.addEventListener('input', updateErrorLabel);

  // ── Textarea handler ──

  textarea.addEventListener('input', updateCharCount);

  // ── Preset chips ──

  presetChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const wpm = chip.dataset.wpm;
      const error = chip.dataset.error;

      wpmSlider.value = wpm;
      errorSlider.value = error;
      updateWpmLabel();
      updateErrorLabel();

      // Active state
      presetChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });

  // ── Keyboard shortcuts ──

  document.addEventListener('keydown', (e) => {
    // Ctrl+Enter or Cmd+Enter to start
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isRunning) {
        btnStart.click();
      }
    }
    // Escape to stop
    if (e.key === 'Escape' && isRunning) {
      e.preventDefault();
      btnStop.click();
    }
  });

  // ── Init ──

  updateCharCount();
  updateWpmLabel();
  updateErrorLabel();

  // Check current status on the active tab
  (async () => {
    try {
      const status = await sendToContent('getStatus');
      if (status && status.state !== 'IDLE' && status.state !== 'DONE') {
        setButtons(true, status.state === 'PAUSED');
        updateProgress(status);
        currentState = status.state;
      }
    } catch (err) {
      // Content script not ready or not on a supported page — that's fine
    }
  })();
});
