import { CONFIG, MESSAGES } from '../config/constants.js';
import { securityManager } from '../background/security.js';

class Settings {
  constructor() {
    this.form = document.getElementById('settingsForm');
    this.apiKeyInput = document.getElementById('apiKey');
    this.saveBtn = document.getElementById('saveSettings');
    this.statusDiv = document.getElementById('status');
    this.initializeEventListeners();
    this.loadSettings();
  }

  initializeEventListeners() {
    this.saveBtn.addEventListener('click', () => this.saveSettings());
    this.apiKeyInput.addEventListener('input', () => this.validateApiKey());
  }

  async loadSettings() {
    const settings = await chrome.storage.local.get([CONFIG.STORAGE_KEYS.API_KEY]);
    if (settings[CONFIG.STORAGE_KEYS.API_KEY]) {
      this.apiKeyInput.value = settings[CONFIG.STORAGE_KEYS.API_KEY];
    }
  }

  validateApiKey() {
    const apiKey = this.apiKeyInput.value.trim();
    const isValid = apiKey.startsWith('sk-') && apiKey.length > 20;
    this.saveBtn.disabled = !isValid;
    return isValid;
  }

  showStatus(message, isError = false) {
    this.statusDiv.textContent = message;
    this.statusDiv.className = `status-message ${isError ? 'error' : 'success'}`;
    this.statusDiv.style.display = 'block';
    setTimeout(() => {
      this.statusDiv.style.display = 'none';
    }, 3000);
  }

  async saveSettings() {
    const apiKey = this.apiKeyInput.value.trim();
    if (!this.validateApiKey()) {
      this.showStatus('Veuillez entrer une clé API OpenAI valide', true);
      return;
    }

    try {
      const encryptedKey = await securityManager.encrypt(apiKey);
      await chrome.storage.local.set({
        [CONFIG.STORAGE_KEYS.API_KEY]: encryptedKey
      });
      this.showStatus(MESSAGES.SUCCESS.SETTINGS_SAVED);
    } catch (error) {
      this.showStatus(`Erreur de sauvegarde: ${error.message}`, true);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new Settings();
}); 