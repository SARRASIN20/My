const apm = require('elastic-apm-node');
const { Histogram, Counter, Gauge } = require('prom-client');
const opentelemetry = require('@opentelemetry/api');
const { NodeTracerProvider } = require('@opentelemetry/node');
const { SimpleSpanProcessor } = require('@opentelemetry/tracing');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');

// Configuration APM
const initAPM = () => {
  if (process.env.APM_ENABLED === 'true') {
    apm.start({
      serviceName: 'update-server',
      serverUrl: process.env.APM_SERVER_URL,
      environment: process.env.NODE_ENV,
      active: true,
      captureBody: 'errors',
      errorOnAbortedRequests: true,
      captureErrorLogStackTraces: 'always'
    });
  }
};

// Métriques Prometheus
const metrics = {
  requestDuration: new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Durée des requêtes HTTP',
    labelNames: ['method', 'route', 'status_code']
  }),

  activeConnections: new Gauge({
    name: 'active_connections',
    help: 'Nombre de connexions actives'
  }),

  updateDownloads: new Counter({
    name: 'update_downloads_total',
    help: 'Nombre total de téléchargements de mises à jour',
    labelNames: ['version', 'platform']
  }),

  errorCount: new Counter({
    name: 'error_count_total',
    help: 'Nombre total d\'erreurs',
    labelNames: ['type', 'severity']
  })
};

// Configuration OpenTelemetry
const initTracing = () => {
  const provider = new NodeTracerProvider();
  const exporter = new JaegerExporter({
    endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces'
  });

  provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
  provider.register();

  return opentelemetry.trace.getTracer('update-server');
};

// Middleware de monitoring
const monitoringMiddleware = (req, res, next) => {
  const start = process.hrtime();

  // Incrémente le compteur de connexions actives
  metrics.activeConnections.inc();

  // Crée un span pour la requête
  const tracer = opentelemetry.trace.getTracer('update-server');
  const span = tracer.startSpan(`${req.method} ${req.path}`);

  // Ajoute les attributs au span
  span.setAttribute('http.method', req.method);
  span.setAttribute('http.url', req.url);
  span.setAttribute('http.route', req.route?.path);

  // Capture la réponse
  const originalEnd = res.end;
  res.end = function(...args) {
    // Calcule la durée
    const [seconds, nanoseconds] = process.hrtime(start);
    const duration = seconds + nanoseconds / 1e9;

    // Enregistre la métrique de durée
    metrics.requestDuration.observe(
      {
        method: req.method,
        route: req.route?.path || 'unknown',
        status_code: res.statusCode
      },
      duration
    );

    // Décrémente le compteur de connexions
    metrics.activeConnections.dec();

    // Finalise le span
    span.setAttribute('http.status_code', res.statusCode);
    span.end();

    // Appelle la fonction originale
    originalEnd.apply(res, args);
  };

  next();
};

// Middleware de monitoring des erreurs
const errorMonitoringMiddleware = (err, req, res, next) => {
  // Incrémente le compteur d'erreurs
  metrics.errorCount.inc({
    type: err.name || 'UnknownError',
    severity: err.severity || 'error'
  });

  // Capture l'erreur dans APM
  if (apm.isStarted()) {
    apm.captureError(err);
  }

  next(err);
};

// Endpoint pour les métriques Prometheus
const metricsEndpoint = async (req, res) => {
  try {
    const { register } = require('prom-client');
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
};

// Endpoint pour le health check
const healthCheck = async (req, res) => {
  const health = {
    uptime: process.uptime(),
    status: 'UP',
    timestamp: new Date().toISOString()
  };

  try {
    // Vérification de la base de données
    // await db.query('SELECT 1');
    health.database = 'UP';
  } catch (e) {
    health.database = 'DOWN';
    health.status = 'DOWN';
  }

  try {
    // Vérification du stockage
    // await storage.check();
    health.storage = 'UP';
  } catch (e) {
    health.storage = 'DOWN';
    health.status = 'DOWN';
  }

  const status = health.status === 'UP' ? 200 : 503;
  res.status(status).json(health);
};

module.exports = {
  initAPM,
  initTracing,
  metrics,
  monitoringMiddleware,
  errorMonitoringMiddleware,
  metricsEndpoint,
  healthCheck
};
