// ── TEST RUNNER ───────────────────────────────────────────────────────────────
var _pass = 0, _fail = 0;

function assert(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  ok ? _pass++ : _fail++;
  if (!ok) Logger.log('FAIL [' + label + '] expected=' + JSON.stringify(expected) + ' got=' + JSON.stringify(actual));
}

function runAllTests() {
  _pass = 0; _fail = 0;
  testUtils();
  testAlertEngine();
  testReportService();
  Logger.log('──────────────────────────────');
  Logger.log('RESULTS: ' + _pass + ' passed, ' + _fail + ' failed');
  if (_fail > 0) Logger.log('SOME TESTS FAILED — see above');
  else Logger.log('ALL TESTS PASSED');
}

// ── UTILS TESTS ───────────────────────────────────────────────────────────────
function testUtils() {
  // toStr
  assert('toStr null',      toStr(null),       '');
  assert('toStr undefined', toStr(undefined),  '');
  assert('toStr number',    toStr(42),         '42');
  assert('toStr whitespace',toStr('  hi  '),   'hi');

  // parseNumber — edge cases from spec
  assert('parseNumber empty',    parseNumber(''),        null);
  assert('parseNumber null',     parseNumber(null),      null);
  assert('parseNumber int',      parseNumber(42),        42);
  assert('parseNumber string',   parseNumber('3.14'),    3.14);
  assert('parseNumber comma-dec',parseNumber('3,14'),    3.14);   // ES decimal
  assert('parseNumber thousands',parseNumber('1,234.56'),1234.56);
  assert('parseNumber currency', parseNumber('$1,234'),  1234);
  assert('parseNumber invalid',  parseNumber('abc'),     null);
  assert('parseNumber Infinity', parseNumber(Infinity),  null);
  assert('parseNumber NaN str',  parseNumber('NaN'),     null);

  // parseWeek
  assert('parseWeek valid',   JSON.stringify(parseWeek('2024-W03')), JSON.stringify({year:2024,week:3}));
  assert('parseWeek invalid', parseWeek('03/2024'), null);
  assert('parseWeek empty',   parseWeek(''),        null);
  assert('parseWeek garbage', parseWeek('semana3'), null);

  // compareWeek
  assert('compareWeek eq',    compareWeek('2024-W01','2024-W01'), 0);
  assert('compareWeek lt',    compareWeek('2024-W01','2024-W02') < 0, true);
  assert('compareWeek gt',    compareWeek('2025-W01','2024-W52') > 0, true);
  assert('compareWeek bad-a', compareWeek('bad','2024-W01') < 0, true);
  assert('compareWeek bad-b', compareWeek('2024-W01','bad') > 0, true);

  // truncate
  assert('truncate short', truncate('hi', 10),     'hi');
  assert('truncate exact', truncate('hello', 5),   'hello');
  assert('truncate long',  truncate('hello world', 8), 'hello...');

  // escapeHtml
  assert('escapeHtml amp',   escapeHtml('a & b'),    'a &amp; b');
  assert('escapeHtml lt',    escapeHtml('<b>'),       '&lt;b&gt;');
  assert('escapeHtml clean', escapeHtml('hello'),     'hello');
  assert('escapeHtml num',   escapeHtml(42),          '42');

  // uniq
  assert('uniq dedupes', uniq(['a','b','a','c']).sort(), ['a','b','c']);
  assert('uniq empty',   uniq([]), []);
}

