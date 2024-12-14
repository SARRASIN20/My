const { autoUpdater } = require('electron-updater');
const { app, ipcMain } = require('electron');
const log = require('electron-log');
const isDev = require('electron-is-dev');

class AutoUpdater {
  constructor() {
    this.updateAvailable = false;
    this.updateDownloaded = false;
    this.mainWindow = null;
    this.setupLogging();
  }

  initialize(mainWindow) {
    if (isDev) {
      log.info('Mode développement - Mise à jour automatique désactivée');
      return;
    }

    this.mainWindow = mainWindow;
    this.setupUpdater();
    this.setupEventHandlers();
    this.checkForUpdates();

    // Vérification périodique des mises à jour (toutes les 4 heures)
    setInterval(() => {
      this.checkForUpdates();
    }, 4 * 60 * 60 * 1000);
  }

  setupLogging() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
  }

  setupUpdater() {
    // Configuration de base
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    // Configuration des URLs (à adapter selon votre configuration)
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'votre-organisation',
      repo: 'sahara-assistant',
      private: false,
      releaseType: 'release'
    });
  }

  setupEventHandlers() {
    // Vérification des mises à jour
    autoUpdater.on('checking-for-update', () => {
      this.sendStatusToWindow('Recherche de mises à jour...');
    });

    // Mise à jour disponible
    autoUpdater.on('update-available', (info) => {
      this.updateAvailable = true;
      this.sendStatusToWindow('Mise à jour disponible', {
        version: info.version,
        releaseNotes: info.releaseNotes
      });
      this.showUpdateNotification(info);
    });

    // Aucune mise à jour disponible
    autoUpdater.on('update-not-available', (info) => {
      this.sendStatusToWindow('Vous utilisez la dernière version');
    });

    // Erreur
    autoUpdater.on('error', (err) => {
      this.sendStatusToWindow('Erreur lors de la mise à jour', {
        error: err.message
      });
      log.error('Erreur de mise à jour:', err);
    });

    // Progression du téléchargement
    autoUpdater.on('download-progress', (progressObj) => {
      this.sendStatusToWindow('Téléchargement en cours', {
        progress: progressObj.percent,
        speed: progressObj.bytesPerSecond,
        transferred: progressObj.transferred,
        total: progressObj.total
      });
    });

    // Mise à jour téléchargée
    autoUpdater.on('update-downloaded', (info) => {
      this.updateDownloaded = true;
      this.sendStatusToWindow('Mise à jour prête', {
        version: info.version,
        releaseNotes: info.releaseNotes
      });
      this.showUpdateReadyNotification(info);
    });

    // Gestion des événements IPC
    ipcMain.handle('updater:check', () => {
      return this.checkForUpdates();
    });

    ipcMain.handle('updater:download', () => {
      return this.downloadUpdate();
    });

    ipcMain.handle('updater:install', () => {
      return this.installUpdate();
    });

    ipcMain.handle('updater:status', () => {
      return {
        updateAvailable: this.updateAvailable,
        updateDownloaded: this.updateDownloaded
      };
    });
  }

  async checkForUpdates() {
    try {
      if (!isDev) {
        await autoUpdater.checkForUpdates();
      }
    } catch (error) {
      log.error('Erreur lors de la vérification des mises à jour:', error);
      this.sendStatusToWindow('Erreur de vérification', {
        error: error.message
      });
    }
  }

  async downloadUpdate() {
    try {
      if (this.updateAvailable && !this.updateDownloaded) {
        await autoUpdater.downloadUpdate();
      }
    } catch (error) {
      log.error('Erreur lors du téléchargement de la mise à jour:', error);
      this.sendStatusToWindow('Erreur de téléchargement', {
        error: error.message
      });
    }
  }

  installUpdate() {
    if (this.updateDownloaded) {
      autoUpdater.quitAndInstall(false, true);
    }
  }

  sendStatusToWindow(status, data = {}) {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('updater:status', {
        status,
        ...data,
        timestamp: new Date().toISOString()
      });
    }
    log.info('État de la mise à jour:', status, data);
  }

  showUpdateNotification(info) {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('notification:show', {
        title: 'Mise à jour disponible',
        body: `Une nouvelle version (${info.version}) est disponible. Voulez-vous la télécharger ?`,
        type: 'info',
        actions: ['Télécharger', 'Plus tard']
      });
    }
  }

  showUpdateReadyNotification(info) {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('notification:show', {
        title: 'Mise à jour prête',
        body: 'La mise à jour a été téléchargée. Redémarrez l\'application pour l\'installer.',
        type: 'success',
        actions: ['Redémarrer', 'Plus tard']
      });
    }
  }

  // Méthodes utilitaires
  getUpdateStatus() {
    return {
      updateAvailable: this.updateAvailable,
      updateDownloaded: this.updateDownloaded
    };
  }

  isDevMode() {
    return isDev;
  }
}

module.exports = { AutoUpdater };
