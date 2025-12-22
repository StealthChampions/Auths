export default defineBackground(() => {
  // Handle extension installation
  chrome.runtime.onInstalled.addListener((details: chrome.runtime.InstalledDetails) => {
    if (details.reason === 'install') {
      // Extension installed
    } else if (details.reason === 'update') {
      // Extension updated
    }
  });

  // Handle commands
  chrome.commands.onCommand.addListener((command: string) => {
    if (command === 'scan-qr') {
      // Handle QR scan command
    } else if (command === 'autofill') {
      // Handle autofill command
    }
  });

  // Handle messages from content scripts and popup
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'captureVisibleTab') {
      chrome.tabs.captureVisibleTab(undefined, { format: 'png' })
        .then((dataUrl) => {
          sendResponse({ dataUrl });
        })
        .catch((error) => {
          sendResponse({ error: error.message });
        });
      return true; // Will respond asynchronously
    }
  });
});