// ── ALERT ENGINE TESTS ────────────────────────────────────────────────────────
function testAlertEngine() {
  // Build synthetic data object (no sheet reads needed)
  function makeData(overrides) {
    return Object.assign({
      kpis: {
        K1: { kpiId:'K1', team:'Sales', target:100, threshold:80, currentValue:90 },
        K2: { kpiId:'K2', team:'Ops',   target:50,  threshold:40, currentValue:35 },
        K3: { kpiId:'K3', team:'IT',    target:null, threshold:null, currentValue:null }
      },
      metricsByKpi: {
        K1: [{ week:'2024-W10', value:90, owner:'Ana' }],
        K2: [{ week:'2024-W10', value:35, owner:'Bob' }],
        K3: []
      },
      globalLatestWeek: '2024-W10',
      duplicateMetrics: []
    }, overrides);
  }

  const data = makeData();
  const alerts = evaluateAlerts(data);

  const k2Alert = alerts.find(a => a.kpiId === 'K2');
  assert('K2 below threshold generates CRIT', k2Alert && k2Alert.severity === 'CRIT', true);

  const k3Alert = alerts.find(a => a.kpiId === 'K3');
  assert('K3 missing value generates alert', !!k3Alert, true);

  const k1Alert = alerts.find(a => a.kpiId === 'K1');
  assert('K1 above threshold no alert', !k1Alert, true);

  // KPI with no threshold — should NOT generate below-threshold alert
  const noThreshData = makeData();
  noThreshData.kpis.K1.threshold = null;
  noThreshData.kpis.K1.currentValue = 0;
  const noThreshAlerts = evaluateAlerts(noThreshData);
  const k1BelowAlert = noThreshAlerts.find(a => a.kpiId === 'K1' && a.message.indexOf('below threshold') >= 0);
  assert('KPI without threshold never fires below-threshold alert', !k1BelowAlert, true);

  // Missing week data
  const missingWeekData = makeData({ globalLatestWeek: '2024-W11' });
  const missingAlerts = evaluateAlerts(missingWeekData);
  const missingK1 = missingAlerts.find(a => a.kpiId === 'K1' && a.message.indexOf('missing data') >= 0);
  assert('Missing week data generates alert', !!missingK1, true);

  // Duplicate metrics flag
  const dupData = makeData({ duplicateMetrics: ['K1|2024-W10'] });
  const dupAlerts = evaluateAlerts(dupData);
  const sysAlert = dupAlerts.find(a => a.kpiId === 'SYSTEM');
  assert('Duplicate metrics generates SYSTEM alert', !!sysAlert, true);

}

// ── REPORT SERVICE TESTS ──────────────────────────────────────────────────────
function testReportService() {
  const data = {
    kpis: {
      K1: { kpiId:'K1', team:'Sales', threshold:80, currentValue:90 },
      K2: { kpiId:'K2', team:'Ops',   threshold:40, currentValue:35 }
    },
    metricsByKpi: {
      K1: [{ week:'2024-W10', value:90 }],
      K2: [{ week:'2024-W10', value:35 }]
    },
    globalLatestWeek: '2024-W10',
    duplicateMetrics: []
  };

  const alerts = [
    { kpiId:'K2', team:'Ops', severity:'CRIT', message:'value below threshold (35 < 40)' }
  ];

  const summary = buildSummary(data, alerts);

  assert('Summary contains week',       summary.indexOf('2024-W10') >= 0,  true);
  assert('Summary contains CRIT count', summary.indexOf('1') >= 0,         true);
  assert('Summary contains team',       summary.indexOf('Ops') >= 0,       true);
  assert('Summary contains compliance', summary.indexOf('Compliance') >= 0, true);
  assert('Summary contains HTML bold',  summary.indexOf('<b>') >= 0,        true);
  assert('Summary length within limit', summary.length <= CONFIG.TELEGRAM.MAX_LEN, true);

  // No alerts case
  const okSummary = buildSummary(data, []);
  assert('No-alert summary says no alerts', okSummary.indexOf('No alerts') >= 0, true);

  // HTML special chars in message are escaped
  const xssAlerts = [{ kpiId:'K1', team:'T', severity:'WARN', message:'<script>alert(1)</script>' }];
  const xssSummary = buildSummary(data, xssAlerts);
  assert('HTML in alert message is escaped', xssSummary.indexOf('<script>') < 0, true);
}
