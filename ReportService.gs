function buildSummary(data, alerts) {
  const criticalAlerts = alerts.filter(a => a.severity === 'CRIT');
  const warnAlerts    = alerts.filter(a => a.severity === 'WARN');
  const teamsAtRisk   = uniq(criticalAlerts.map(a => a.team).filter(t => t && t !== 'SYSTEM'));
  const compliance    = computeCompliance(data);
  const week          = data.globalLatestWeek || 'N/A';

  const severityIcon = { CRIT: '🔴', WARN: '🟡' };

  const lines = [];
  lines.push('<b>📊 KPI EXECUTIVE SUMMARY</b>');
  lines.push('<i>Week: ' + week + '</i>');
  lines.push('');
  lines.push('🔴 Critical alerts: <b>' + criticalAlerts.length + '</b>');
  lines.push('🟡 Warnings: <b>' + warnAlerts.length + '</b>');
  lines.push('⚠️ Teams at risk: <b>' + (teamsAtRisk.length ? teamsAtRisk.join(', ') : 'none') + '</b>');
  lines.push('✅ Compliance: <b>' + compliance.percent + '%</b> (' + compliance.ok + '/' + compliance.total + ' KPIs above threshold)');
  lines.push('');

  if (alerts.length) {
    lines.push('<b>Top Alerts:</b>');
    alerts.slice(0, CONFIG.SUMMARY.MAX_ALERTS).forEach(a => {
      const icon = severityIcon[a.severity] || '⚪';
      lines.push(icon + ' <b>' + escapeHtml(a.kpiId) + '</b> [' + escapeHtml(a.team) + ']: ' + escapeHtml(a.message));
    });
  } else {
    lines.push('✅ No alerts. All KPIs within thresholds.');
  }

  return truncate(lines.join('\n'), CONFIG.TELEGRAM.MAX_LEN);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function computeCompliance(data) {
  let total = 0;
  let ok = 0;

  Object.keys(data.kpis).forEach(kpiId => {
    const kpi = data.kpis[kpiId];
    if (kpi.threshold == null) return;

    total++;
    const metrics = data.metricsByKpi[kpiId] || [];
    const latestMetric = getLatestMetric(metrics);
    const value = (kpi.currentValue != null) ? kpi.currentValue : (latestMetric ? latestMetric.value : null);

    if (value != null && value >= kpi.threshold) ok++;
  });

  const percent = total ? ((ok / total) * 100).toFixed(1) : '0.0';
  return { total: total, ok: ok, percent: percent };
}
