const request = require('supertest');
const path = require('path');
const fs = require('fs').promises;
const jwt = require('jsonwebtoken');
const app = require('../server');

describe('Update Server', () => {
  let testToken;

  beforeAll(async () => {
    // Création du token de test
    testToken = jwt.sign({ id: 'test-client' }, process.env.JWT_SECRET || 'test-secret');
    
    // Création des répertoires de test
    await fs.mkdir(path.join(__dirname, '../updates'), { recursive: true });
    await fs.mkdir(path.join(__dirname, '../metrics'), { recursive: true });
  });

  afterAll(async () => {
    // Nettoyage des fichiers de test
    await fs.rm(path.join(__dirname, '../updates'), { recursive: true, force: true });
    await fs.rm(path.join(__dirname, '../metrics'), { recursive: true, force: true });
  });

  describe('GET /updates/check', () => {
    beforeEach(async () => {
      // Création d'un fichier de mise à jour de test
      const testUpdate = {
        version: '1.1.0',
        notes: 'Test update',
        pubDate: new Date().toISOString()
      };

      await fs.writeFile(
        path.join(__dirname, '../updates/update-1.1.0.win.json'),
        JSON.stringify(testUpdate)
      );

      await fs.writeFile(
        path.join(__dirname, '../updates/update-1.1.0.win.zip'),
        'test update content'
      );
    });

    test('devrait retourner la dernière mise à jour disponible', async () => {
      const response = await request(app)
        .get('/updates/check')
        .query({
          version: '1.0.0',
          platform: 'win'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('version', '1.1.0');
      expect(response.body).toHaveProperty('url');
      expect(response.body).toHaveProperty('notes');
    });

    test('devrait retourner 400 si les paramètres sont manquants', async () => {
      const response = await request(app)
        .get('/updates/check');

      expect(response.status).toBe(400);
    });
  });

  describe('GET /updates/download/:filename', () => {
    beforeEach(async () => {
      await fs.writeFile(
        path.join(__dirname, '../updates/test-update.zip'),
        'test update content'
      );
    });

    test('devrait télécharger le fichier de mise à jour', async () => {
      const response = await request(app)
        .get('/updates/download/test-update.zip');

      expect(response.status).toBe(200);
      expect(response.header['content-type']).toMatch(/application\/octet-stream/);
      expect(response.header['x-file-hash']).toBeDefined();
    });

    test('devrait retourner 404 pour un fichier inexistant', async () => {
      const response = await request(app)
        .get('/updates/download/nonexistent.zip');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /metrics', () => {
    const testMetrics = {
      system: {
        cpu: 50,
        memory: 1024
      }
    };

    test('devrait accepter les métriques avec un token valide', async () => {
      const response = await request(app)
        .post('/metrics')
        .set('Authorization', `Bearer ${testToken}`)
        .send(testMetrics);

      expect(response.status).toBe(200);
    });

    test('devrait rejeter les métriques sans token', async () => {
      const response = await request(app)
        .post('/metrics')
        .send(testMetrics);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /errors', () => {
    const testError = {
      message: 'Test error',
      stack: 'Error stack trace'
    };

    test('devrait accepter les rapports d\'erreur avec un token valide', async () => {
      const response = await request(app)
        .post('/errors')
        .set('Authorization', `Bearer ${testToken}`)
        .send(testError);

      expect(response.status).toBe(200);
    });

    test('devrait rejeter les rapports d\'erreur sans token', async () => {
      const response = await request(app)
        .post('/errors')
        .send(testError);

      expect(response.status).toBe(401);
    });
  });

  describe('Rate Limiting', () => {
    test('devrait limiter les requêtes excessives', async () => {
      const requests = Array(101).fill().map(() => 
        request(app)
          .get('/updates/check')
          .query({ version: '1.0.0', platform: 'win' })
      );

      const responses = await Promise.all(requests);
      const tooManyRequests = responses.filter(r => r.status === 429);
      expect(tooManyRequests.length).toBeGreaterThan(0);
    });
  });
});
