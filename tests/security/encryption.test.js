const { EncryptionManager } = require('../../src/security/encryption');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

describe('EncryptionManager', () => {
  let encryptionManager;
  const testData = 'Données de test sensibles';
  const testContext = 'test-context';

  beforeEach(async () => {
    encryptionManager = new EncryptionManager();
    await encryptionManager.initialize();
  });

  describe('Chiffrement de base', () => {
    test('devrait chiffrer et déchiffrer des données correctement', async () => {
      const encrypted = await encryptionManager.encrypt(testData);
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');

      const decrypted = await encryptionManager.decrypt(encrypted);
      expect(decrypted).toBe(testData);
    });

    test('devrait chiffrer différemment avec des contextes différents', async () => {
      const encrypted1 = await encryptionManager.encrypt(testData, 'context1');
      const encrypted2 = await encryptionManager.encrypt(testData, 'context2');
      expect(encrypted1).not.toBe(encrypted2);
    });

    test('devrait échouer au déchiffrement avec des données invalides', async () => {
      await expect(encryptionManager.decrypt('données invalides'))
        .rejects
        .toThrow('Échec du déchiffrement');
    });
  });

  describe('Gestion des fichiers', () => {
    const testFile = path.join(__dirname, 'test.txt');
    const encryptedFile = path.join(__dirname, 'test.encrypted');

    beforeEach(async () => {
      await fs.writeFile(testFile, testData);
    });

    afterEach(async () => {
      try {
        await fs.unlink(testFile);
        await fs.unlink(encryptedFile);
      } catch (error) {
        // Ignorer les erreurs si les fichiers n'existent pas
      }
    });

    test('devrait chiffrer et déchiffrer un fichier', async () => {
      await encryptionManager.encryptFile(testFile, encryptedFile);
      expect(await fs.readFile(encryptedFile, 'utf8')).not.toBe(testData);

      const decryptedFile = path.join(__dirname, 'test.decrypted');
      await encryptionManager.decryptFile(encryptedFile, decryptedFile);
      const decryptedContent = await fs.readFile(decryptedFile, 'utf8');
      expect(decryptedContent).toBe(testData);

      await fs.unlink(decryptedFile);
    });
  });

  describe('Gestion des mots de passe', () => {
    const testPassword = 'MotDePasse123!';

    test('devrait hasher un mot de passe de manière sécurisée', async () => {
      const { hash, salt } = await encryptionManager.hashPassword(testPassword);
      expect(hash).toBeDefined();
      expect(salt).toBeDefined();
      expect(hash.length).toBeGreaterThan(32);
    });

    test('devrait vérifier un mot de passe correctement', async () => {
      const { hash, salt } = await encryptionManager.hashPassword(testPassword);
      const isValid = await encryptionManager.verifyPassword(testPassword, hash, salt);
      expect(isValid).toBe(true);
    });

    test('devrait rejeter un mot de passe incorrect', async () => {
      const { hash, salt } = await encryptionManager.hashPassword(testPassword);
      const isValid = await encryptionManager.verifyPassword('MauvaisMotDePasse', hash, salt);
      expect(isValid).toBe(false);
    });
  });

  describe('Gestion des erreurs', () => {
    test('devrait gérer les erreurs de chiffrement', async () => {
      const invalidData = { toString: () => { throw new Error(); } };
      await expect(encryptionManager.encrypt(invalidData))
        .rejects
        .toThrow();
    });

    test('devrait gérer les erreurs de déchiffrement', async () => {
      await expect(encryptionManager.decrypt('données corrompues'))
        .rejects
        .toThrow();
    });
  });
});
