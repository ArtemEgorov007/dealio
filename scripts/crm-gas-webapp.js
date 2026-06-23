/**
 * CRM «Ведомости» — отдельный Web App для выдачи бирок.
 * Бота FindTagMFT не трогает — свой Apps Script проект, своя деплойка.
 *
 * 1. Extensions → Apps Script в таблице:
 *    https://docs.google.com/spreadsheets/d/1HDj9ng5OdbgohhzdeP9LGVA-Fs_WI93m5IDWDdTXR-U/
 * 2. Вставить этот файл, Deploy → New deployment → Web app
 * 3. Execute as: Me · Who has access: Anyone
 * 4. URL → NUXT_PUBLIC_CRM_GAS_URL
 *
 * GET ?action=badges&workshop=kolpino|volkhonka
 * GET ?action=issuedToday&fio=...&workshop=kolpino|volkhonka (workshop опционален)
 * POST { action: 'issueBadge', workshop, fio, badgeContent }
 * POST { action: 'deleteIssuedBadge', row, fio, badgeContent }
 * POST { action: 'recordPacking', workshop, qrText }
 */
const SPREADSHEET_ID = '1HDj9ng5OdbgohhzdeP9LGVA-Fs_WI93m5IDWDdTXR-U'
const ISSUE_SHEET = 'Выдача'
const JOURNAL_SHEET = 'Журнал выдачи бирок'
const LOGIST_SHEET = 'Логисты'

// Имя цеха = имя колонки на листе «Выдача» = имя исходного листа с бирками.
const WORKSHOP_SHEETS = {
    kolpino: 'Колпино',
    volkhonka: 'Волхонка',
}

function doGet(e) {
    try {
        const action = e.parameter.action

        if (action === 'badges') {
            const badges = getWorkshopBadges_(e.parameter.workshop)
            return jsonResponse_({ok: true, badges: badges})
        }

        if (action === 'issueBadge') {
            issueBadge_(e.parameter.workshop, e.parameter.fio || '', e.parameter.badgeContent || '')
            return jsonResponse_({ok: true})
        }

        if (action === 'issuedToday') {
            const entries = getIssuedBadgesToday_(e.parameter.fio || '', e.parameter.workshop || '')
            return jsonResponse_({ok: true, entries: entries})
        }

        return jsonResponse_({ok: false, error: 'Unknown action'})
    } catch (error) {
        return jsonResponse_({ok: false, error: String(error.message || error)})
    }
}

function doPost(e) {
    try {
        const payload = JSON.parse(e.postData.contents)

        if (payload.action === 'issueBadge') {
            issueBadge_(payload.workshop, payload.fio || '', payload.badgeContent || '')
            return jsonResponse_({ok: true})
        }

        if (payload.action === 'deleteIssuedBadge') {
            deleteIssuedBadge_(payload.row, payload.fio || '', payload.badgeContent || '')
            return jsonResponse_({ok: true})
        }

        if (payload.action === 'recordPacking') {
            recordPacking_(payload.workshop, payload.qrText || '')
            return jsonResponse_({ok: true})
        }

        return jsonResponse_({ok: false, error: 'Unknown action'})
    } catch (error) {
        return jsonResponse_({ok: false, error: String(error.message || error)})
    }
}

function getSpreadsheet_() {
    return SpreadsheetApp.openById(SPREADSHEET_ID)
}

function getWorkshopSheetName_(workshop) {
    const sheetName = WORKSHOP_SHEETS[workshop]
    if (!sheetName) {
        throw new Error('Unknown workshop: ' + workshop)
    }
    return sheetName
}

function getWorkshopBadges_(workshop) {
    const columnName = getWorkshopSheetName_(workshop)

    const sheet = getSpreadsheet_().getSheetByName(ISSUE_SHEET)
    if (!sheet) {
        throw new Error('Sheet not found: ' + ISSUE_SHEET)
    }

    const values = sheet.getDataRange().getValues()
    if (!values.length) return []

    const header = values[0].map(normalizeCell_)
    const columnIndex = header.indexOf(normalizeCell_(columnName))

    if (columnIndex < 0) {
        throw new Error('Column not found: ' + columnName)
    }

    const badges = []

    for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
        const value = normalizeCell_(values[rowIndex][columnIndex])
        if (value) badges.push(value)
    }

    return badges
}

/**
 * Пишет строку в журнал. По прямому указанию заказчика — больше НЕ
 * трогает листы цехов (Колпино/Волхонка), только «Журнал выдачи бирок».
 * Бирка из листа «Выдача» сама после этого не пропадает.
 */
function issueBadge_(workshop, fio, badgeContent) {
    const lock = LockService.getScriptLock()
    if (!lock.tryLock(5000)) {
        throw new Error('busy')
    }

    try {
        const workshopLabel = getWorkshopSheetName_(workshop)
        appendJournalRow_(fio, badgeContent, workshopLabel)
    } finally {
        lock.releaseLock()
    }
}

function appendJournalRow_(fio, badgeContent, workshopLabel) {
    const sheet = getSpreadsheet_().getSheetByName(JOURNAL_SHEET)
    if (!sheet) {
        throw new Error('Sheet not found: ' + JOURNAL_SHEET)
    }

    const now = new Date()
    // A=День, B=Инженер, C=Проект, D=Раздел, E=Марка, F=Бирка, G=Дата, H=С индексом, I=Цех
    sheet.appendRow([now, fio, '', '', '', badgeContent, now, '', workshopLabel])

    // appendRow не наследует формат столбца G у новых строк — без этого
    // дата приходит со временем вместо "21.06.2026" как у остальных строк.
    sheet.getRange(sheet.getLastRow(), 7).setNumberFormat('dd.mm.yyyy')
}

