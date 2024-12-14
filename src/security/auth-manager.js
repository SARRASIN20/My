const { EncryptionManager } = require('./encryption');
const { DatabaseManager } = require('../managers/database-manager');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

class AuthManager {
  constructor() {
    this.encryptionManager = new EncryptionManager();
    this.databaseManager = new DatabaseManager();
    this.sessionTimeout = 24 * 60 * 60 * 1000; // 24 heures
  }

  async initialize() {
    try {
      await this.encryptionManager.initialize();
      await this.databaseManager.initialize();
      
      // Création de la table des utilisateurs si elle n'existe pas
      await this.databaseManager.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          password_salt TEXT NOT NULL,
          email TEXT UNIQUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_login DATETIME,
          is_active BOOLEAN DEFAULT 1,
          role TEXT DEFAULT 'user',
          settings TEXT
        )
      `);

      // Création de la table des sessions
      await this.databaseManager.run(`
        CREATE TABLE IF NOT EXISTS sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          token TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME NOT NULL,
          is_valid BOOLEAN DEFAULT 1,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      console.log('AuthManager initialisé avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'initialisation de AuthManager:', error);
      throw error;
    }
  }

  async registerUser(username, password, email = null) {
    try {
      // Vérification si l'utilisateur existe déjà
      const existingUser = await this.databaseManager.get(
        'SELECT id FROM users WHERE username = ? OR email = ?',
        [username, email]
      );

      if (existingUser) {
        throw new Error('Nom d\'utilisateur ou email déjà utilisé');
      }

      // Hashage du mot de passe
      const { hash, salt } = await this.encryptionManager.hashPassword(password);

      // Insertion de l'utilisateur
      const result = await this.databaseManager.run(
        'INSERT INTO users (username, password_hash, password_salt, email) VALUES (?, ?, ?, ?)',
        [username, hash, salt, email]
      );

      return {
        success: true,
        userId: result.id,
        message: 'Utilisateur créé avec succès'
      };
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de l\'utilisateur:', error);
      throw error;
    }
  }

  async login(username, password) {
    try {
      // Récupération de l'utilisateur
      const user = await this.databaseManager.get(
        'SELECT * FROM users WHERE username = ? AND is_active = 1',
        [username]
      );

      if (!user) {
        throw new Error('Utilisateur non trouvé ou inactif');
      }

      // Vérification du mot de passe
      const isValid = await this.encryptionManager.verifyPassword(
        password,
        user.password_hash,
        user.password_salt
      );

      if (!isValid) {
        throw new Error('Mot de passe incorrect');
      }

      // Création du token de session
      const token = this.generateSessionToken(user);
      const expiresAt = new Date(Date.now() + this.sessionTimeout);

      // Enregistrement de la session
      await this.databaseManager.run(
        'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)',
        [user.id, token, expiresAt.toISOString()]
      );

      // Mise à jour de la dernière connexion
      await this.databaseManager.run(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
        [user.id]
      );

      return {
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      };
    } catch (error) {
      console.error('Erreur lors de la connexion:', error);
      throw error;
    }
  }

  async validateSession(token) {
    try {
      // Vérification de la session dans la base de données
      const session = await this.databaseManager.get(
        `SELECT s.*, u.username, u.role 
         FROM sessions s
         JOIN users u ON s.user_id = u.id
         WHERE s.token = ? AND s.is_valid = 1 AND s.expires_at > CURRENT_TIMESTAMP`,
        [token]
      );

      if (!session) {
        throw new Error('Session invalide ou expirée');
      }

      return {
        valid: true,
        userId: session.user_id,
        username: session.username,
        role: session.role
      };
    } catch (error) {
      console.error('Erreur lors de la validation de la session:', error);
      throw error;
    }
  }

  async logout(token) {
    try {
      await this.databaseManager.run(
        'UPDATE sessions SET is_valid = 0 WHERE token = ?',
        [token]
      );

      return { success: true, message: 'Déconnexion réussie' };
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      throw error;
    }
  }

  generateSessionToken(user) {
    const payload = {
      userId: user.id,
      username: user.username,
      role: user.role
    };

    return jwt.sign(payload, this.encryptionManager.masterKey.toString('hex'), {
      expiresIn: '24h'
    });
  }

  async updatePassword(userId, currentPassword, newPassword) {
    try {
      const user = await this.databaseManager.get(
        'SELECT password_hash, password_salt FROM users WHERE id = ?',
        [userId]
      );

      if (!user) {
        throw new Error('Utilisateur non trouvé');
      }

      // Vérification du mot de passe actuel
      const isValid = await this.encryptionManager.verifyPassword(
        currentPassword,
        user.password_hash,
        user.password_salt
      );

      if (!isValid) {
        throw new Error('Mot de passe actuel incorrect');
      }

      // Hashage du nouveau mot de passe
      const { hash, salt } = await this.encryptionManager.hashPassword(newPassword);

      // Mise à jour du mot de passe
      await this.databaseManager.run(
        'UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?',
        [hash, salt, userId]
      );

      // Invalidation des sessions existantes
      await this.databaseManager.run(
        'UPDATE sessions SET is_valid = 0 WHERE user_id = ?',
        [userId]
      );

      return { success: true, message: 'Mot de passe mis à jour avec succès' };
    } catch (error) {
      console.error('Erreur lors de la mise à jour du mot de passe:', error);
      throw error;
    }
  }

  async cleanupSessions() {
    try {
      await this.databaseManager.run(
        'DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP OR is_valid = 0'
      );
    } catch (error) {
      console.error('Erreur lors du nettoyage des sessions:', error);
    }
  }
}

module.exports = { AuthManager };
