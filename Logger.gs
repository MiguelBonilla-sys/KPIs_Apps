function logRow(process, status, detail) {
  try {
    const sheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEETS.LOGS);
    if (!sheet) return;
    sheet.appendRow([new Date(), process, status, detail]);
  } catch (err) {
    Logger.log(String(err));
  }
}
