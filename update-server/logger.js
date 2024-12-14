const winston = require('winston');
const path = require('path');

// Configuration des niveaux de log personnalisés
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Configuration des couleurs pour chaque niveau
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Ajout des couleurs à Winston
winston.addColors(colors);

// Format personnalisé
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Configuration des transports
const transports = [
  // Écriture dans la console
  new winston.transports.Console(),
  
  // Écriture dans un fichier pour tous les logs
  new winston.transports.File({
    filename: path.join(__dirname, 'logs', 'all.log'),
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  
  // Fichier séparé pour les erreurs
  new winston.transports.File({
    filename: path.join(__dirname, 'logs', 'error.log'),
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
];

// Création du logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports,
  exitOnError: false,
});

// Fonction pour créer un log avec le contexte
const createContextualLogger = (context) => {
  return {
    error: (message, meta = {}) => logger.error(`[${context}] ${message}`, meta),
    warn: (message, meta = {}) => logger.warn(`[${context}] ${message}`, meta),
    info: (message, meta = {}) => logger.info(`[${context}] ${message}`, meta),
    http: (message, meta = {}) => logger.http(`[${context}] ${message}`, meta),
    debug: (message, meta = {}) => logger.debug(`[${context}] ${message}`, meta),
  };
};

// Export du logger et de la fonction pour créer des loggers contextuels
module.exports = {
  logger,
  createContextualLogger,
};
