function callTelegramApi(method, payload) {
  const token = getProp('TELEGRAM_TOKEN');
  if (!token) {
    logRow('Telegram', 'WARN', 'missing token');
    return { ok: false, error: 'missing token' };
  }

  const url = CONFIG.TELEGRAM.BASE_URL + token + '/' + method;

  for (let i = 0; i < CONFIG.TELEGRAM.MAX_RETRIES; i++) {
    try {
      const res = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload || {}),
        muteHttpExceptions: true
      });
      const code = res.getResponseCode();
      const body = res.getContentText();
      if (code >= 200 && code < 300) return JSON.parse(body);
      logRow('Telegram', 'WARN', 'api failed code=' + code + ' body=' + truncate(body, 200));
    } catch (err) {
      logRow('Telegram', 'ERROR', String(err));
    }
    Utilities.sleep(CONFIG.TELEGRAM.RETRY_MS);
  }

  return { ok: false, error: 'request failed after ' + CONFIG.TELEGRAM.MAX_RETRIES + ' retries' };
}

function sendTelegramMessage(text) {
  const chatId = getProp('TELEGRAM_CHAT_ID');
  if (!chatId) {
    logRow('Telegram', 'WARN', 'missing chat_id');
    return false;
  }

  const safeText = toStr(text);
  if (!safeText) return false;

  const res = callTelegramApi('sendMessage', {
    chat_id: chatId,
    text: safeText,
    parse_mode: 'HTML'
  });
  if (res.ok) return true;

  // Fallback: retry without HTML if parse_mode caused the error
  const plain = safeText.replace(/<[^>]+>/g, '');
  const fallback = callTelegramApi('sendMessage', { chat_id: chatId, text: plain });
  return !!fallback.ok;
}
