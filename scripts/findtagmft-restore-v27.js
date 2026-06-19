/**
 * FindTagMFT — оригинал версии 27 (12 мая 2026).
 * Только для восстановления бота/Telegram. CRM сюда НЕ добавлять.
 *
 * Восстановление:
 * 1. Открыть FindTagMFT → Code.gs
 * 2. Заменить всё содержимое этим файлом
 * 3. Удалить лишние файлы (Cursor.gs и т.п.), оставить Code.gs + Front-end.html
 * 4. Развернуть → Управление развертываниями → основное → Новая версия
 */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Front-end');
}


// =======================
// ПОИСК БИРОК (ОПТИМИЗИРОВАННЫЙ БЕЗ SLEEP)
// =======================
function searchTag(sheetName, tagInput) {

  const allowedSheets = [
    "Волхонка",
    "Колпино",
    "Колпино2",
    "ЛимакБирки",
    "Сибсталь"
  ];

  if (!allowedSheets.includes(sheetName)) {
    return { success: false, message: "Недопустимый лист" };
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    return { success: false, message: "Лист не найден" };
  }

  const query = String(tagInput).toLowerCase().trim();

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return { success: false, message: "Лист пуст" };
  }

  // 🔥 читаем только реальные данные (A:C)
  const data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();

  const result = [];

  for (let i = 0; i < data.length; i++) {

    const tag = data[i][0];   // A
    const date = data[i][2];  // C

    if (!tag) continue;

    // фильтр: уже выдано
    if (date && String(date).trim() !== "") continue;

    if (String(tag).toLowerCase().includes(query)) {
      result.push(String(tag));
    }
  }

  return {
    success: true,
    tags: result
  };
}


// =======================
// ЛОГИРОВАНИЕ ВЫДАЧИ БИРОК
// =======================
function logTagIssue(tag, sheetName) {

  const lock = LockService.getScriptLock();

  if (!lock.tryLock(3000)) {
    return { success: false, message: "busy" };
  }

  try {

    const sheet = SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName("Журнал выдачи бирок");

    if (!sheet) {
      return { success: false, message: "no_log_sheet" };
    }

    sheet.appendRow([
      "",        // A
      "",        // B
      "",        // C
      "",        // D
      "",        // E
      tag,       // F
      new Date(),// G
      "",        // H
      sheetName  // I
    ]);

    return { success: true };

  } finally {
    lock.releaseLock();
  }
}
