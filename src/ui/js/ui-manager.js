export class UIManager {
  constructor() {
    this.currentView = 'assistant';
    this.views = new Map();
    this.notifications = [];
  }

  async initialize() {
    try {
      this.initializeViews();
      this.setupEventListeners();
      this.setupThemeHandling();
      this.setupNotifications();
      console.log('UIManager initialisé avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'initialisation de UIManager:', error);
      throw error;
    }
  }

  initializeViews() {
    const viewElements = document.querySelectorAll('.view');
    viewElements.forEach(element => {
      const viewName = element.id.replace('-view', '');
      this.views.set(viewName, element);
    });
  }

  setupEventListeners() {
    // Navigation
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const view = item.dataset.view;
        this.switchView(view);
      });
    });

    // Contrôles de la fenêtre
    document.getElementById('minimizeBtn').addEventListener('click', () => {
      window.electron.minimize();
    });

    document.getElementById('maximizeBtn').addEventListener('click', () => {
      window.electron.maximize();
    });

    document.getElementById('closeBtn').addEventListener('click', () => {
      window.electron.close();
    });

    // Gestion du redimensionnement
    window.addEventListener('resize', () => {
      this.handleResize();
    });
  }

  setupThemeHandling() {
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
      themeSelect.addEventListener('change', (e) => {
        this.changeTheme(e.target.value);
      });

      // Charger le thème sauvegardé
      window.electron.getSetting('theme').then(theme => {
        if (theme) {
          this.changeTheme(theme);
          themeSelect.value = theme;
        }
      });
    }
  }

  setupNotifications() {
    const notificationContainer = document.createElement('div');
    notificationContainer.className = 'notification-container';
    document.body.appendChild(notificationContainer);
  }

  switchView(viewName) {
    if (!this.views.has(viewName)) {
      console.error(`Vue non trouvée: ${viewName}`);
      return;
    }

    // Mettre à jour les classes actives
    this.views.forEach((view, name) => {
      view.classList.toggle('active', name === viewName);
    });

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.classList.toggle('active', item.dataset.view === viewName);
    });

    this.currentView = viewName;
    this.handleViewTransition(viewName);
  }

  handleViewTransition(viewName) {
    // Animation de transition
    const view = this.views.get(viewName);
    view.style.opacity = '0';
    view.classList.add('fade-in');
    
    setTimeout(() => {
      view.style.opacity = '1';
      setTimeout(() => {
        view.classList.remove('fade-in');
      }, 300);
    }, 50);

    // Actions spécifiques par vue
    switch (viewName) {
      case 'assistant':
        this.focusCommandInput();
        break;
      case 'system':
        this.updateSystemMetrics();
        break;
      case 'files':
        this.refreshFileExplorer();
        break;
    }
  }

  focusCommandInput() {
    const commandInput = document.getElementById('commandInput');
    if (commandInput) {
      commandInput.focus();
    }
  }

  async updateSystemMetrics() {
    try {
      const metrics = await window.electron.getSystemInfo();
      this.updateMetricsDisplay(metrics);
    } catch (error) {
      console.error('Erreur lors de la mise à jour des métriques:', error);
      this.showError('Impossible de mettre à jour les métriques système');
    }
  }

  updateMetricsDisplay(metrics) {
    const { cpu, memory, disk } = metrics;

    // Mise à jour CPU
    const cpuUsage = document.getElementById('cpuUsage');
    if (cpuUsage) {
      cpuUsage.textContent = `CPU: ${cpu.usage.toFixed(1)}%`;
    }

    // Mise à jour mémoire
    const memoryUsage = document.getElementById('memoryUsage');
    if (memoryUsage) {
      const usedMemory = (memory.used / memory.total * 100).toFixed(1);
      memoryUsage.textContent = `RAM: ${usedMemory}%`;
    }

    // Mise à jour des graphiques si présents
    this.updateCharts(metrics);
  }

  updateCharts(metrics) {
    // Implémentation des graphiques avec une bibliothèque comme Chart.js
  }

  async refreshFileExplorer() {
    const explorer = document.getElementById('filesExplorer');
    if (!explorer) return;

    try {
      const files = await window.electron.listFiles();
      this.renderFileList(files, explorer);
    } catch (error) {
      console.error('Erreur lors du rafraîchissement de l\'explorateur:', error);
      this.showError('Impossible de charger les fichiers');
    }
  }

  renderFileList(files, container) {
    container.innerHTML = '';
    files.forEach(file => {
      const fileElement = this.createFileElement(file);
      container.appendChild(fileElement);
    });
  }

  createFileElement(file) {
    const element = document.createElement('div');
    element.className = 'file-item';
    element.innerHTML = `
      <span class="file-icon">${this.getFileIcon(file.type)}</span>
      <span class="file-name">${file.name}</span>
      <span class="file-size">${this.formatFileSize(file.size)}</span>
    `;
    return element;
  }

  getFileIcon(type) {
    const icons = {
      folder: '📁',
      text: '📄',
      image: '🖼️',
      audio: '🎵',
      video: '🎬',
      default: '📄'
    };
    return icons[type] || icons.default;
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  showNotification(message, type = 'info', duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type} fade-in`;
    notification.innerHTML = `
      <span class="notification-icon">${this.getNotificationIcon(type)}</span>
      <span class="notification-message">${message}</span>
    `;

    const container = document.querySelector('.notification-container');
    container.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => {
        container.removeChild(notification);
      }, 300);
    }, duration);

    this.notifications.push(notification);
    if (this.notifications.length > 3) {
      const oldNotification = this.notifications.shift();
      oldNotification.remove();
    }
  }

  getNotificationIcon(type) {
    const icons = {
      success: '✓',
      error: '✗',
      warning: '⚠',
      info: 'ℹ'
    };
    return icons[type] || icons.info;
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showWarning(message) {
    this.showNotification(message, 'warning');
  }

  handleResize() {
    const isMobile = window.innerWidth <= 768;
    document.body.classList.toggle('mobile', isMobile);
    this.adjustLayoutForScreenSize();
  }

  adjustLayoutForScreenSize() {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    
    if (window.innerWidth <= 768) {
      sidebar.style.width = '60px';
      mainContent.style.marginLeft = '60px';
    } else {
      sidebar.style.width = '250px';
      mainContent.style.marginLeft = '250px';
    }
  }

  changeTheme(themeName) {
    document.body.className = `theme-${themeName}`;
    window.electron.setSetting('theme', themeName);
  }
}

// Export de la classe
export default UIManager;
