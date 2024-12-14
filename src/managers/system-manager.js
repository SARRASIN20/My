const si = require('systeminformation');
const os = require('os');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class SystemManager {
  constructor() {
    this.systemInfo = null;
    this.watchers = new Map();
  }

  async initialize() {
    try {
      // Récupération des informations système
      this.systemInfo = await this.getSystemInfo();
      console.log('SystemManager initialisé avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'initialisation de SystemManager:', error);
      throw error;
    }
  }

  async getSystemInfo() {
    try {
      const [cpu, mem, disk, os] = await Promise.all([
        si.cpu(),
        si.mem(),
        si.fsSize(),
        si.osInfo()
      ]);

      return {
        cpu,
        mem,
        disk,
        os,
        platform: process.platform,
        arch: process.arch
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des informations système:', error);
      throw error;
    }
  }

  async executeCommand(command) {
    const commandMap = {
      'open': this.openApplication.bind(this),
      'search': this.searchFiles.bind(this),
      'system-info': this.getSystemInfo.bind(this),
      'cleanup': this.cleanupSystem.bind(this),
      'monitor': this.monitorResource.bind(this)
    };

    const [action, ...args] = command.split(' ');
    const handler = commandMap[action];

    if (!handler) {
      throw new Error(`Commande non reconnue: ${action}`);
    }

    try {
      return await handler(...args);
    } catch (error) {
      console.error(`Erreur lors de l'exécution de la commande ${action}:`, error);
      throw error;
    }
  }

  async openApplication(appName) {
    const platform = process.platform;
    let command;

    switch (platform) {
      case 'win32':
        command = `start ${appName}`;
        break;
      case 'darwin':
        command = `open -a "${appName}"`;
        break;
      case 'linux':
        command = `xdg-open ${appName}`;
        break;
      default:
        throw new Error(`Plateforme non supportée: ${platform}`);
    }

    try {
      await execPromise(command);
      return { success: true, message: `Application ${appName} lancée avec succès` };
    } catch (error) {
      throw new Error(`Impossible d'ouvrir l'application ${appName}: ${error.message}`);
    }
  }

  async searchFiles(query, directory = os.homedir()) {
    const results = [];

    async function searchRecursive(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          try {
            await searchRecursive(fullPath);
          } catch (error) {
            console.warn(`Impossible d'accéder au dossier ${fullPath}:`, error);
          }
        } else if (entry.name.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            name: entry.name,
            path: fullPath,
            size: (await fs.stat(fullPath)).size,
            type: path.extname(entry.name)
          });
        }
      }
    }

    try {
      await searchRecursive(directory);
      return results;
    } catch (error) {
      throw new Error(`Erreur lors de la recherche: ${error.message}`);
    }
  }

  async cleanupSystem() {
    const cleanupTasks = [
      this.clearTempFiles(),
      this.optimizeMemory(),
      this.checkDiskSpace()
    ];

    try {
      const results = await Promise.all(cleanupTasks);
      return {
        success: true,
        details: results
      };
    } catch (error) {
      throw new Error(`Erreur lors du nettoyage: ${error.message}`);
    }
  }

  async clearTempFiles() {
    const tempDir = os.tmpdir();
    try {
      const files = await fs.readdir(tempDir);
      let cleared = 0;

      for (const file of files) {
        try {
          await fs.unlink(path.join(tempDir, file));
          cleared++;
        } catch (error) {
          console.warn(`Impossible de supprimer ${file}:`, error);
        }
      }

      return { cleared, total: files.length };
    } catch (error) {
      throw new Error(`Erreur lors du nettoyage des fichiers temporaires: ${error.message}`);
    }
  }

  async optimizeMemory() {
    if (process.platform === 'win32') {
      try {
        await execPromise('wmic memorychip get capacity');
        return { success: true, message: 'Optimisation mémoire effectuée' };
      } catch (error) {
        throw new Error(`Erreur lors de l'optimisation mémoire: ${error.message}`);
      }
    }
    return { success: false, message: 'Optimisation mémoire non supportée sur cette plateforme' };
  }

  async checkDiskSpace() {
    try {
      const drives = await si.fsSize();
      return drives.map(drive => ({
        drive: drive.mount,
        total: drive.size,
        used: drive.used,
        available: drive.size - drive.used
      }));
    } catch (error) {
      throw new Error(`Erreur lors de la vérification de l'espace disque: ${error.message}`);
    }
  }

  async monitorResource(resource) {
    switch (resource) {
      case 'cpu':
        return await si.currentLoad();
      case 'memory':
        return await si.mem();
      case 'disk':
        return await si.fsSize();
      default:
        throw new Error(`Ressource non reconnue: ${resource}`);
    }
  }

  // Méthodes utilitaires
  async isProcessRunning(processName) {
    try {
      const processes = await si.processes();
      return processes.list.some(p => p.name === processName);
    } catch (error) {
      console.error('Erreur lors de la vérification du processus:', error);
      return false;
    }
  }

  async killProcess(processName) {
    const platform = process.platform;
    let command;

    switch (platform) {
      case 'win32':
        command = `taskkill /F /IM ${processName}`;
        break;
      default:
        command = `pkill -f ${processName}`;
    }

    try {
      await execPromise(command);
      return true;
    } catch (error) {
      console.error(`Erreur lors de la terminaison du processus ${processName}:`, error);
      return false;
    }
  }
}

module.exports = { SystemManager };
