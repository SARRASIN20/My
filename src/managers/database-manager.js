const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

class DatabaseManager {
  constructor() {
    this.db = null;
    this.dbPath = path.join(__dirname, '../data/sahara.db');
  }

  async initialize() {
    try {
      // Création du répertoire data s'il n'existe pas
      const dataDir = path.dirname(this.dbPath);
      await fs.mkdir(dataDir, { recursive: true });

      // Initialisation de la base de données
      await this.connect();
      await this.createTables();
      console.log('Base de données initialisée avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'initialisation de la base de données:', error);
      throw error;
    }
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async createTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS commands (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        command TEXT NOT NULL,
        type TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        success BOOLEAN,
        result TEXT
      )`,
      
      `CREATE TABLE IF NOT EXISTS automations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        config TEXT NOT NULL,
        enabled BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT,
        size INTEGER,
        last_modified DATETIME,
        metadata TEXT,
        UNIQUE(path)
      )`,
      
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const table of tables) {
      await this.run(table);
    }
  }

  // Méthodes utilitaires pour les requêtes
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Méthodes pour les commandes
  async saveCommand(command, type, success, result) {
    const sql = `
      INSERT INTO commands (command, type, success, result)
      VALUES (?, ?, ?, ?)
    `;
    return await this.run(sql, [command, type, success ? 1 : 0, JSON.stringify(result)]);
  }

  async getCommandHistory(limit = 50) {
    const sql = `
      SELECT * FROM commands
      ORDER BY timestamp DESC
      LIMIT ?
    `;
    return await this.all(sql, [limit]);
  }

  // Méthodes pour les automatisations
  async saveAutomation(name, type, config) {
    const sql = `
      INSERT INTO automations (name, type, config)
      VALUES (?, ?, ?)
    `;
    return await this.run(sql, [name, type, JSON.stringify(config)]);
  }

  async updateAutomation(id, updates) {
    const sets = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updates)) {
      sets.push(`${key} = ?`);
      values.push(value);
    }
    
    sets.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const sql = `
      UPDATE automations
      SET ${sets.join(', ')}
      WHERE id = ?
    `;
    
    return await this.run(sql, values);
  }

  async getAutomations() {
    return await this.all('SELECT * FROM automations ORDER BY created_at DESC');
  }

  // Méthodes pour les fichiers
  async saveFile(fileInfo) {
    const sql = `
      INSERT OR REPLACE INTO files (path, name, type, size, last_modified, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    return await this.run(sql, [
      fileInfo.path,
      fileInfo.name,
      fileInfo.type,
      fileInfo.size,
      fileInfo.lastModified,
      JSON.stringify(fileInfo.metadata)
    ]);
  }

  async searchFiles(query) {
    const sql = `
      SELECT * FROM files
      WHERE name LIKE ? OR path LIKE ?
      ORDER BY last_modified DESC
    `;
    const searchPattern = `%${query}%`;
    return await this.all(sql, [searchPattern, searchPattern]);
  }

  // Méthodes pour les paramètres
  async setSetting(key, value) {
    const sql = `
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `;
    return await this.run(sql, [key, JSON.stringify(value)]);
  }

  async getSetting(key) {
    const row = await this.get('SELECT value FROM settings WHERE key = ?', [key]);
    return row ? JSON.parse(row.value) : null;
  }

  async getAllSettings() {
    const rows = await this.all('SELECT * FROM settings');
    return rows.reduce((acc, row) => {
      acc[row.key] = JSON.parse(row.value);
      return acc;
    }, {});
  }

  // Nettoyage et maintenance
  async cleanup() {
    // Supprimer les anciennes commandes (plus de 30 jours)
    await this.run(`
      DELETE FROM commands
      WHERE timestamp < datetime('now', '-30 days')
    `);

    // Vérifier l'intégrité des fichiers indexés
    const files = await this.all('SELECT * FROM files');
    for (const file of files) {
      try {
        await fs.access(file.path);
      } catch (error) {
        // Le fichier n'existe plus, le supprimer de la base
        await this.run('DELETE FROM files WHERE id = ?', [file.id]);
      }
    }
  }

  // Fermeture de la connexion
  close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            this.db = null;
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = { DatabaseManager };
