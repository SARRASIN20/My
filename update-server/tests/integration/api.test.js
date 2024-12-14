const request = require('supertest');
const { app } = require('../../server');
const { createTestUpdate, cleanupTestData } = require('../helpers');
const jwt = require('jsonwebtoken');

describe('API Integration Tests', () => {
  let testUpdate;
  let adminToken;

  beforeAll(async () => {
    // Créer un token admin pour les tests
    adminToken = jwt.sign(
      { role: 'admin' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Créer une mise à jour de test
    testUpdate = await createTestUpdate();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('Updates API', () => {
    test('GET /updates/check retourne la dernière mise à jour', async () => {
      const res = await request(app)
        .get('/updates/check')
        .query({
          currentVersion: '1.0.0',
          platform: 'win'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('version');
      expect(res.body).toHaveProperty('downloadUrl');
    });

    test('POST /updates crée une nouvelle mise à jour', async () => {
      const res = await request(app)
        .post('/updates')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('version', '2.0.0')
        .field('platform', 'win')
        .field('minimumVersion', '1.0.0')
        .field('notes', 'Test update')
        .attach('file', Buffer.from('test'), 'update.zip');

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.version).toBe('2.0.0');
    });

    test('GET /updates/download/{id} télécharge la mise à jour', async () => {
      const res = await request(app)
        .get(`/updates/download/${testUpdate.id}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/octet-stream/);
    });
  });

  describe('Metrics API', () => {
    test('POST /metrics enregistre les métriques', async () => {
      const metrics = [
        {
          type: 'cpu',
          value: 45,
          timestamp: new Date().toISOString()
        },
        {
          type: 'memory',
          value: 2048,
          timestamp: new Date().toISOString()
        }
      ];

      const res = await request(app)
        .post('/metrics')
        .send(metrics);

      expect(res.status).toBe(201);
    });

    test('GET /metrics/query récupère les métriques', async () => {
      const res = await request(app)
        .get('/metrics/query')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          type: 'cpu',
          startTime: new Date(Date.now() - 3600000).toISOString(),
          endTime: new Date().toISOString()
        });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Errors API', () => {
    test('POST /errors rapporte une erreur', async () => {
      const error = {
        type: 'RuntimeError',
        message: 'Test error',
        stack: 'Error: Test error\n    at Test.run',
        metadata: { userId: '123' }
      };

      const res = await request(app)
        .post('/errors')
        .send(error);

      expect(res.status).toBe(201);
    });

    test('GET /errors/query récupère les erreurs', async () => {
      const res = await request(app)
        .get('/errors/query')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          status: 'open',
          startTime: new Date(Date.now() - 3600000).toISOString(),
          endTime: new Date().toISOString()
        });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    test('respecte les limites de taux', async () => {
      // Faire 11 requêtes rapides (limite: 10 par minute)
      const promises = Array(11).fill().map(() =>
        request(app)
          .get('/updates/check')
          .query({
            currentVersion: '1.0.0',
            platform: 'win'
          })
      );

      const results = await Promise.all(promises);
      const lastResponse = results[results.length - 1];

      expect(lastResponse.status).toBe(429);
      expect(lastResponse.body).toHaveProperty('error');
    });
  });

  describe('Authentication', () => {
    test('refuse l\'accès sans token', async () => {
      const res = await request(app)
        .get('/metrics/query');

      expect(res.status).toBe(401);
    });

    test('refuse l\'accès avec un token invalide', async () => {
      const res = await request(app)
        .get('/metrics/query')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
    });

    test('accepte un token valide', async () => {
      const res = await request(app)
        .get('/metrics/query')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('Validation des données', () => {
    test('rejette les métriques invalides', async () => {
      const invalidMetrics = [
        {
          type: 'cpu',
          value: 'invalid', // Devrait être un nombre
          timestamp: new Date().toISOString()
        }
      ];

      const res = await request(app)
        .post('/metrics')
        .send(invalidMetrics);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    test('rejette les mises à jour invalides', async () => {
      const res = await request(app)
        .post('/updates')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('version', 'invalid.version')
        .field('platform', 'invalid');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });
});
