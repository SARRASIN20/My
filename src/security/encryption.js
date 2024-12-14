const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;

class EncryptionManager {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32;
    this.ivLength = 16;
    this.saltLength = 64;
    this.tagLength = 16;
  }

  async initialize() {
    try {
      await this.loadOrGenerateKey();
      console.log('EncryptionManager initialisé avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'initialisation du chiffrement:', error);
      throw error;
    }
  }

  async loadOrGenerateKey() {
    const keyPath = path.join(__dirname, '../data/.keys');
    try {
      await fs.access(keyPath);
      this.masterKey = await fs.readFile(keyPath);
    } catch {
      this.masterKey = crypto.randomBytes(this.keyLength);
      await fs.mkdir(path.dirname(keyPath), { recursive: true });
      await fs.writeFile(keyPath, this.masterKey, { mode: 0o600 });
    }
  }

  async deriveKey(salt, info = '') {
    return new Promise((resolve, reject) => {
      crypto.hkdf(
        'sha512',
        this.masterKey,
        salt,
        info,
        this.keyLength,
        (err, derivedKey) => {
          if (err) reject(err);
          else resolve(derivedKey);
        }
      );
    });
  }

  async encrypt(data, context = '') {
    try {
      const salt = crypto.randomBytes(this.saltLength);
      const iv = crypto.randomBytes(this.ivLength);
      const key = await this.deriveKey(salt, context);

      const cipher = crypto.createCipheriv(this.algorithm, key, iv, {
        authTagLength: this.tagLength
      });

      const encrypted = Buffer.concat([
        cipher.update(data, 'utf8'),
        cipher.final()
      ]);

      const authTag = cipher.getAuthTag();

      return Buffer.concat([salt, iv, authTag, encrypted]).toString('base64');
    } catch (error) {
      console.error('Erreur lors du chiffrement:', error);
      throw new Error('Échec du chiffrement');
    }
  }

  async decrypt(encryptedData, context = '') {
    try {
      const data = Buffer.from(encryptedData, 'base64');

      const salt = data.slice(0, this.saltLength);
      const iv = data.slice(this.saltLength, this.saltLength + this.ivLength);
      const authTag = data.slice(
        this.saltLength + this.ivLength,
        this.saltLength + this.ivLength + this.tagLength
      );
      const encrypted = data.slice(this.saltLength + this.ivLength + this.tagLength);

      const key = await this.deriveKey(salt, context);

      const decipher = crypto.createDecipheriv(this.algorithm, key, iv, {
        authTagLength: this.tagLength
      });
      decipher.setAuthTag(authTag);

      return Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]).toString('utf8');
    } catch (error) {
      console.error('Erreur lors du déchiffrement:', error);
      throw new Error('Échec du déchiffrement');
    }
  }

  // Utilitaire pour chiffrer un fichier
  async encryptFile(inputPath, outputPath) {
    try {
      const data = await fs.readFile(inputPath);
      const encrypted = await this.encrypt(data);
      await fs.writeFile(outputPath, encrypted);
    } catch (error) {
      console.error('Erreur lors du chiffrement du fichier:', error);
      throw error;
    }
  }

  // Utilitaire pour déchiffrer un fichier
  async decryptFile(inputPath, outputPath) {
    try {
      const encrypted = await fs.readFile(inputPath, 'utf8');
      const decrypted = await this.decrypt(encrypted);
      await fs.writeFile(outputPath, decrypted);
    } catch (error) {
      console.error('Erreur lors du déchiffrement du fichier:', error);
      throw error;
    }
  }

  // Génération de hash sécurisé pour les mots de passe
  async hashPassword(password, salt = crypto.randomBytes(16)) {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(
        password,
        salt,
        100000,
        64,
        'sha512',
        (err, derivedKey) => {
          if (err) reject(err);
          else resolve({
            hash: derivedKey.toString('hex'),
            salt: salt.toString('hex')
          });
        }
      );
    });
  }

  // Vérification de mot de passe
  async verifyPassword(password, hash, salt) {
    const verifyHash = await this.hashPassword(
      password,
      Buffer.from(salt, 'hex')
    );
    return verifyHash.hash === hash;
  }
}

module.exports = { EncryptionManager };
