const { AuthManager } = require('../../src/security/auth-manager');
const { DatabaseManager } = require('../../src/managers/database-manager');
const jwt = require('jsonwebtoken');

jest.mock('../../src/managers/database-manager');

describe('AuthManager', () => {
  let authManager;
  const testUser = {
    username: 'testuser',
    password: 'TestPassword123!',
    email: 'test@example.com'
  };

  beforeEach(async () => {
    authManager = new AuthManager();
    await authManager.initialize();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Enregistrement utilisateur', () => {
    test('devrait créer un nouvel utilisateur avec succès', async () => {
      const result = await authManager.registerUser(
        testUser.username,
        testUser.password,
        testUser.email
      );

      expect(result.success).toBe(true);
      expect(result.userId).toBeDefined();
    });

    test('devrait rejeter un nom d\'utilisateur en double', async () => {
      await authManager.registerUser(
        testUser.username,
        testUser.password,
        testUser.email
      );

      await expect(
        authManager.registerUser(
          testUser.username,
          'AutreMotDePasse123!',
          'autre@example.com'
        )
      ).rejects.toThrow('Nom d\'utilisateur ou email déjà utilisé');
    });

    test('devrait valider le format du mot de passe', async () => {
      await expect(
        authManager.registerUser(
          testUser.username,
          'faible',
          testUser.email
        )
      ).rejects.toThrow('Le mot de passe ne respecte pas les critères de sécurité');
    });
  });

  describe('Connexion', () => {
    beforeEach(async () => {
      await authManager.registerUser(
        testUser.username,
        testUser.password,
        testUser.email
      );
    });

    test('devrait connecter un utilisateur avec succès', async () => {
      const result = await authManager.login(
        testUser.username,
        testUser.password
      );

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.username).toBe(testUser.username);
    });

    test('devrait rejeter un mot de passe incorrect', async () => {
      await expect(
        authManager.login(testUser.username, 'MauvaisMotDePasse')
      ).rejects.toThrow('Mot de passe incorrect');
    });

    test('devrait rejeter un utilisateur non existant', async () => {
      await expect(
        authManager.login('utilisateurinexistant', testUser.password)
      ).rejects.toThrow('Utilisateur non trouvé ou inactif');
    });
  });

  describe('Validation de session', () => {
    let userToken;

    beforeEach(async () => {
      const loginResult = await authManager.login(
        testUser.username,
        testUser.password
      );
      userToken = loginResult.token;
    });

    test('devrait valider un token valide', async () => {
      const result = await authManager.validateSession(userToken);
      expect(result.valid).toBe(true);
      expect(result.username).toBe(testUser.username);
    });

    test('devrait rejeter un token invalide', async () => {
      await expect(
        authManager.validateSession('token.invalide')
      ).rejects.toThrow('Session invalide ou expirée');
    });

    test('devrait rejeter un token expiré', async () => {
      jest.advanceTimersByTime(25 * 60 * 60 * 1000); // Avance de 25 heures
      await expect(
        authManager.validateSession(userToken)
      ).rejects.toThrow('Session invalide ou expirée');
    });
  });

  describe('Gestion du mot de passe', () => {
    let userId;

    beforeEach(async () => {
      const registerResult = await authManager.registerUser(
        testUser.username,
        testUser.password,
        testUser.email
      );
      userId = registerResult.userId;
    });

    test('devrait mettre à jour le mot de passe avec succès', async () => {
      const newPassword = 'NouveauMotDePasse123!';
      const result = await authManager.updatePassword(
        userId,
        testUser.password,
        newPassword
      );

      expect(result.success).toBe(true);

      // Vérifier que l'ancien mot de passe ne fonctionne plus
      await expect(
        authManager.login(testUser.username, testUser.password)
      ).rejects.toThrow();

      // Vérifier que le nouveau mot de passe fonctionne
      const loginResult = await authManager.login(
        testUser.username,
        newPassword
      );
      expect(loginResult.success).toBe(true);
    });

    test('devrait rejeter un ancien mot de passe incorrect', async () => {
      await expect(
        authManager.updatePassword(
          userId,
          'MauvaisAncienMotDePasse',
          'NouveauMotDePasse123!'
        )
      ).rejects.toThrow('Mot de passe actuel incorrect');
    });
  });

  describe('Nettoyage des sessions', () => {
    test('devrait nettoyer les sessions expirées', async () => {
      // Créer quelques sessions
      await authManager.login(testUser.username, testUser.password);
      jest.advanceTimersByTime(25 * 60 * 60 * 1000); // Avance de 25 heures

      await authManager.cleanupSessions();

      // Vérifier que les sessions expirées ont été supprimées
      const sessions = await authManager.databaseManager.all(
        'SELECT * FROM sessions WHERE is_valid = 1'
      );
      expect(sessions.length).toBe(0);
    });
  });
});
