class PopupUI {
  constructor() {
    this.commandInput = document.getElementById('commandInput');
    this.executeBtn = document.getElementById('executeBtn');
    this.statusDiv = document.getElementById('status');
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    this.executeBtn.addEventListener('click', () => this.executeCommand());
    this.commandInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.executeCommand();
    });
  }

  async executeCommand() {
    const command = this.commandInput.value.trim();
    if (!command) {
      this.showStatus('Veuillez entrer une commande', 'error');
      return;
    }

    try {
      // Envoyer la commande au script de contenu
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.tabs.sendMessage(tab.id, { command });

      if (response.success) {
        this.showStatus('Commande exécutée avec succès', 'success');
      } else {
        this.showStatus(response.error || 'Erreur lors de l\'exécution', 'error');
      }
    } catch (error) {
      this.showStatus('Erreur de communication avec la page', 'error');
    }
  }

  showStatus(message, type) {
    this.statusDiv.textContent = message;
    this.statusDiv.className = type;
    this.statusDiv.style.display = 'block';
    setTimeout(() => {
      this.statusDiv.style.display = 'none';
    }, 3000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new PopupUI();
}); 