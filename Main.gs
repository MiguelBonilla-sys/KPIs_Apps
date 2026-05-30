function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('KPI Ops')
    .addItem('Run KPI Checks', 'runAll')
    .addToUi();
}

function runAll() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    logRow('runAll', 'WARN', 'lock busy');
    return;
  }

  try {
    logRow('runAll', 'START', 'begin');
    validateConfig();
    const data = loadData();
    const alerts = evaluateAlerts(data);
    const newAlerts = filterNewAlerts(alerts);
    writeAlerts(newAlerts);
    const summary = buildSummary(data, alerts);
    sendTelegramMessage(summary);
    logRow('runAll', 'OK', 'alerts=' + alerts.length);
  } catch (err) {
    logRow('runAll', 'ERROR', String(err));
    throw err;
  } finally {
    lock.releaseLock();
  }
}

function writeAlerts(alerts) {
  if (!alerts.length) return;
  const rows = alerts.map(a => [new Date(), a.kpiId, a.severity, a.message]);
  appendRows(CONFIG.SHEETS.ALERTS, rows);
}
