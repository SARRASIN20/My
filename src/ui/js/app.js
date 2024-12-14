// Importation des modules
import { UIManager } from './ui-manager.js';
import { CommandManager } from './command-manager.js';
import { ThemeManager } from './theme-manager.js';
import { SystemMonitor } from './system-monitor.js';
import { AutomationUI } from './automation-ui.js';
import { FileExplorer } from './file-explorer.js';

// Initialisation de l'application
class App {
  constructor() {
    this.uiManager = new UIManager();
    this.commandManager = new CommandManager();
    this.themeManager = new ThemeManager();
    this.systemMonitor = new SystemMonitor();
    this.automationUI = new AutomationUI();
    this.fileExplorer = new FileExplorer();

    this.initialize();
  }

  async initialize() {
    try {
      // Initialisation des gestionnaires
      await this.uiManager.initialize();
      await this.commandManager.initialize();
      await this.themeManager.initialize();
      await this.systemMonitor.initialize();
      await this.automationUI.initialize();
      await this.fileExplorer.initialize();

      // Configuration des écouteurs d'événements
      this.setupEventListeners();

      console.log('Application initialisée avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'initialisation:', error);
      this.showError('Erreur lors de l\'initialisation de l\'application');
    }
  }

  setupEventListeners() {
    // Gestion de la barre de titre
    document.getElementById('minimizeBtn').addEventListener('click', () => {
      window.electron.minimize();
    });

    document.getElementById('maximizeBtn').addEventListener('click', () => {
      window.electron.maximize();
    });

    document.getElementById('closeBtn').addEventListener('click', () => {
      window.electron.close();
    });

    // Gestion des commandes
    const commandInput = document.getElementById('commandInput');
    const executeBtn = document.getElementById('executeCommandBtn');
    const voiceBtn = document.getElementById('voiceCommandBtn');

    commandInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.executeCommand(commandInput.value);
      }
    });

    executeBtn.addEventListener('click', () => {
      this.executeCommand(commandInput.value);
    });

    voiceBtn.addEventListener('click', () => {
      this.startVoiceRecognition();
    });

    // Navigation
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const view = item.dataset.view;
        this.uiManager.switchView(view);
      });
    });

    // Suggestions
    const suggestionCards = document.querySelectorAll('.suggestion-card');
    suggestionCards.forEach(card => {
      card.addEventListener('click', () => {
        const command = card.querySelector('.text').textContent;
        commandInput.value = command;
        this.executeCommand(command);
      });
    });
  }

  async executeCommand(command) {
    try {
      const result = await this.commandManager.execute(command);
      this.displayResult(result);
    } catch (error) {
      console.error('Erreur lors de l\'exécution de la commande:', error);
      this.showError('Erreur lors de l\'exécution de la commande');
    }
  }

  startVoiceRecognition() {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'fr-FR';

      recognition.onstart = () => {
        document.getElementById('voiceCommandBtn').classList.add('recording');
      };

      recognition.onresult = (event) => {
        const command = event.results[0][0].transcript;
        document.getElementById('commandInput').value = command;
        this.executeCommand(command);
      };

      recognition.onerror = (event) => {
        console.error('Erreur de reconnaissance vocale:', event.error);
        this.showError('Erreur lors de la reconnaissance vocale');
      };

      recognition.onend = () => {
        document.getElementById('voiceCommandBtn').classList.remove('recording');
      };

      recognition.start();
    } else {
      this.showError('La reconnaissance vocale n\'est pas supportée par votre navigateur');
    }
  }

  displayResult(result) {
    const resultsContainer = document.getElementById('commandResults');
    const resultElement = document.createElement('div');
    resultElement.classList.add('result-item', 'fade-in');

    if (result.success) {
      resultElement.innerHTML = `
        <div class="result-success">
          <span class="icon">✓</span>
          <span class="message">${result.message}</span>
        </div>
      `;
    } else {
      resultElement.innerHTML = `
        <div class="result-error">
          <span class="icon">✗</span>
          <span class="message">${result.error}</span>
        </div>
      `;
    }

    resultsContainer.insertBefore(resultElement, resultsContainer.firstChild);

    // Limiter le nombre de résultats affichés
    while (resultsContainer.children.length > 10) {
      resultsContainer.removeChild(resultsContainer.lastChild);
    }
  }

  showError(message) {
    // Implémenter l'affichage des erreurs
    console.error(message);
  }
}

// Démarrage de l'application
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
