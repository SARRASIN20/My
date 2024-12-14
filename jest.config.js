module.exports = {
  // Répertoire racine pour la recherche des tests
  roots: ['<rootDir>/tests'],

  // Motifs de fichiers de test
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],

  // Environnement de test
  testEnvironment: 'node',

  // Couverture de code
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/ui/**',
    '!**/node_modules/**'
  ],

  // Seuils de couverture
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Timeout des tests
  testTimeout: 10000,

  // Reporter personnalisé
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'reports',
        outputName: 'junit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › '
      }
    ]
  ],

  // Configuration des modules
  moduleFileExtensions: ['js', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },

  // Setup des tests
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Transformation des fichiers
  transform: {
    '^.+\\.js$': 'babel-jest'
  },

  // Fichiers à ignorer
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ],

  // Verbose output
  verbose: true
};
