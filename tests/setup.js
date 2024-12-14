// Configuration globale pour Jest
const path = require('path');
const fs = require('fs').promises;

// Configuration du timeout global
jest.setTimeout(10000);

// Mock des modules externes couramment utilisés
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/fake/path'),
    on: jest.fn(),
    whenReady: jest.fn().mockResolvedValue(undefined)
  },
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn()
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadFile: jest.fn(),
    on: jest.fn(),
    webContents: {
      send: jest.fn()
    }
  }))
}));

// Création d'un répertoire temporaire pour les tests
beforeAll(async () => {
  const testDir = path.join(__dirname, '../.test-tmp');
  try {
    await fs.mkdir(testDir, { recursive: true });
  } catch (error) {
    console.warn('Erreur lors de la création du répertoire temporaire:', error);
  }
});

// Nettoyage après tous les tests
afterAll(async () => {
  const testDir = path.join(__dirname, '../.test-tmp');
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch (error) {
    console.warn('Erreur lors du nettoyage du répertoire temporaire:', error);
  }
});

// Réinitialisation des mocks entre chaque test
beforeEach(() => {
  jest.clearAllMocks();
});

// Utilitaires globaux pour les tests
global.testUtils = {
  // Création d'un fichier temporaire
  async createTempFile(filename, content) {
    const filePath = path.join(__dirname, '../.test-tmp', filename);
    await fs.writeFile(filePath, content);
    return filePath;
  },

  // Suppression d'un fichier temporaire
  async removeTempFile(filename) {
    const filePath = path.join(__dirname, '../.test-tmp', filename);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.warn('Erreur lors de la suppression du fichier temporaire:', error);
    }
  },

  // Attente d'une condition
  async waitFor(condition, timeout = 5000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Condition non remplie dans le délai imparti');
  }
};

// Configuration des matchers personnalisés
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false
      };
    }
  },

  async toEventuallyBe(received, expected, timeout = 5000) {
    try {
      await global.testUtils.waitFor(
        async () => received === expected,
        timeout
      );
      return {
        message: () =>
          `expected ${received} to eventually be ${expected}`,
        pass: true
      };
    } catch (error) {
      return {
        message: () =>
          `expected ${received} to eventually be ${expected} (timeout: ${timeout}ms)`,
        pass: false
      };
    }
  }
});
