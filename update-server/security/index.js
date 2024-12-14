const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { sanitizeInput, validateSchema } = require('./validation');

// Configuration du rate limiting
const createRateLimiter = (windowMs, max) => rateLimit({
  windowMs,
  max,
  message: {
    error: 'Trop de requêtes, veuillez réessayer plus tard'
  }
});

// Limiteurs par route
const rateLimiters = {
  default: createRateLimiter(60 * 1000, 100), // 100 requêtes par minute
  auth: createRateLimiter(15 * 60 * 1000, 5), // 5 tentatives par 15 minutes
  updates: createRateLimiter(60 * 1000, 10), // 10 requêtes par minute
  metrics: createRateLimiter(60 * 1000, 60), // 60 requêtes par minute
  errors: createRateLimiter(60 * 1000, 30) // 30 requêtes par minute
};

// Middleware d'authentification
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        error: 'Token manquant'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Token invalide'
    });
  }
};

// Middleware de vérification des rôles
const checkRole = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      error: 'Accès non autorisé'
    });
  }
  next();
};

// Configuration CORS sécurisée
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Disposition'],
  credentials: true,
  maxAge: 600 // 10 minutes
};

// Configuration Helmet
const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: 'same-site' },
  dnsPrefetchControl: true,
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true
};

// Middleware de journalisation de sécurité
const securityLogger = (req, res, next) => {
  const log = {
    timestamp: new Date().toISOString(),
    ip: req.ip,
    method: req.method,
    path: req.path,
    headers: {
      userAgent: req.headers['user-agent'],
      referer: req.headers.referer
    }
  };

  if (req.user) {
    log.user = {
      id: req.user.id,
      role: req.user.role
    };
  }

  console.log('[Security]', JSON.stringify(log));
  next();
};

// Configuration des middlewares de sécurité
const configureSecurityMiddleware = (app) => {
  // Protection de base
  app.use(helmet(helmetConfig));
  app.use(cors(corsOptions));
  
  // Rate limiting
  app.use(rateLimiters.default);
  app.use('/auth', rateLimiters.auth);
  app.use('/updates', rateLimiters.updates);
  app.use('/metrics', rateLimiters.metrics);
  app.use('/errors', rateLimiters.errors);

  // Journalisation
  app.use(securityLogger);

  // Validation et assainissement
  app.use(sanitizeInput);
};

module.exports = {
  authenticate,
  checkRole,
  configureSecurityMiddleware,
  rateLimiters
};
