const { DatabaseManager } = require('../managers/database-manager');
const { EncryptionManager } = require('../security/encryption');
const fetch = require('node-fetch');
const WebSocket = require('ws');
const log = require('electron-log');

class SyncManager {
  constructor(config = {}) {
    this.databaseManager = new DatabaseManager();
    this.encryptionManager = new EncryptionManager();
    this.config = {
      syncInterval: 5 * 60 * 1000, // 5 minutes
      retryDelay: 30 * 1000, // 30 secondes
      maxRetries: 3,
      ...config
    };
    this.syncQueue = new Map();
    this.ws = null;
    this.isConnected = false;
    this.retryCount = 0;
  }

  async initialize() {
    try {
      await this.databaseManager.initialize();
      await this.encryptionManager.initialize();
      await this.setupSyncTable();
      this.startPeriodicSync();
      this.setupWebSocket();
      log.info('SyncManager initialisé avec succès');
    } catch (error) {
      log.error('Erreur lors de l\'initialisation de SyncManager:', error);
      throw error;
    }
  }

  async setupSyncTable() {
    await this.databaseManager.run(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        data TEXT,
        status TEXT DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  setupWebSocket() {
    if (this.ws) {
      this.ws.close();
    }

    this.ws = new WebSocket(this.config.wsUrl);

    this.ws.on('open', () => {
      this.isConnected = true;
      this.retryCount = 0;
      log.info('Connexion WebSocket établie');
      this.sendPendingChanges();
    });

    this.ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data);
        await this.handleIncomingSync(message);
      } catch (error) {
        log.error('Erreur lors du traitement du message WebSocket:', error);
      }
    });

    this.ws.on('close', () => {
      this.isConnected = false;
      this.retryWebSocketConnection();
    });

    this.ws.on('error', (error) => {
      log.error('Erreur WebSocket:', error);
      this.retryWebSocketConnection();
    });
  }

  retryWebSocketConnection() {
    if (this.retryCount < this.config.maxRetries) {
      this.retryCount++;
      setTimeout(() => {
        log.info(`Tentative de reconnexion WebSocket (${this.retryCount}/${this.config.maxRetries})`);
        this.setupWebSocket();
      }, this.config.retryDelay);
    } else {
      log.error('Nombre maximum de tentatives de reconnexion atteint');
    }
  }

  startPeriodicSync() {
    setInterval(() => {
      this.synchronize().catch(error => {
        log.error('Erreur lors de la synchronisation périodique:', error);
      });
    }, this.config.syncInterval);
  }

  async queueChange(entityType, entityId, action, data) {
    try {
      const encryptedData = data ? await this.encryptionManager.encrypt(JSON.stringify(data)) : null;
      
      await this.databaseManager.run(`
        INSERT INTO sync_queue (entity_type, entity_id, action, data)
        VALUES (?, ?, ?, ?)
      `, [entityType, entityId, action, encryptedData]);

      if (this.isConnected) {
        await this.sendPendingChanges();
      }
    } catch (error) {
      log.error('Erreur lors de l\'ajout à la file de synchronisation:', error);
      throw error;
    }
  }

  async synchronize() {
    try {
      // Récupération des modifications locales en attente
      const pendingChanges = await this.databaseManager.all(`
        SELECT * FROM sync_queue
        WHERE status = 'pending'
        ORDER BY created_at ASC
      `);

      // Envoi des modifications au serveur
      for (const change of pendingChanges) {
        await this.processChange(change);
      }

      // Récupération des modifications distantes
      await this.fetchRemoteChanges();

      log.info('Synchronisation terminée avec succès');
    } catch (error) {
      log.error('Erreur lors de la synchronisation:', error);
      throw error;
    }
  }

  async processChange(change) {
    try {
      const response = await fetch(`${this.config.apiUrl}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiToken}`
        },
        body: JSON.stringify({
          type: change.entity_type,
          id: change.entity_id,
          action: change.action,
          data: change.data ? await this.encryptionManager.decrypt(change.data) : null
        })
      });

      if (!response.ok) {
        throw new Error(`Erreur serveur: ${response.status}`);
      }

      // Mise à jour du statut de la modification
      await this.databaseManager.run(`
        UPDATE sync_queue
        SET status = 'completed', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [change.id]);
    } catch (error) {
      log.error('Erreur lors du traitement de la modification:', error);
      
      // Mise à jour du compteur de tentatives
      await this.databaseManager.run(`
        UPDATE sync_queue
        SET retry_count = retry_count + 1,
            status = CASE 
              WHEN retry_count >= ? THEN 'failed'
              ELSE 'pending'
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [this.config.maxRetries, change.id]);
    }
  }

  async fetchRemoteChanges() {
    try {
      const response = await fetch(`${this.config.apiUrl}/sync/changes`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Erreur serveur: ${response.status}`);
      }

      const changes = await response.json();
      await this.applyRemoteChanges(changes);
    } catch (error) {
      log.error('Erreur lors de la récupération des modifications distantes:', error);
      throw error;
    }
  }

  async applyRemoteChanges(changes) {
    for (const change of changes) {
      try {
        await this.handleIncomingSync(change);
      } catch (error) {
        log.error('Erreur lors de l\'application de la modification distante:', error);
      }
    }
  }

  async handleIncomingSync(message) {
    try {
      const { type, id, action, data } = message;

      switch (type) {
        case 'settings':
          await this.handleSettingsSync(action, data);
          break;
        case 'automation':
          await this.handleAutomationSync(action, data);
          break;
        case 'command':
          await this.handleCommandSync(action, data);
          break;
        default:
          log.warn('Type de synchronisation non géré:', type);
      }
    } catch (error) {
      log.error('Erreur lors du traitement de la synchronisation entrante:', error);
      throw error;
    }
  }

  async handleSettingsSync(action, data) {
    switch (action) {
      case 'update':
        await this.databaseManager.setSetting(data.key, data.value);
        break;
      case 'delete':
        await this.databaseManager.run('DELETE FROM settings WHERE key = ?', [data.key]);
        break;
    }
  }

  async handleAutomationSync(action, data) {
    switch (action) {
      case 'create':
      case 'update':
        await this.databaseManager.run(`
          INSERT OR REPLACE INTO automations (id, name, type, config)
          VALUES (?, ?, ?, ?)
        `, [data.id, data.name, data.type, JSON.stringify(data.config)]);
        break;
      case 'delete':
        await this.databaseManager.run('DELETE FROM automations WHERE id = ?', [data.id]);
        break;
    }
  }

  async handleCommandSync(action, data) {
    switch (action) {
      case 'execute':
        // Traitement des commandes synchronisées
        break;
    }
  }

  async sendPendingChanges() {
    if (!this.isConnected) return;

    const pendingChanges = await this.databaseManager.all(`
      SELECT * FROM sync_queue
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 100
    `);

    for (const change of pendingChanges) {
      try {
        this.ws.send(JSON.stringify({
          type: change.entity_type,
          id: change.entity_id,
          action: change.action,
          data: change.data ? await this.encryptionManager.decrypt(change.data) : null
        }));

        await this.databaseManager.run(`
          UPDATE sync_queue
          SET status = 'completed', updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [change.id]);
      } catch (error) {
        log.error('Erreur lors de l\'envoi des modifications en attente:', error);
      }
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

module.exports = { SyncManager };
