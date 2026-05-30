const CONFIG = {
  SHEETS: {
    KPIS: 'KPIs',
    METRICS: 'Weekly_Metrics',
    ALERTS: 'Alerts',
    LOGS: 'Logs'
  },
  TELEGRAM: {
    BASE_URL: 'https://api.telegram.org/bot',
    MAX_LEN: 3900,
    MAX_RETRIES: 3,
    RETRY_MS: 1500
  },
  ALERTS: {
    DEDUPE_TTL_SEC: 3600,
    DEDUPE_SALT: ''
  },
  SUMMARY: {
    MAX_ALERTS: 10
  }
};
