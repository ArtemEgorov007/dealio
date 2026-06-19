/**
 * Google Apps Script для листа «Журнал выдачи бирок».
 * Deploy → Web app → Anyone can access → скопировать URL в NUXT_PUBLIC_CRM_GAS_URL
 */
function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  const sheetName = payload.sheet || 'Журнал выдачи бирок';
  const row = payload.row || [];

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      error: 'Sheet not found: ' + sheetName,
    })).setMimeType(ContentService.MimeType.JSON);
  }

  sheet.appendRow(row);

  return ContentService.createTextOutput(JSON.stringify({ok: true}))
      .setMimeType(ContentService.MimeType.JSON);
}