/**
 * Бирки, выданные сотрудником сегодня — для экрана «Бирки за смену».
 * workshop опционален: без него отдаёт бирки по всем цехам.
 */
function getIssuedBadgesToday_(fio, workshop) {
    const sheet = getSpreadsheet_().getSheetByName(JOURNAL_SHEET)
    if (!sheet) {
        throw new Error('Sheet not found: ' + JOURNAL_SHEET)
    }

    const workshopLabelFilter = workshop ? getWorkshopSheetName_(workshop) : ''
    const fioNormalized = normalizeCell_(fio)
    const todayKey = formatDateKey_(new Date())

    const values = sheet.getDataRange().getValues()
    const entries = []

    for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
        const row = values[rowIndex]
        const rowDate = row[0]

        if (normalizeCell_(row[1]) !== fioNormalized) continue
        if (workshopLabelFilter && normalizeCell_(row[8]) !== workshopLabelFilter) continue
        if (!(rowDate instanceof Date) || formatDateKey_(rowDate) !== todayKey) continue

        entries.push({
            row: rowIndex + 1,
            badge: normalizeCell_(row[5]),
            time: Utilities.formatDate(rowDate, Session.getScriptTimeZone(), 'HH:mm'),
        })
    }

    return entries
}

/**
 * Удаляет выданную бирку из журнала — кнопка-крестик на экране «Бирки за смену».
 * row пришёл с фронта вместе со списком; fio/badgeContent — проверка,
 * что строка не сдвинулась и удаляем именно то, что показывали сотруднику.
 */
function deleteIssuedBadge_(row, fio, badgeContent) {
    const rowNumber = Number(row)

    const lock = LockService.getScriptLock()
    if (!lock.tryLock(5000)) {
        throw new Error('busy')
    }

    try {
        const sheet = getSpreadsheet_().getSheetByName(JOURNAL_SHEET)
        if (!sheet) {
            throw new Error('Sheet not found: ' + JOURNAL_SHEET)
        }

        if (!rowNumber || rowNumber < 2 || rowNumber > sheet.getLastRow()) {
            throw new Error('Строка не найдена — обновите список и попробуйте снова')
        }

        const rowValues = sheet.getRange(rowNumber, 1, 1, 9).getValues()[0]
        const rowMatches = normalizeCell_(rowValues[1]) === normalizeCell_(fio)
            && normalizeCell_(rowValues[5]) === normalizeCell_(badgeContent)

        if (!rowMatches) {
            throw new Error('Строка изменилась — обновите список и попробуйте снова')
        }

        sheet.deleteRow(rowNumber)
    } finally {
        lock.releaseLock()
    }
}

/**
 * Записывает считанный QR упаковки на лист «Логисты». Лист создаётся
 * автоматически при первом вызове, если его ещё нет в таблице.
 */
function recordPacking_(workshop, qrText) {
    const lock = LockService.getScriptLock()
    if (!lock.tryLock(5000)) {
        throw new Error('busy')
    }

    try {
        const workshopLabel = getWorkshopSheetName_(workshop)
        appendLogistRow_(workshopLabel, qrText)
    } finally {
        lock.releaseLock()
    }
}

/**
 * Лист «Логисты» — заполняем только Дата/Цех/Бирка, остальные столбцы
 * (ФИО, Накладная, Вес и т.п.) трогаем не трогаем. Ищем нужные столбцы
 * по заголовку, а не по фиксированному индексу — на листе уже есть
 * своя схема с дополнительными колонками.
 */
function appendLogistRow_(workshopLabel, qrText) {
    const sheet = getOrCreateLogistSheet_()
    const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(normalizeCell_)

    const dateIndex = header.indexOf('Дата')
    const workshopIndex = header.indexOf('Цех')
    const badgeIndex = header.indexOf('Бирка')

    if (dateIndex < 0 || workshopIndex < 0 || badgeIndex < 0) {
        throw new Error('Не найдены столбцы Дата/Цех/Бирка на листе «' + LOGIST_SHEET + '»')
    }

    const row = new Array(header.length).fill('')
    row[dateIndex] = new Date()
    row[workshopIndex] = workshopLabel
    row[badgeIndex] = qrText

    // Явный setNumberFormat здесь конфликтует с уже настроенным форматом
    // столбца «Дата» на этом листе (готовая ошибка Sheets API при flush) —
    // не трогаем формат, ячейка наследует то, что уже задано на колонке.
    sheet.appendRow(row)
}

function getOrCreateLogistSheet_() {
    const spreadsheet = getSpreadsheet_()
    let sheet = spreadsheet.getSheetByName(LOGIST_SHEET)

    if (!sheet) {
        sheet = spreadsheet.insertSheet(LOGIST_SHEET)
        sheet.appendRow(['Дата', 'Цех', 'ФИО', 'Накладная', 'Бирка', 'Вес'])
    }

    return sheet
}

function formatDateKey_(date) {
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd')
}

function normalizeCell_(value) {
    return String(value == null ? '' : value).trim()
}

function jsonResponse_(payload) {
    return ContentService
        .createTextOutput(JSON.stringify(payload))
        .setMimeType(ContentService.MimeType.JSON)
}
