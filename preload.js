const { contextBridge, ipcRenderer } = require('electron');

// Exposition des APIs sécurisées pour le renderer process
contextBridge.exposeInMainWorld('electron', {
  // Contrôle de la fenêtre
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // Commandes système
  executeCommand: (command) => ipcRenderer.invoke('system:execute-command', command),
  
  // Gestion des fichiers
  searchFiles: (query) => ipcRenderer.invoke('files:search', query),
  openFile: (path) => ipcRenderer.invoke('files:open', path),
  saveFile: (path, content) => ipcRenderer.invoke('files:save', path, content),
  
  // Automatisations
  createAutomation: (config) => ipcRenderer.invoke('automation:create', config),
  updateAutomation: (id, config) => ipcRenderer.invoke('automation:update', id, config),
  deleteAutomation: (id) => ipcRenderer.invoke('automation:delete', id),
  getAutomations: () => ipcRenderer.invoke('automation:list'),
  
  // Paramètres
  getSetting: (key) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  
  // Système
  getSystemInfo: () => ipcRenderer.invoke('system:info'),
  monitorSystem: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('system:monitor', subscription);
    return () => {
      ipcRenderer.removeListener('system:monitor', subscription);
    };
  },

  // Notifications
  showNotification: (options) => ipcRenderer.invoke('notification:show', options),
  
  // Gestion des erreurs
  onError: (callback) => {
    const subscription = (event, error) => callback(error);
    ipcRenderer.on('error', subscription);
    return () => {
      ipcRenderer.removeListener('error', subscription);
    };
  }
});

// Initialisation
window.addEventListener('DOMContentLoaded', () => {
  console.log('Preload script chargé');
});
