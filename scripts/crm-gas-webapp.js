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
 * POST { action: 'issueBadge', workshop, fio, badgeContent }
 */
const SPREADSHEET_ID = '1HDj9ng5OdbgohhzdeP9LGVA-Fs_WI93m5IDWDdTXR-U'
const ISSUE_SHEET = 'Выдача'
const JOURNAL_SHEET = 'Журнал выдачи бирок'

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
 * Помечает бирку выданной (ставит дату в колонку C исходного листа цеха —
 * по этому полю бот и лист «Выдача» отличают невыданные бирки) и пишет
 * строку в общий журнал бота тем же набором колонок, что и сам бот.
 */
function issueBadge_(workshop, fio, badgeContent) {
    const lock = LockService.getScriptLock()
    if (!lock.tryLock(5000)) {
        throw new Error('busy')
    }

    try {
        const workshopLabel = markBadgeIssued_(workshop, badgeContent)
        appendJournalRow_(fio, badgeContent, workshopLabel)
    } finally {
        lock.releaseLock()
    }
}

function markBadgeIssued_(workshop, badgeContent) {
    const sheetName = getWorkshopSheetName_(workshop)
    const sheet = getSpreadsheet_().getSheetByName(sheetName)
    if (!sheet) {
        throw new Error('Sheet not found: ' + sheetName)
    }

    const lastRow = sheet.getLastRow()
    if (lastRow < 1) {
        throw new Error('Бирка не найдена: ' + badgeContent)
    }

    const tags = sheet.getRange(1, 1, lastRow, 1).getValues()
    const fullTarget = normalizeCell_(badgeContent)
    const tagTarget = extractBadgeTag_(badgeContent)

    for (let rowIndex = 0; rowIndex < tags.length; rowIndex += 1) {
        const cell = normalizeCell_(tags[rowIndex][0])
        if (!cell) continue

        if (cell === fullTarget || cell === tagTarget) {
            sheet.getRange(rowIndex + 1, 3).setValue(new Date())
            return sheetName
        }
    }

    throw new Error('Бирка не найдена: ' + tagTarget)
}

function extractBadgeTag_(badgeContent) {
    return normalizeCell_(badgeContent).split(/\n/)[0]
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

function normalizeCell_(value) {
    return String(value == null ? '' : value).trim()
}

function jsonResponse_(payload) {
    return ContentService
        .createTextOutput(JSON.stringify(payload))
        .setMimeType(ContentService.MimeType.JSON)
}
