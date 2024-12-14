const fs = require('fs').promises;
const path = require('path');
const archiver = require('archiver');
const { createReadStream, createWriteStream } = require('fs');
const { EncryptionManager } = require('../security/encryption');
const { DatabaseManager } = require('../managers/database-manager');

class BackupManager {
  constructor() {
    this.encryptionManager = new EncryptionManager();
    this.databaseManager = new DatabaseManager();
    this.backupDir = path.join(__dirname, '../data/backups');
    this.maxBackups = 5; // Nombre maximum de sauvegardes à conserver
  }

  async initialize() {
    try {
      await this.encryptionManager.initialize();
      await fs.mkdir(this.backupDir, { recursive: true });
      console.log('BackupManager initialisé avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'initialisation de BackupManager:', error);
      throw error;
    }
  }

  async createBackup(userId = null) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `backup_${userId || 'system'}_${timestamp}`;
      const backupPath = path.join(this.backupDir, `${backupName}.zip`);
      const tempPath = path.join(this.backupDir, `${backupName}_temp.zip`);

      // Création de l'archive
      const output = createWriteStream(tempPath);
      const archive = archiver('zip', {
        zlib: { level: 9 } // Niveau de compression maximum
      });

      // Gestion des événements de l'archive
      archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
          console.warn('Avertissement lors de la création de la sauvegarde:', err);
        } else {
          throw err;
        }
      });

      archive.on('error', (err) => {
        throw err;
      });

      // Pipe de l'archive vers le fichier
      archive.pipe(output);

      // Sauvegarde de la base de données
      const dbPath = path.join(__dirname, '../data/sahara.db');
      const dbBackup = await this.databaseManager.backup();
      archive.append(dbBackup, { name: 'database.sqlite' });

      // Sauvegarde des fichiers de configuration
      const configPath = path.join(__dirname, '../config');
      try {
        const configFiles = await fs.readdir(configPath);
        for (const file of configFiles) {
          const filePath = path.join(configPath, file);
          archive.file(filePath, { name: `config/${file}` });
        }
      } catch (error) {
        console.warn('Aucun fichier de configuration trouvé');
      }

      // Sauvegarde des données utilisateur
      if (userId) {
        const userDataPath = path.join(__dirname, `../data/users/${userId}`);
        try {
          await this.archiveDirectory(archive, userDataPath, 'user_data');
        } catch (error) {
          console.warn('Aucune donnée utilisateur trouvée');
        }
      }

      // Finalisation de l'archive
      await archive.finalize();

      // Attente de la fin de l'écriture
      await new Promise((resolve, reject) => {
        output.on('close', resolve);
        output.on('error', reject);
      });

      // Chiffrement de la sauvegarde
      await this.encryptionManager.encryptFile(tempPath, backupPath);
      await fs.unlink(tempPath);

      // Nettoyage des anciennes sauvegardes
      await this.cleanupOldBackups();

      return {
        success: true,
        path: backupPath,
        name: backupName,
        timestamp: timestamp
      };
    } catch (error) {
      console.error('Erreur lors de la création de la sauvegarde:', error);
      throw error;
    }
  }

  async restoreBackup(backupPath, userId = null) {
    try {
      const tempDir = path.join(this.backupDir, 'temp_restore');
      await fs.mkdir(tempDir, { recursive: true });

      // Déchiffrement de la sauvegarde
      const decryptedPath = path.join(tempDir, 'backup.zip');
      await this.encryptionManager.decryptFile(backupPath, decryptedPath);

      // Extraction de l'archive
      await this.extractArchive(decryptedPath, tempDir);

      // Restauration de la base de données
      const dbBackupPath = path.join(tempDir, 'database.sqlite');
      if (await this.fileExists(dbBackupPath)) {
        await this.databaseManager.restore(dbBackupPath);
      }

      // Restauration des fichiers de configuration
      const configBackupPath = path.join(tempDir, 'config');
      if (await this.fileExists(configBackupPath)) {
        const configFiles = await fs.readdir(configBackupPath);
        for (const file of configFiles) {
          const sourcePath = path.join(configBackupPath, file);
          const targetPath = path.join(__dirname, '../config', file);
          await fs.copyFile(sourcePath, targetPath);
        }
      }

      // Restauration des données utilisateur
      if (userId) {
        const userDataBackupPath = path.join(tempDir, 'user_data');
        if (await this.fileExists(userDataBackupPath)) {
          const userDataPath = path.join(__dirname, `../data/users/${userId}`);
          await fs.mkdir(userDataPath, { recursive: true });
          await this.copyDirectory(userDataBackupPath, userDataPath);
        }
      }

      // Nettoyage
      await fs.rm(tempDir, { recursive: true, force: true });

      return {
        success: true,
        message: 'Restauration terminée avec succès'
      };
    } catch (error) {
      console.error('Erreur lors de la restauration de la sauvegarde:', error);
      throw error;
    }
  }

  async listBackups(userId = null) {
    try {
      const files = await fs.readdir(this.backupDir);
      const backups = [];

      for (const file of files) {
        if (file.endsWith('.zip')) {
          const stats = await fs.stat(path.join(this.backupDir, file));
          const backup = {
            name: file,
            path: path.join(this.backupDir, file),
            size: stats.size,
            created: stats.birthtime
          };

          if (!userId || file.includes(`backup_${userId}_`)) {
            backups.push(backup);
          }
        }
      }

      return backups.sort((a, b) => b.created - a.created);
    } catch (error) {
      console.error('Erreur lors de la liste des sauvegardes:', error);
      throw error;
    }
  }

  async cleanupOldBackups() {
    try {
      const backups = await this.listBackups();
      if (backups.length > this.maxBackups) {
        const toDelete = backups.slice(this.maxBackups);
        for (const backup of toDelete) {
          await fs.unlink(backup.path);
        }
      }
    } catch (error) {
      console.error('Erreur lors du nettoyage des anciennes sauvegardes:', error);
    }
  }

  // Méthodes utilitaires
  async archiveDirectory(archive, dirPath, name) {
    const files = await fs.readdir(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = await fs.stat(filePath);
      if (stats.isDirectory()) {
        await this.archiveDirectory(archive, filePath, `${name}/${file}`);
      } else {
        archive.file(filePath, { name: `${name}/${file}` });
      }
    }
  }

  async extractArchive(archivePath, targetDir) {
    return new Promise((resolve, reject) => {
      const extract = require('extract-zip');
      extract(archivePath, { dir: targetDir })
        .then(resolve)
        .catch(reject);
    });
  }

  async copyDirectory(source, target) {
    const files = await fs.readdir(source);
    await fs.mkdir(target, { recursive: true });

    for (const file of files) {
      const sourcePath = path.join(source, file);
      const targetPath = path.join(target, file);
      const stats = await fs.stat(sourcePath);

      if (stats.isDirectory()) {
        await this.copyDirectory(sourcePath, targetPath);
      } else {
        await fs.copyFile(sourcePath, targetPath);
      }
    }
  }

  async fileExists(path) {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = { BackupManager };
