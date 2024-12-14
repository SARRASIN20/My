const os = require('os');
const { app } = require('electron');
const log = require('electron-log');
const fetch = require('node-fetch');

class MonitoringManager {
  constructor(config = {}) {
    this.config = {
      metricsInterval: 5 * 60 * 1000, // 5 minutes
      errorReportingEnabled: true,
      performanceMonitoringEnabled: true,
      usageTrackingEnabled: true,
      ...config
    };

    this.metrics = {
      system: {},
      application: {},
      performance: {},
      errors: []
    };

    this.startTime = Date.now();
  }

  initialize() {
    this.setupErrorHandling();
    this.startMetricsCollection();
    log.info('MonitoringManager initialisé');
  }

  setupErrorHandling() {
    if (this.config.errorReportingEnabled) {
      process.on('uncaughtException', (error) => {
        this.handleError('uncaughtException', error);
      });

      process.on('unhandledRejection', (reason) => {
        this.handleError('unhandledRejection', reason);
      });

      app.on('render-process-gone', (event, webContents, details) => {
        this.handleError('render-process-gone', details);
      });

      app.on('child-process-gone', (event, details) => {
        this.handleError('child-process-gone', details);
      });
    }
  }

  startMetricsCollection() {
    this.collectMetrics();
    setInterval(() => {
      this.collectMetrics();
    }, this.config.metricsInterval);
  }

  async collectMetrics() {
    try {
      if (this.config.performanceMonitoringEnabled) {
        this.collectSystemMetrics();
        this.collectApplicationMetrics();
        this.collectPerformanceMetrics();
      }

      await this.sendMetrics();
    } catch (error) {
      log.error('Erreur lors de la collecte des métriques:', error);
    }
  }

  collectSystemMetrics() {
    this.metrics.system = {
      timestamp: Date.now(),
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      electronVersion: process.versions.electron,
      cpuUsage: os.loadavg(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      uptime: os.uptime(),
      networkInterfaces: this.getNetworkInfo()
    };
  }

  collectApplicationMetrics() {
    this.metrics.application = {
      timestamp: Date.now(),
      version: app.getVersion(),
      uptime: (Date.now() - this.startTime) / 1000,
      windows: this.getWindowsInfo(),
      processMemory: process.memoryUsage(),
      processMetrics: app.getAppMetrics()
    };
  }

  collectPerformanceMetrics() {
    this.metrics.performance = {
      timestamp: Date.now(),
      cpu: process.cpuUsage(),
      memory: process.memoryUsage(),
      heap: this.getHeapStatistics(),
      gc: this.getGCMetrics()
    };
  }

  getNetworkInfo() {
    const interfaces = os.networkInterfaces();
    return Object.keys(interfaces).reduce((acc, name) => {
      acc[name] = interfaces[name].map(({ address, netmask, family, mac }) => ({
        address,
        netmask,
        family,
        mac
      }));
      return acc;
    }, {});
  }

  getWindowsInfo() {
    return BrowserWindow.getAllWindows().map(window => ({
      id: window.id,
      bounds: window.getBounds(),
      isVisible: window.isVisible(),
      isMinimized: window.isMinimized(),
      isMaximized: window.isMaximized()
    }));
  }

  getHeapStatistics() {
    return {
      totalHeapSize: process.memoryUsage().heapTotal,
      usedHeapSize: process.memoryUsage().heapUsed,
      heapSizeLimit: process.memoryUsage().rss
    };
  }

  getGCMetrics() {
    // Note: Ces métriques nécessitent des flags Node.js spécifiques
    // --expose-gc doit être activé
    if (global.gc) {
      const beforeGC = process.memoryUsage().heapUsed;
      global.gc();
      const afterGC = process.memoryUsage().heapUsed;
      return {
        beforeGC,
        afterGC,
        freed: beforeGC - afterGC
      };
    }
    return null;
  }

  handleError(type, error) {
    const errorInfo = {
      type,
      timestamp: Date.now(),
      message: error.message || String(error),
      stack: error.stack,
      systemInfo: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        electronVersion: process.versions.electron
      }
    };

    this.metrics.errors.push(errorInfo);
    this.reportError(errorInfo);
    log.error('Erreur capturée:', errorInfo);
  }

  async reportError(errorInfo) {
    try {
      if (this.config.errorReportingEndpoint) {
        await fetch(this.config.errorReportingEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiToken}`
          },
          body: JSON.stringify(errorInfo)
        });
      }
    } catch (error) {
      log.error('Erreur lors du signalement de l\'erreur:', error);
    }
  }

  async sendMetrics() {
    try {
      if (this.config.metricsEndpoint) {
        await fetch(this.config.metricsEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiToken}`
          },
          body: JSON.stringify(this.metrics)
        });
      }
    } catch (error) {
      log.error('Erreur lors de l\'envoi des métriques:', error);
    }
  }

  trackEvent(category, action, label = null, value = null) {
    if (this.config.usageTrackingEnabled) {
      const event = {
        timestamp: Date.now(),
        category,
        action,
        label,
        value
      };

      if (this.config.analyticsEndpoint) {
        this.sendAnalytics(event).catch(error => {
          log.error('Erreur lors de l\'envoi des analytics:', error);
        });
      }
    }
  }

  async sendAnalytics(event) {
    try {
      await fetch(this.config.analyticsEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiToken}`
        },
        body: JSON.stringify(event)
      });
    } catch (error) {
      log.error('Erreur lors de l\'envoi des analytics:', error);
    }
  }

  getMetrics() {
    return this.metrics;
  }

  clearMetrics() {
    this.metrics = {
      system: {},
      application: {},
      performance: {},
      errors: []
    };
  }
}

module.exports = { MonitoringManager };
