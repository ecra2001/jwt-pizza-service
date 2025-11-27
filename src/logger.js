const fetch = require('node-fetch');
const config = require('./config');

class Logger {
  constructor() {
    process.on('uncaughtException', (err) => {
      this.log('error', 'exception', {
        message: err.message,
        stack: err.stack,
      });
    });

    process.on('unhandledRejection', (reason) => {
      this.log('error', 'promiseRejection', { reason: JSON.stringify(reason) });
    });
  }

  httpLogger = (req, res, next) => {
    const originalSend = res.send.bind(res);

    res.send = (resBody) => {
      if (req.originalUrl.startsWith('/api/docs')) {
        return originalSend(resBody);
      }

      if (res.statusCode === 404 && !req.originalUrl.startsWith('/api/')) {
        return originalSend(resBody);
      }

      const logData = {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        authorized: !!req.headers.authorization,
        reqBody: this.stringify(req.body),
        resBody: this.stringify(resBody),
      };

      const level = this.statusToLogLevel(res.statusCode);
      this.log(level, 'http', logData);

      return originalSend(resBody);
    };

    next();
  };

  dbLogger(query) {
    const logData = { query };
    this.log('info', 'database', logData);
  }

  factoryLogger(requestBody, responseBody, success = true) {
    const level = success ? 'info' : 'error';
    const logData = {
      requestBody: this.stringify(requestBody),
      responseBody: this.stringify(responseBody),
    };
    this.log(level, 'factory', logData);
  }

  log(level, type, logData) {
    const labels = {
      component: config.metrics.source || 'jwt-pizza-service',
      level: level,
      type: type,
    };

    const values = [this.nowString(), this.sanitize(logData)];
    const logEvent = { streams: [{ stream: labels, values: [values] }] };

    this.sendLogToGrafana(logEvent);
  }

  statusToLogLevel(statusCode) {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    return 'info';
  }

  nowString() {
    return (Math.floor(Date.now()) * 1000000).toString();
  }

  sanitize(logData) {
    let dataStr = this.stringify(logData);

    dataStr = dataStr.replace(/"password":\s*"[^"]*"/g, '"password":"*****"');
    dataStr = dataStr.replace(/"apiKey":\s*"[^"]*"/g, '"apiKey":"*****"');
    dataStr = dataStr.replace(/"token":\s*"[^"]*"/g, '"token":"*****"');

    return dataStr;
  }

  stringify(obj) {
    try {
      return JSON.stringify(obj);
    } catch {
      return '[Unserializable object]';
    }
  }

  async sendLogToGrafana(event) {
    const body = JSON.stringify(event);
    try {
      const res = await fetch(config.logging.url, {
        method: 'post',
        body: body,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.logging.userId}:${config.logging.apiKey}`,
        },
      });
      if (!res.ok && process.env.NODE_ENV !== 'test') {
        const text = await res.text();
        console.log('Grafana log push failed:', res.status, text);
      }
    } catch (error) {
      console.log('Grafana log push failed:', error);
    }
  }
}

module.exports = new Logger();