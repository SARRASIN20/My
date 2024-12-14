const autocannon = require('autocannon');
const { promisify } = require('util');
const { createTestUpdate, cleanupTestData } = require('../helpers');

const run = promisify(autocannon);

describe('Tests de charge', () => {
  let testUpdate;

  beforeAll(async () => {
    testUpdate = await createTestUpdate();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  test('Test de charge des vérifications de mise à jour', async () => {
    const result = await run({
      url: 'http://localhost:3000/updates/check?currentVersion=1.0.0&platform=win',
      connections: 100,
      duration: 10,
      headers: {
        'Accept': 'application/json'
      }
    });

    expect(result.errors).toBe(0);
    expect(result.timeouts).toBe(0);
    expect(result.non2xx).toBe(0);
    expect(result.latency.p99).toBeLessThan(1000); // 99e percentile < 1s
  });

  test('Test de charge des téléchargements', async () => {
    const result = await run({
      url: `http://localhost:3000/updates/download/${testUpdate.id}`,
      connections: 50,
      duration: 10,
      headers: {
        'Accept': 'application/octet-stream'
      }
    });

    expect(result.errors).toBe(0);
    expect(result.timeouts).toBe(0);
    expect(result.non2xx).toBe(0);
    expect(result.latency.p95).toBeLessThan(2000); // 95e percentile < 2s
  });

  test('Test de charge des métriques', async () => {
    const metrics = [{
      type: 'cpu',
      value: 45,
      timestamp: new Date().toISOString()
    }];

    const result = await run({
      url: 'http://localhost:3000/metrics',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metrics),
      connections: 200,
      duration: 10
    });

    expect(result.errors).toBe(0);
    expect(result.timeouts).toBe(0);
    expect(result.non2xx).toBe(0);
    expect(result.latency.p99).toBeLessThan(500); // 99e percentile < 500ms
  });

  test('Test de charge des rapports d\'erreur', async () => {
    const error = {
      type: 'RuntimeError',
      message: 'Test error',
      stack: 'Error: Test error\n    at Test.run'
    };

    const result = await run({
      url: 'http://localhost:3000/errors',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(error),
      connections: 150,
      duration: 10
    });

    expect(result.errors).toBe(0);
    expect(result.timeouts).toBe(0);
    expect(result.non2xx).toBe(0);
    expect(result.latency.p95).toBeLessThan(300); // 95e percentile < 300ms
  });
});
