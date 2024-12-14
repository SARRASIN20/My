const Joi = require('joi');
const xss = require('xss');
const { JSDOM } = require('jsdom');
const { createSanitizer } = require('dompurify');

// Initialisation de DOMPurify
const window = new JSDOM('').window;
const DOMPurify = createSanitizer(window);

// Schémas de validation
const schemas = {
  update: Joi.object({
    version: Joi.string()
      .pattern(/^\d+\.\d+\.\d+$/)
      .required(),
    platform: Joi.string()
      .valid('win', 'mac', 'linux')
      .required(),
    minimumVersion: Joi.string()
      .pattern(/^\d+\.\d+\.\d+$/)
      .required(),
    notes: Joi.string()
      .max(5000)
      .allow(''),
    status: Joi.string()
      .valid('draft', 'active', 'deprecated')
      .default('draft')
  }),

  metric: Joi.object({
    type: Joi.string()
      .required(),
    value: Joi.number()
      .required(),
    timestamp: Joi.date()
      .iso()
      .required(),
    metadata: Joi.object()
      .unknown(true)
      .default({})
  }),

  error: Joi.object({
    type: Joi.string()
      .required(),
    message: Joi.string()
      .required(),
    stack: Joi.string()
      .allow(''),
    metadata: Joi.object()
      .unknown(true)
      .default({}),
    severity: Joi.string()
      .valid('low', 'medium', 'high', 'critical')
      .default('medium')
  })
};

// Fonction de validation générique
const validateSchema = (schema) => (data) => {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const details = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    throw {
      name: 'ValidationError',
      message: 'Données invalides',
      details
    };
  }

  return value;
};

// Middleware de validation des requêtes
const validateRequest = (schema) => (req, res, next) => {
  try {
    const validated = validateSchema(schema)(req.body);
    req.body = validated;
    next();
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: error.message,
        details: error.details
      });
    }
    next(error);
  }
};

// Fonction d'assainissement des chaînes
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  
  // Supprime les caractères de contrôle et les caractères non imprimables
  str = str.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
  
  // Échappe les caractères HTML
  str = xss(str);
  
  // Nettoie avec DOMPurify
  str = DOMPurify.sanitize(str);
  
  return str;
};

// Fonction d'assainissement récursive pour les objets
const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

// Middleware d'assainissement des entrées
const sanitizeInput = (req, res, next) => {
  req.body = sanitizeObject(req.body);
  req.query = sanitizeObject(req.query);
  req.params = sanitizeObject(req.params);
  next();
};

// Validation des fichiers
const validateFile = (file) => {
  const allowedTypes = [
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream'
  ];

  const maxSize = 100 * 1024 * 1024; // 100 MB

  if (!allowedTypes.includes(file.mimetype)) {
    throw new Error('Type de fichier non autorisé');
  }

  if (file.size > maxSize) {
    throw new Error('Fichier trop volumineux');
  }

  // Vérifie l'extension
  const allowedExtensions = ['.zip'];
  const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
  if (!allowedExtensions.includes(ext)) {
    throw new Error('Extension de fichier non autorisée');
  }

  return true;
};

module.exports = {
  schemas,
  validateSchema,
  validateRequest,
  sanitizeInput,
  validateFile
};
