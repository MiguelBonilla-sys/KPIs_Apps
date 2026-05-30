function toStr(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return isFinite(value) ? value : null;

  let s = String(value).trim();
  if (!s) return null;

  s = s.replace(/[^0-9.,-]/g, '');
  if (!s) return null;

  if (s.indexOf(',') >= 0 && s.indexOf('.') < 0) {
    if (/^\d{1,3}(,\d{3})+$/.test(s)) {
      s = s.replace(/,/g, '');
    } else {
      s = s.replace(',', '.');
    }
  } else {
    s = s.replace(/,/g, '');
  }

  const n = Number(s);
  return isNaN(n) ? null : n;
}

function parseWeek(weekStr) {
  const s = toStr(weekStr);
  const match = s.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return null;
  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;
  return { year: Number(match[1]), week: week };
}

function compareWeek(a, b) {
  const pa = parseWeek(a);
  const pb = parseWeek(b);
  if (!pa && !pb) return 0;
  if (!pa) return -1;
  if (!pb) return 1;
  if (pa.year !== pb.year) return pa.year - pb.year;
  return pa.week - pb.week;
}

function hasWeek(metrics, week) {
  return metrics.some(m => m.week === week);
}

function getLatestMetric(metrics) {
  if (!metrics.length) return null;
  let best = null;
  metrics.forEach(m => {
    if (!best || compareWeek(m.week, best.week) > 0) best = m;
  });
  return best;
}

function uniq(arr) {
  const seen = {};
  arr.forEach(x => { seen[x] = true; });
  return Object.keys(seen);
}

function truncate(text, maxLen) {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

function dedupeKey(input) {
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input);
  return Utilities.base64EncodeWebSafe(hash).slice(0, 100);
}

function getProp(key) {
  return PropertiesService.getScriptProperties().getProperty(key) || '';
}

function setProp(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, value);
}
