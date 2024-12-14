import { CONFIG, MESSAGES } from '../config/constants.js';
import { securityManager } from '../background/security.js';

class WebAutomator {
  constructor() {
    this.commands = {};
    this.initializeCommands();
  }

  initializeCommands() {
    this.commands = {
      [CONFIG.COMMANDS.FILL]: this.fillForm.bind(this),
      [CONFIG.COMMANDS.EXTRACT]: this.extractData.bind(this)
    };
  }

  async executeCommand(commandText) {
    try {
      const openAIResponse = await this.analyzeCommand(commandText);
      const { action, parameters } = JSON.parse(openAIResponse);

      if (this.commands[action]) {
        return await this.commands[action](parameters);
      } else {
        throw new Error(MESSAGES.ERRORS.INVALID_COMMAND);
      }
    } catch (error) {
      throw new Error(`Erreur d'exécution: ${error.message}`);
    }
  }

  async analyzeCommand(commandText) {
    try {
      const response = await fetch(CONFIG.API.ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getApiKey()}`
        },
        body: JSON.stringify({
          model: CONFIG.API.MODEL,
          messages: [{
            role: "system",
            content: `Analyse la commande utilisateur et retourne un JSON avec:
              - 'action': soit '${CONFIG.COMMANDS.FILL}' pour remplir un formulaire, soit '${CONFIG.COMMANDS.EXTRACT}' pour extraire des données
              - 'parameters': un objet contenant les paramètres nécessaires pour l'action`
          }, {
            role: "user",
            content: commandText
          }],
          temperature: 0.7
        })
      });

      await this.validateResponse(response);
      const data = await response.json();
      
      try {
        JSON.parse(data.choices[0].message.content);
      } catch (e) {
        throw new Error(MESSAGES.ERRORS.INVALID_RESPONSE);
      }
      
      return data.choices[0].message.content;
    } catch (error) {
      throw new Error(`Erreur d'analyse: ${error.message}`);
    }
  }

  async getApiKey() {
    const result = await chrome.storage.local.get(CONFIG.STORAGE_KEYS.API_KEY);
    if (!result[CONFIG.STORAGE_KEYS.API_KEY]) {
      throw new Error(MESSAGES.ERRORS.NO_API_KEY);
    }
    const decryptedKey = await securityManager.decrypt(result[CONFIG.STORAGE_KEYS.API_KEY]);
    return decryptedKey;
  }

  async fillForm(parameters) {
    const formFields = document.querySelectorAll('input, textarea, select');
    let filled = false;

    for (const field of formFields) {
      const value = parameters[field.name] || parameters[field.id];
      if (value) {
        field.value = value;
        filled = true;
      }
    }

    if (!filled) {
      throw new Error(MESSAGES.ERRORS.NO_FIELDS_FILLED);
    }

    return { message: MESSAGES.SUCCESS.FORM_FILLED };
  }

  async extractData(parameters) {
    const data = {};
    const selectors = parameters.selectors || {};

    for (const [key, selector] of Object.entries(selectors)) {
      const element = document.querySelector(selector);
      if (element) {
        data[key] = element.textContent.trim();
      }
    }

    return { data };
  }

  async validateResponse(response) {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || 
        `Erreur API (${response.status}): ${response.statusText}`
      );
    }
    return response;
  }
}

const automator = new WebAutomator();

// Écouter les messages du popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.command) {
    automator.executeCommand(request.command)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
}); 