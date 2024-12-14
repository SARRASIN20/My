const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs').promises;
const { NlpManager } = require('node-nlp');

class AutomationManager {
  constructor() {
    this.nlp = new NlpManager({ languages: ['fr'] });
    this.automations = new Map();
    this.watchers = new Map();
  }

  async initialize() {
    try {
      await this.loadAutomations();
      await this.trainNLP();
      console.log('AutomationManager initialisé avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'initialisation de AutomationManager:', error);
      throw error;
    }
  }

  async loadAutomations() {
    try {
      const automationsPath = path.join(__dirname, '../data/automations.json');
      const data = await fs.readFile(automationsPath, 'utf8');
      const automations = JSON.parse(data);

      automations.forEach(automation => {
        this.automations.set(automation.id, automation);
      });
    } catch (error) {
      console.warn('Aucune automation existante trouvée');
    }
  }

  async trainNLP() {
    // Ajout des intentions
    this.nlp.addDocument('fr', 'surveiller le dossier *', 'watch.folder');
    this.nlp.addDocument('fr', 'automatiser la sauvegarde de *', 'backup');
    this.nlp.addDocument('fr', 'déplacer les fichiers * vers *', 'move.files');
    this.nlp.addDocument('fr', 'trier les fichiers dans *', 'sort.files');

    // Ajout des entités
    this.nlp.addNamedEntityText('folder', 'Documents', ['fr'], ['documents', 'mes documents']);
    this.nlp.addNamedEntityText('folder', 'Images', ['fr'], ['images', 'mes images', 'photos']);
    this.nlp.addNamedEntityText('folder', 'Téléchargements', ['fr'], ['téléchargements', 'downloads']);

    await this.nlp.train();
  }

  async createAutomation(config) {
    const { type, trigger, action, options } = config;
    const id = Date.now().toString();

    const automation = {
      id,
      type,
      trigger,
      action,
      options,
      enabled: true,
      created: new Date().toISOString()
    };

    try {
      await this.validateAutomation(automation);
      this.automations.set(id, automation);
      await this.saveAutomations();
      await this.startAutomation(automation);

      return { success: true, automation };
    } catch (error) {
      throw new Error(`Erreur lors de la création de l'automation: ${error.message}`);
    }
  }

  async startAutomation(automation) {
    switch (automation.type) {
      case 'folder-watch':
        await this.startFolderWatch(automation);
        break;
      case 'schedule':
        await this.startSchedule(automation);
        break;
      case 'file-trigger':
        await this.startFileTrigger(automation);
        break;
      default:
        throw new Error(`Type d'automation non supporté: ${automation.type}`);
    }
  }

  async startFolderWatch(automation) {
    const { path: watchPath, patterns } = automation.trigger;
    
    const watcher = chokidar.watch(watchPath, {
      ignored: /(^|[\/\\])\../, // Ignore les fichiers cachés
      persistent: true,
      ignoreInitial: true
    });

    watcher
      .on('add', path => this.handleFileEvent('add', path, automation))
      .on('change', path => this.handleFileEvent('change', path, automation))
      .on('unlink', path => this.handleFileEvent('unlink', path, automation));

    this.watchers.set(automation.id, watcher);
  }

  async startSchedule(automation) {
    const { schedule } = automation.trigger;
    // Implémentation du planificateur
  }

  async startFileTrigger(automation) {
    const { pattern, folder } = automation.trigger;
    // Implémentation du déclencheur de fichier
  }

  async handleFileEvent(event, filePath, automation) {
    try {
      const { action, options } = automation;

      switch (action.type) {
        case 'move':
          await this.moveFile(filePath, action.destination);
          break;
        case 'copy':
          await this.copyFile(filePath, action.destination);
          break;
        case 'rename':
          await this.renameFile(filePath, action.pattern);
          break;
        case 'delete':
          await this.deleteFile(filePath);
          break;
        default:
          console.warn(`Type d'action non supporté: ${action.type}`);
      }
    } catch (error) {
      console.error(`Erreur lors du traitement de l'événement fichier:`, error);
    }
  }

  // Méthodes d'action sur les fichiers
  async moveFile(source, destination) {
    const fileName = path.basename(source);
    const destPath = path.join(destination, fileName);
    await fs.mkdir(destination, { recursive: true });
    await fs.rename(source, destPath);
  }

  async copyFile(source, destination) {
    const fileName = path.basename(source);
    const destPath = path.join(destination, fileName);
    await fs.mkdir(destination, { recursive: true });
    await fs.copyFile(source, destPath);
  }

  async renameFile(filePath, pattern) {
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const newName = pattern.replace('*', path.basename(filePath, ext));
    const newPath = path.join(dir, newName + ext);
    await fs.rename(filePath, newPath);
  }

  async deleteFile(filePath) {
    await fs.unlink(filePath);
  }

  // Méthodes utilitaires
  async validateAutomation(automation) {
    if (!automation.type || !automation.trigger || !automation.action) {
      throw new Error('Configuration d\'automation invalide');
    }

    // Validation spécifique selon le type
    switch (automation.type) {
      case 'folder-watch':
        if (!automation.trigger.path) {
          throw new Error('Chemin de surveillance non spécifié');
        }
        break;
      case 'schedule':
        if (!automation.trigger.schedule) {
          throw new Error('Planning non spécifié');
        }
        break;
    }
  }

  async saveAutomations() {
    try {
      const automationsPath = path.join(__dirname, '../data/automations.json');
      const data = JSON.stringify([...this.automations.values()], null, 2);
      await fs.writeFile(automationsPath, data, 'utf8');
    } catch (error) {
      throw new Error(`Erreur lors de la sauvegarde des automations: ${error.message}`);
    }
  }

  stopAutomation(id) {
    const watcher = this.watchers.get(id);
    if (watcher) {
      watcher.close();
      this.watchers.delete(id);
    }
  }

  async updateAutomation(id, updates) {
    const automation = this.automations.get(id);
    if (!automation) {
      throw new Error('Automation non trouvée');
    }

    const updatedAutomation = { ...automation, ...updates };
    await this.validateAutomation(updatedAutomation);

    this.stopAutomation(id);
    this.automations.set(id, updatedAutomation);
    await this.saveAutomations();
    await this.startAutomation(updatedAutomation);

    return updatedAutomation;
  }

  async deleteAutomation(id) {
    this.stopAutomation(id);
    this.automations.delete(id);
    await this.saveAutomations();
  }
}

module.exports = { AutomationManager };
