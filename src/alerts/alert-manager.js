const nodemailer = require('nodemailer');
const { WebClient } = require('@slack/web-api');
const log = require('electron-log');

class AlertManager {
  constructor(config = {}) {
    this.config = {
      email: {
        enabled: true,
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: true,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        from: process.env.ALERT_EMAIL_FROM,
        to: process.env.ALERT_EMAIL_TO?.split(',') || []
      },
      slack: {
        enabled: true,
        token: process.env.SLACK_TOKEN,
        channel: process.env.SLACK_CHANNEL
      },
      thresholds: {
        cpu: 80, // Pourcentage
        memory: 85, // Pourcentage
        disk: 90, // Pourcentage
        errorRate: 5, // Erreurs par minute
        responseTime: 2000 // Millisecondes
      },
      ...config
    };

    this.alertHistory = new Map();
    this.setupTransports();
  }

  setupTransports() {
    if (this.config.email.enabled) {
      this.emailTransport = nodemailer.createTransport({
        host: this.config.email.host,
        port: this.config.email.port,
        secure: this.config.email.secure,
        auth: this.config.email.auth
      });
    }

    if (this.config.slack.enabled) {
      this.slackClient = new WebClient(this.config.slack.token);
    }
  }

  async checkMetrics(metrics) {
    try {
      const alerts = [];

      // Vérification CPU
      if (metrics.cpu > this.config.thresholds.cpu) {
        alerts.push(this.createAlert(
          'high_cpu',
          'warning',
          `Utilisation CPU élevée: ${metrics.cpu}%`,
          metrics
        ));
      }

      // Vérification mémoire
      if (metrics.memory > this.config.thresholds.memory) {
        alerts.push(this.createAlert(
          'high_memory',
          'warning',
          `Utilisation mémoire élevée: ${metrics.memory}%`,
          metrics
        ));
      }

      // Vérification espace disque
      if (metrics.disk > this.config.thresholds.disk) {
        alerts.push(this.createAlert(
          'low_disk_space',
          'critical',
          `Espace disque critique: ${metrics.disk}%`,
          metrics
        ));
      }

      // Vérification taux d'erreur
      if (metrics.errorRate > this.config.thresholds.errorRate) {
        alerts.push(this.createAlert(
          'high_error_rate',
          'critical',
          `Taux d'erreur élevé: ${metrics.errorRate} erreurs/min`,
          metrics
        ));
      }

      // Vérification temps de réponse
      if (metrics.responseTime > this.config.thresholds.responseTime) {
        alerts.push(this.createAlert(
          'high_response_time',
          'warning',
          `Temps de réponse élevé: ${metrics.responseTime}ms`,
          metrics
        ));
      }

      // Envoi des alertes
      for (const alert of alerts) {
        await this.sendAlert(alert);
      }

      return alerts;
    } catch (error) {
      log.error('Erreur lors de la vérification des métriques:', error);
      throw error;
    }
  }

  createAlert(type, severity, message, data) {
    return {
      id: `${type}_${Date.now()}`,
      type,
      severity,
      message,
      timestamp: new Date().toISOString(),
      data
    };
  }

  async sendAlert(alert) {
    try {
      // Vérification de la fréquence des alertes
      if (this.shouldThrottleAlert(alert)) {
        return;
      }

      // Envoi par email
      if (this.config.email.enabled) {
        await this.sendEmailAlert(alert);
      }

      // Envoi sur Slack
      if (this.config.slack.enabled) {
        await this.sendSlackAlert(alert);
      }

      // Mise à jour de l'historique
      this.updateAlertHistory(alert);

      log.info('Alerte envoyée:', alert);
    } catch (error) {
      log.error('Erreur lors de l\'envoi de l\'alerte:', error);
      throw error;
    }
  }

  shouldThrottleAlert(alert) {
    const lastAlert = this.alertHistory.get(alert.type);
    if (!lastAlert) return false;

    // Limites de fréquence selon la sévérité
    const throttleTime = alert.severity === 'critical' ? 5 * 60 * 1000 : 30 * 60 * 1000;
    return (Date.now() - lastAlert.timestamp) < throttleTime;
  }

  updateAlertHistory(alert) {
    this.alertHistory.set(alert.type, {
      timestamp: Date.now(),
      count: (this.alertHistory.get(alert.type)?.count || 0) + 1
    });
  }

  async sendEmailAlert(alert) {
    const emailContent = this.formatEmailAlert(alert);
    
    await this.emailTransport.sendMail({
      from: this.config.email.from,
      to: this.config.email.to,
      subject: `[${alert.severity.toUpperCase()}] ${alert.message}`,
      html: emailContent
    });
  }

  async sendSlackAlert(alert) {
    const slackMessage = this.formatSlackAlert(alert);
    
    await this.slackClient.chat.postMessage({
      channel: this.config.slack.channel,
      ...slackMessage
    });
  }

  formatEmailAlert(alert) {
    return `
      <h2>Alerte ${alert.severity.toUpperCase()}</h2>
      <p><strong>Type:</strong> ${alert.type}</p>
      <p><strong>Message:</strong> ${alert.message}</p>
      <p><strong>Timestamp:</strong> ${alert.timestamp}</p>
      <h3>Données</h3>
      <pre>${JSON.stringify(alert.data, null, 2)}</pre>
    `;
  }

  formatSlackAlert(alert) {
    const color = alert.severity === 'critical' ? '#ff0000' : '#ffa500';

    return {
      text: `*[${alert.severity.toUpperCase()}] ${alert.message}*`,
      attachments: [
        {
          color,
          fields: [
            {
              title: 'Type',
              value: alert.type,
              short: true
            },
            {
              title: 'Timestamp',
              value: alert.timestamp,
              short: true
            },
            {
              title: 'Données',
              value: '```' + JSON.stringify(alert.data, null, 2) + '```'
            }
          ]
        }
      ]
    };
  }

  // Méthodes utilitaires
  async testAlertChannels() {
    const testAlert = this.createAlert(
      'test_alert',
      'info',
      'Test des canaux d\'alerte',
      { test: true }
    );

    try {
      await this.sendAlert(testAlert);
      return true;
    } catch (error) {
      log.error('Erreur lors du test des canaux d\'alerte:', error);
      return false;
    }
  }

  updateThresholds(newThresholds) {
    this.config.thresholds = {
      ...this.config.thresholds,
      ...newThresholds
    };
  }

  getAlertHistory() {
    return Array.from(this.alertHistory.entries()).map(([type, data]) => ({
      type,
      ...data
    }));
  }
}

module.exports = { AlertManager };
