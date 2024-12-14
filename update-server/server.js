const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const fs = require('fs').promises;
const path = require('path');
const semver = require('semver');
const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const { createHash } = require('crypto');
const log = require('./logger');

const app = express();
const PORT = process.env.PORT || 3000;
const UPDATE_DIR = path.join(__dirname, 'updates');
const METRICS_DIR = path.join(__dirname, 'metrics');

// Configuration de la sécurité
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*'
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));

// Limiteur de taux pour l'API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limite chaque IP à 100 requêtes par fenêtre
});

// Middleware d'authentification
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token manquant' });
    }

    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token invalide' });
  }
};

// Endpoint pour vérifier les mises à jour
app.get('/updates/check', apiLimiter, async (req, res) => {
  try {
    const { version, platform } = req.query;
    
    if (!version || !platform) {
      return res.status(400).json({ error: 'Version et plateforme requises' });
    }

    const updates = await getAvailableUpdates(platform);
    const latestUpdate = findLatestCompatibleUpdate(updates, version);

    if (latestUpdate) {
      res.json({
        version: latestUpdate.version,
        url: `/updates/download/${latestUpdate.filename}`,
        notes: latestUpdate.notes,
        pubDate: latestUpdate.pubDate
      });
    } else {
      res.json({ version: null });
    }
  } catch (error) {
    log.error('Erreur lors de la vérification des mises à jour:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Endpoint pour télécharger les mises à jour
app.get('/updates/download/:filename', apiLimiter, async (req, res) => {
  try {
    const filePath = path.join(UPDATE_DIR, req.params.filename);
    
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'Fichier non trouvé' });
    }

    const hash = await calculateFileHash(filePath);
    res.set('X-File-Hash', hash);
    res.download(filePath);
  } catch (error) {
    log.error('Erreur lors du téléchargement de la mise à jour:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Endpoint pour recevoir les métriques
app.post('/metrics', authenticateToken, apiLimiter, async (req, res) => {
  try {
    const metrics = req.body;
    const timestamp = new Date().toISOString();
    const filename = `metrics-${timestamp}.json`;
    
    await fs.mkdir(METRICS_DIR, { recursive: true });
    await fs.writeFile(
      path.join(METRICS_DIR, filename),
      JSON.stringify(metrics, null, 2)
    );

    await processMetrics(metrics);
    
    res.status(200).json({ status: 'success' });
  } catch (error) {
    log.error('Erreur lors de la réception des métriques:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Endpoint pour recevoir les rapports d'erreur
app.post('/errors', authenticateToken, apiLimiter, async (req, res) => {
  try {
    const error = req.body;
    const timestamp = new Date().toISOString();
    const filename = `error-${timestamp}.json`;
    
    await fs.mkdir(path.join(METRICS_DIR, 'errors'), { recursive: true });
    await fs.writeFile(
      path.join(METRICS_DIR, 'errors', filename),
      JSON.stringify(error, null, 2)
    );

    await processError(error);
    
    res.status(200).json({ status: 'success' });
  } catch (error) {
    log.error('Erreur lors de la réception du rapport d\'erreur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Fonctions utilitaires
async function getAvailableUpdates(platform) {
  const files = await fs.readdir(UPDATE_DIR);
  const updates = [];

  for (const file of files) {
    if (file.endsWith(`.${platform}.zip`)) {
      const metaFile = file.replace('.zip', '.json');
      try {
        const metaContent = await fs.readFile(
          path.join(UPDATE_DIR, metaFile),
          'utf8'
        );
        const metadata = JSON.parse(metaContent);
        updates.push({
          ...metadata,
          filename: file
        });
      } catch (error) {
        log.warn(`Métadonnées manquantes pour ${file}`);
      }
    }
  }

  return updates;
}

function findLatestCompatibleUpdate(updates, currentVersion) {
  return updates
    .filter(update => semver.gt(update.version, currentVersion))
    .sort((a, b) => semver.rcompare(a.version, b.version))[0];
}

async function calculateFileHash(filePath) {
  const content = await fs.readFile(filePath);
  return createHash('sha256').update(content).digest('hex');
}

async function processMetrics(metrics) {
  // Traitement des métriques (à implémenter selon les besoins)
  // Par exemple : agrégation, alerting, etc.
}

async function processError(error) {
  // Traitement des erreurs (à implémenter selon les besoins)
  // Par exemple : notification, analyse, etc.
}

// Démarrage du serveur
app.listen(PORT, () => {
  log.info(`Serveur de mise à jour démarré sur le port ${PORT}`);
});
