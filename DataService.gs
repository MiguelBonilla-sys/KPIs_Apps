function loadData() {
  const kpiRows = readSheetRows(CONFIG.SHEETS.KPIS);
  const metricRows = readSheetRows(CONFIG.SHEETS.METRICS);

  const kpis = {};
  const kpiDuplicates = [];

  kpiRows.forEach((r, idx) => {
    const kpiId = toStr(r[0]);
    const team = toStr(r[1]);
    if (!kpiId) {
      logRow('KPIs', 'WARN', 'missing kpi_id at row ' + (idx + 2));
      return;
    }
    if (kpis[kpiId]) kpiDuplicates.push(kpiId);

    kpis[kpiId] = {
      kpiId: kpiId,
      team: team || 'UNKNOWN',
      target: parseNumber(r[2]),
      threshold: parseNumber(r[3]),
      currentValue: parseNumber(r[4])
    };
  });

  const metricsByKpi = {};
  const duplicateMetrics = [];
  const invalidWeekMetrics = [];
  const unknownKpiMetrics = [];
  const seenMetricKey = {};
  let globalLatestWeek = null;

  metricRows.forEach((r, idx) => {
    const week = toStr(r[0]);
    const kpiId = toStr(r[1]);
    const value = parseNumber(r[2]);
    const owner = toStr(r[3]);

    if (!week || !kpiId) {
      logRow('Weekly_Metrics', 'WARN', 'missing week/kpi_id at row ' + (idx + 2));
      return;
    }

    const key = kpiId + '|' + week;
    if (seenMetricKey[key]) duplicateMetrics.push(key);
    seenMetricKey[key] = true;

    if (!kpis[kpiId]) unknownKpiMetrics.push(kpiId);

    if (!metricsByKpi[kpiId]) metricsByKpi[kpiId] = [];
    metricsByKpi[kpiId].push({ week: week, value: value, owner: owner });

    if (parseWeek(week)) {
      if (!globalLatestWeek || compareWeek(week, globalLatestWeek) > 0) {
        globalLatestWeek = week;
      }
    } else {
      invalidWeekMetrics.push(key);
    }
  });

  if (kpiDuplicates.length) {
    logRow('KPIs', 'WARN', 'duplicate kpi_id: ' + uniq(kpiDuplicates).join(', '));
  }
  if (duplicateMetrics.length) {
    logRow('Weekly_Metrics', 'WARN', 'duplicate metrics: ' + uniq(duplicateMetrics).length);
  }
  if (unknownKpiMetrics.length) {
    logRow('Weekly_Metrics', 'WARN', 'metrics for unknown kpi_id: ' + uniq(unknownKpiMetrics).join(', '));
  }
  if (invalidWeekMetrics.length) {
    logRow('Weekly_Metrics', 'WARN', 'invalid week format: ' + uniq(invalidWeekMetrics).length);
  }

  return {
    kpis: kpis,
    metricsByKpi: metricsByKpi,
    globalLatestWeek: globalLatestWeek,
    duplicateMetrics: duplicateMetrics
  };
}
