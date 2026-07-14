/**
 * popup.js — Popup UI logic for Mock Typing.
 * Includes random text generation across multiple genres.
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
  const btnGenerate = document.getElementById('btn-generate');
  const genChips = document.querySelectorAll('.gen-chip');
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

      presetChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });

  // ── Random Text Generation ──

  /**
   * Text corpus organized by genre.
   * Each entry is a self-contained paragraph/snippet suitable for typing.
   */
  const TEXT_CORPUS = {
    essay: [
      "The rapid advancement of artificial intelligence has fundamentally transformed how we interact with technology. From voice assistants that understand natural language to recommendation systems that predict our preferences, AI has become an invisible yet indispensable part of daily life. However, this progress raises important questions about privacy, accountability, and the future of human labor. As we delegate more decisions to algorithms, we must ensure that these systems remain transparent, fair, and aligned with human values.",

      "Climate change represents one of the most pressing challenges of our time. Rising global temperatures, extreme weather events, and shifting ecosystems demand immediate and coordinated action from governments, businesses, and individuals alike. While the scale of the problem can feel overwhelming, history has shown that collective human effort can overcome seemingly insurmountable obstacles. The transition to renewable energy, sustainable agriculture, and circular economies is not just necessary — it is already underway.",

      "The concept of minimalism extends far beyond aesthetic choices or lifestyle trends. At its core, minimalism is about intentionality: focusing on what truly matters and eliminating excess that distracts from those priorities. In a world of constant notifications, infinite scrolling, and consumer culture, choosing to own less and do less can be a radical act of self-care. The freedom that comes from having fewer possessions and commitments often leads to greater creativity, deeper relationships, and a more meaningful existence.",

      "Education systems around the world are undergoing a profound transformation. The traditional model of lectures, textbooks, and standardized tests is being challenged by project-based learning, digital tools, and personalized curricula. Students today need not just knowledge but the ability to think critically, collaborate across cultures, and adapt to rapidly changing circumstances. The most successful educational approaches recognize that learning is a lifelong journey rather than a destination reached at graduation.",

      "The history of the internet is a testament to human ingenuity and the power of open collaboration. What began as a military research project evolved into a global network connecting billions of people. Each generation has built upon the work of those who came before, creating an ever-expanding digital commons. Yet with this connectivity comes new vulnerabilities — cybersecurity threats, misinformation, and digital divides that risk leaving the most vulnerable behind.",
    ],

    chinese: [
      "人工智能技术的快速发展正在深刻改变我们的生活方式。从智能手机中的语音助手到自动驾驶汽车，AI已经渗透到日常生活的方方面面。然而，技术进步带来的不仅是便利，还有关于隐私保护、就业市场变革以及伦理边界的深层思考。我们需要在拥抱创新的同时，建立完善的监管框架，确保技术发展始终服务于人类福祉。",

      "在这个信息爆炸的时代，学会筛选和整理知识比单纯获取知识更为重要。每个人每天接触的信息量相当于古人一生的见闻，但真正有价值的洞见往往隐藏在噪音之中。培养批判性思维，建立个人知识管理系统，能够帮助我们在纷繁复杂的世界中保持清醒的头脑，做出更加明智的决策。",

      "阅读是通往智慧最古老也是最高效的途径之一。一本好书不仅是作者思想的结晶，更是跨越时空的对话。在快节奏的现代生活中，每天抽出半小时沉浸在文字的世界里，既能放松身心，又能拓展视野。无论是文学小说、历史传记还是科普读物，每本书都是一次独特的旅程。",

      "创业之路从来不是一帆风顺的。成功的创业者往往具备共同的特质：坚定的信念、快速的执行能力以及从失败中学习的韧性。在创业初期，资源匮乏反而可能成为创新的催化剂，迫使团队用更聪明的方式解决问题。真正伟大的公司，往往诞生于对现状的不满和改变世界的朴素愿望。",
    ],

    code: [
      "function binarySearch(arr, target) {\n  let left = 0;\n  let right = arr.length - 1;\n  while (left <= right) {\n    const mid = Math.floor((left + right) / 2);\n    if (arr[mid] === target) return mid;\n    if (arr[mid] < target) left = mid + 1;\n    else right = mid - 1;\n  }\n  return -1;\n}",

      "const fibonacci = (n, memo = {}) => {\n  if (n <= 1) return n;\n  if (memo[n]) return memo[n];\n  memo[n] = fibonacci(n - 1, memo) + fibonacci(n - 2, memo);\n  return memo[n];\n};",

      "def quicksort(arr):\n    if len(arr) <= 1:\n        return arr\n    pivot = arr[len(arr) // 2]\n    left = [x for x in arr if x < pivot]\n    middle = [x for x in arr if x == pivot]\n    right = [x for x in arr if x > pivot]\n    return quicksort(left) + middle + quicksort(right)",
    ],

    lorem: [
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
    ],

    social: [
      "Hey everyone! Just wanted to share some exciting news — I finally launched my side project after months of working on it during evenings and weekends. It's been quite a journey with lots of late nights and coffee, but seeing it live makes it all worth it. If you're thinking about starting your own project, my advice is to just begin. Don't wait for the perfect moment because it never comes. Start small, iterate fast, and don't be afraid to show imperfect work. The feedback you get along the way is more valuable than any tutorial or course. 🚀✨",

      "Hot take: the best productivity hack isn't a new app or technique — it's learning to say no. Every time you say yes to something, you're saying no to something else. Guard your time like it's your most valuable asset, because it is. A focused hour of deep work beats an entire distracted day. Turn off notifications, close those extra tabs, and give yourself permission to do one thing at a time. Your brain will thank you.",
    ],

    business: [
      "Dear Team,\n\nI want to thank everyone for their hard work this quarter. We have exceeded our targets across all key metrics, and this success is a direct result of your dedication and collaboration. As we look ahead to Q3, our focus will shift toward expanding into new markets while continuing to improve our core product offering.\n\nPlease take some time this week to review the updated roadmap and share any feedback or concerns. We will discuss this in more detail during Thursday's all-hands meeting.\n\nBest regards,\nManagement",

      "Subject: Project Update — Phase 2 Completion\n\nHi all,\n\nQuick update on the Phase 2 milestone: all deliverables have been completed ahead of schedule. The QA team has signed off on the core features, and we are ready to begin the UAT process next Monday.\n\nKey achievements:\n- Backend API refactor completed (30% latency improvement)\n- New onboarding flow shipped to 100% of users\n- Critical bug SLAs met for the third consecutive sprint\n\nNext steps are outlined in the attached document. Please review before our standup tomorrow at 9 AM.\n\nCheers,\nAlex",
    ],
  };

  /**
   * Pick a random item from an array.
   */
  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /**
   * Fill the textarea with random text from the given genre.
   * If no genre specified, picks a random genre first.
   */
  function generateText(genre) {
    if (!genre) {
      // Pick a random genre
      const genres = Object.keys(TEXT_CORPUS);
      genre = pickRandom(genres);
    }

    const entries = TEXT_CORPUS[genre];
    if (!entries || entries.length === 0) return;

    const text = pickRandom(entries);
    textarea.value = text;
    updateCharCount();

    // Highlight the matching genre chip
    genChips.forEach(c => {
      c.classList.toggle('active', c.dataset.genre === genre);
    });

    // Animate the generate button
    btnGenerate.classList.add('pulse');
    setTimeout(() => btnGenerate.classList.remove('pulse'), 400);
  }

  // ── Generate button handlers ──

  btnGenerate.addEventListener('click', () => {
    generateText(); // Random genre
  });

  genChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      generateText(chip.dataset.genre);
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
    // Ctrl+G to generate random text
    if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
      e.preventDefault();
      generateText();
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
