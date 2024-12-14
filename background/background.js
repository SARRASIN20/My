chrome.runtime.onInstalled.addListener(() => {
  // Initialiser les paramètres par défaut
  chrome.storage.local.set({
    settings: {
      autoFill: true,
      extractionRules: {},
      customCommands: {}
    }
  });
});

// Gérer les messages entre les différentes parties de l'extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'getSettings') {
    chrome.storage.local.get('settings', (data) => {
      sendResponse(data.settings);
    });
    return true;
  }
}); 