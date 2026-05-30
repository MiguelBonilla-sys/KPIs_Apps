// ── ENV CONFIG ────────────────────────────────────────────────────────────────
// Secrets live in Script Properties — never in source code.
// See .env.example for the full list of keys.

function setAllConfig() {
  const ui = SpreadsheetApp.getUi();

  const token = ui.prompt('Telegram Token', 'Paste your bot token from @BotFather:', ui.ButtonSet.OK_CANCEL);
  if (token.getSelectedButton() !== ui.Button.OK || !token.getResponseText().trim()) return;

  const chatId = ui.prompt('Telegram Chat ID', 'Paste your chat_id (run getTelegramChatId() first if needed):', ui.ButtonSet.OK_CANCEL);
  if (chatId.getSelectedButton() !== ui.Button.OK || !chatId.getResponseText().trim()) return;

  setProp('TELEGRAM_TOKEN',  token.getResponseText().trim());
  setProp('TELEGRAM_CHAT_ID', chatId.getResponseText().trim());

  ui.alert('Config saved. Run validateConfig() to verify.');
}

function validateConfig() {
  const required = ['TELEGRAM_TOKEN', 'TELEGRAM_CHAT_ID'];
  const missing = required.filter(k => !getProp(k));

  if (missing.length) {
    const msg = 'Missing config: ' + missing.join(', ') + '. Run setAllConfig().';
    logRow('Setup', 'ERROR', msg);
    throw new Error(msg);
  }

  logRow('Setup', 'OK', 'config ok');
  Logger.log('Config OK.');
}

// ── TELEGRAM HELPER ───────────────────────────────────────────────────────────

function getTelegramChatId() {
  const token = getProp('TELEGRAM_TOKEN');
  if (!token) throw new Error('Missing TELEGRAM_TOKEN — run setAllConfig() first');
  const url = CONFIG.TELEGRAM.BASE_URL + token + '/getUpdates';
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  Logger.log(res.getContentText());
}

function deleteTelegramWebhook() {
  const token = getProp('TELEGRAM_TOKEN');
  if (!token) throw new Error('Missing TELEGRAM_TOKEN — run setAllConfig() first');
  const url = CONFIG.TELEGRAM.BASE_URL + token + '/deleteWebhook';
  const res = UrlFetchApp.fetch(url, { method: 'post', muteHttpExceptions: true });
  Logger.log(res.getContentText());
}

// ── TRIGGERS ──────────────────────────────────────────────────────────────────

function createDailyTrigger(hour) {
  deleteTriggers('runAll');
  const h = (hour === 0 || hour) ? hour : 8;
  ScriptApp.newTrigger('runAll')
    .timeBased()
    .everyDays(1)
    .atHour(h)
    .create();
}

function deleteTriggers(handlerName) {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (!handlerName || t.getHandlerFunction() === handlerName) {
      ScriptApp.deleteTrigger(t);
    }
  });
}
