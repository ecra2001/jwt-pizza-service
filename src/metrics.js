const os = require('os');
const fetch = require('node-fetch');
const config = require('./config');

let httpRequests = { total: 0, GET: 0, POST: 0, PUT: 0, DELETE: 0 };
let activeUsers = new Set();
let authAttempts = { success: 0, failure: 0 };
let pizzas = { sold: 0, failures: 0, revenue: 0, latencyTotal: 0, latencyCount: 0 };

function sendMetricToGrafana(metricName, metricValue, type, unit) {
  const metric = {
    resourceMetrics: [
      {
        scopeMetrics: [
          {
            metrics: [
              {
                name: metricName,
                unit: unit,
                [type]: {
                  dataPoints: [
                    {
                      asInt: Number.isInteger(metricValue) ? metricValue : undefined,
                      asDouble: !Number.isInteger(metricValue) ? metricValue : undefined,
                      timeUnixNano: Date.now() * 1000000,
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  };

  if (type === 'sum') {
    const m = metric.resourceMetrics[0].scopeMetrics[0].metrics[0][type];
    m.aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
    m.isMonotonic = true;
  }

  const body = JSON.stringify(metric);
  fetch(config.metrics.url, {
    method: 'POST',
    body,
    headers: {
      Authorization: `Bearer ${config.metrics.apiKey}`,
      'Content-Type': 'application/json',
    },
  })
    .then((response) => {
      if (!response.ok) {
        response.text().then((text) => {
          console.error(`Failed to push ${metricName}:\n${text}`);
        });
      } else {
        console.log(`Pushed ${metricName}`);
      }
    })
    .catch((error) => console.error('Error pushing metrics:', error));
}

// HTTP Metrics
function requestTracker(req, res, next) {
  const method = req.method.toUpperCase();
  const start = Date.now();
  res.on('finish', () => {
    const latency = Date.now() - start;
    httpRequests.total++;
    if (httpRequests[method] !== undefined) httpRequests[method]++;
    sendMetricToGrafana('latency_service_endpoint', latency, 'sum', 'ms');
  });
  next();
}

// Auth Metrics
function authAttempt(success, userId) {
  if (success) {
    authAttempts.success++;
    activeUsers.add(userId);
  } else {
    authAttempts.failure++;
    activeUsers.delete(userId);
  }
}

// Pizza Metrics
function pizzaPurchase(success, latency, price) {
  if (success) {
    pizzas.sold++;
    pizzas.revenue += price;
    pizzas.latencyTotal += latency;
    pizzas.latencyCount++;
  } else {
    pizzas.failures++;
  }
}

// System Metrics
function getCpuUsagePercentage() {
  const cpuUsage = os.loadavg()[0] / os.cpus().length;
  return (cpuUsage * 100).toFixed(2);
}

function getMemoryUsagePercentage() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return ((used / total) * 100).toFixed(2);
}

if (process.env.NODE_ENV !== 'test') {
setInterval(() => {
  try {
    // HTTP Metrics
    sendMetricToGrafana('http_total_requests', httpRequests.total, 'sum', '1');
    sendMetricToGrafana('http_get_requests', httpRequests.GET, 'sum', '1');
    sendMetricToGrafana('http_post_requests', httpRequests.POST, 'sum', '1');
    sendMetricToGrafana('http_put_requests', httpRequests.PUT, 'sum', '1');
    sendMetricToGrafana('http_delete_requests', httpRequests.DELETE, 'sum', '1');

    // Active users
    sendMetricToGrafana('active_users', activeUsers.size, 'gauge', '1');

    // Auth Metrics
    sendMetricToGrafana('auth_success', authAttempts.success, 'sum', '1');
    sendMetricToGrafana('auth_failure', authAttempts.failure, 'sum', '1');

    // System Metrics
    sendMetricToGrafana('cpu_usage', getCpuUsagePercentage(), 'gauge', '%');
    sendMetricToGrafana('memory_usage', getMemoryUsagePercentage(), 'gauge', '%');

    // Pizza Metrics
    sendMetricToGrafana('pizzas_sold', pizzas.sold, 'sum', '1');
    sendMetricToGrafana('pizza_failures', pizzas.failures, 'sum', '1');
    sendMetricToGrafana('pizza_revenue', pizzas.revenue.toFixed(2), 'sum', 'USD');
    const avgLatency =
      pizzas.latencyCount > 0 ? pizzas.latencyTotal / pizzas.latencyCount : 0;
    sendMetricToGrafana('latency_pizza_creation', avgLatency, 'sum', 'ms');
  } catch (err) {
    console.error('Error sending metrics:', err);
  }
}, 60000);
}

module.exports = {
  requestTracker,
  authAttempt,
  pizzaPurchase,
};