const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { SystemManager } = require('./src/managers/system-manager');
const { AutomationManager } = require('./src/managers/automation-manager');
const { DatabaseManager } = require('./src/managers/database-manager');

// Configuration
const store = new Store();
let mainWindow;
let systemManager;
let automationManager;
let databaseManager;

// Création de la fenêtre principale
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#FFF9F3'
  });

  mainWindow.loadFile('src/ui/index.html');

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Initialisation de l'application
async function initialize() {
  try {
    // Initialisation des gestionnaires
    systemManager = new SystemManager();
    automationManager = new AutomationManager();
    databaseManager = new DatabaseManager();

    // Configuration des événements IPC
    setupIpcHandlers();

    // Démarrage des services
    await systemManager.initialize();
    await automationManager.initialize();
    await databaseManager.initialize();

    console.log('Initialisation terminée avec succès');
  } catch (error) {
    console.error('Erreur lors de l\'initialisation:', error);
  }
}

// Configuration des gestionnaires d'événements IPC
function setupIpcHandlers() {
  // Commandes système
  ipcMain.handle('system:execute-command', async (event, command) => {
    return await systemManager.executeCommand(command);
  });

  // Automatisations
  ipcMain.handle('automation:create', async (event, config) => {
    return await automationManager.createAutomation(config);
  });

  // Gestion des fichiers
  ipcMain.handle('files:search', async (event, query) => {
    return await systemManager.searchFiles(query);
  });

  // Paramètres
  ipcMain.handle('settings:get', (event, key) => {
    return store.get(key);
  });

  ipcMain.handle('settings:set', (event, key, value) => {
    store.set(key, value);
  });
}

// Événements de l'application
app.whenReady().then(async () => {
  await initialize();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  console.error('Erreur non capturée:', error);
  // Enregistrement de l'erreur et notification à l'utilisateur
});

// Export pour les tests
module.exports = {
  createWindow,
  initialize
};
