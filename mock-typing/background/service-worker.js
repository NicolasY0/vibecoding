/**
 * service-worker.js — Background Service Worker (Manifest V3).
 *
 * Responsibilities:
 *  - Relay messages between popup and content script (fallback)
 *  - Manage extension icon badge (shows typing state)
 *  - Handle extension lifecycle
 */

// ── Badge management ──

let activeBadge = { text: '', color: '#6b7280' };

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Handle badge updates from content script
  if (msg.action === 'setBadge') {
    activeBadge = { text: msg.text, color: msg.color };
    chrome.action.setBadgeText({ text: msg.text, tabId: sender.tab?.id });
    chrome.action.setBadgeBackgroundColor({ color: msg.color, tabId: sender.tab?.id });
    sendResponse({ success: true });
    return;
  }

  // Fallback: if popup can't reach content script directly,
  // try to relay through the service worker
  if (msg.action === 'relayToContent') {
    relayToActiveTab(msg.payload).then(sendResponse);
    return true; // Keep channel open
  }
});

/**
 * Relay a message to the active tab's content script.
 */
async function relayToActiveTab(payload) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      return { success: false, error: 'No active tab' };
    }
    return await chrome.tabs.sendMessage(tab.id, payload);
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Extension lifecycle ──

chrome.runtime.onInstalled.addListener(() => {
  console.log('[MockTyping] Extension installed');

  // Initialize badge to empty (no text)
  chrome.action.setBadgeText({ text: '' });
  chrome.action.setBadgeBackgroundColor({ color: '#6b7280' });
});

// Clear badge when tab changes
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.action.setBadgeText({ text: '', tabId: activeInfo.tabId });
  chrome.action.setBadgeBackgroundColor({ color: '#6b7280', tabId: activeInfo.tabId });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    chrome.action.setBadgeText({ text: '', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#6b7280', tabId });
  }
});
