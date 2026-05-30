function evaluateAlerts(data) {
  const alerts = [];
  const kpiIds = Object.keys(data.kpis);

  if (!data.globalLatestWeek) {
    logRow('Weekly_Metrics', 'WARN', 'no valid week data');
  }

  kpiIds.forEach(kpiId => {
    const kpi = data.kpis[kpiId];
    const metrics = data.metricsByKpi[kpiId] || [];
    const latestMetric = getLatestMetric(metrics);
    const value = (kpi.currentValue != null) ? kpi.currentValue : (latestMetric ? latestMetric.value : null);

    if (data.globalLatestWeek && !hasWeek(metrics, data.globalLatestWeek)) {
      pushAlert(alerts, kpi, 'WARN', 'missing data for week ' + data.globalLatestWeek);
    }

    if (value == null) {
      pushAlert(alerts, kpi, 'WARN', 'invalid or missing value');
    }

    if (kpi.threshold != null && value != null && value < kpi.threshold) {
      pushAlert(alerts, kpi, 'CRIT', 'value below threshold (' + value + ' < ' + kpi.threshold + ')');
    }
  });

  if (data.duplicateMetrics.length) {
    pushAlert(alerts, { kpiId: 'SYSTEM', team: 'SYSTEM' }, 'WARN', 'duplicate metrics detected');
  }

  return alerts;
}

function pushAlert(alerts, kpi, severity, message) {
  alerts.push({
    kpiId: kpi.kpiId || 'UNKNOWN',
    team: kpi.team || 'UNKNOWN',
    severity: severity,
    message: message
  });
}

function filterNewAlerts(alerts) {
  const cache = CacheService.getScriptCache();
  const salt = CONFIG.ALERTS.DEDUPE_SALT || '';
  const ttl = CONFIG.ALERTS.DEDUPE_TTL_SEC || 0;

  if (!ttl) return alerts.slice();

  const fresh = [];
  alerts.forEach(a => {
    const key = dedupeKey(salt + '|' + a.kpiId + '|' + a.severity + '|' + a.message);
    if (cache.get(key)) return;
    cache.put(key, '1', ttl);
    fresh.push(a);
  });
  return fresh;
}
