/**
 * Token-protected Google Apps Script bridge for the ERP invoice approvals queue.
 * The ERP API is responsible for session and approvals-permission checks; this
 * bridge only accepts the server token and the server-supplied actor profile.
 */
const APPROVALS_SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('APPROVALS_SPREADSHEET_ID') || ''
const APPROVALS_SHEET_NAME = 'Согласования'
const APPROVALS_BRIDGE_TOKEN = PropertiesService.getScriptProperties().getProperty('APPROVALS_BRIDGE_TOKEN') || ''
const APPROVALS_AUDIT_SHEET_NAME = 'ERP — журнал согласований'
const APPROVALS_REQUIRED_HEADERS = [
    'Площадка',
    'Отдел',
    'Тип',
    'Счет',
    'Сумма счета',
    'Ссылка на счет',
    'Согласование руководителя',
    'Ожидает РО',
    'Ожидает ГД',
    'Дата РО',
    'Дата ГД',
    'Отмена',
]

function doGet(e) {
    try {
        const action = e && e.parameter ? e.parameter.action : ''
        if (action !== 'queue') throw new Error('unknown_action')
        const actor = actorFromParameters_(e.parameter)
        return jsonResponse_({ok: true, rows: approvalQueue_(e.parameter.token || '', actor)})
    } catch (error) {
        return jsonResponse_({ok: false, error: String(error.message || error)})
    }
}

function doPost(e) {
    try {
        const payload = JSON.parse(e && e.postData && e.postData.contents ? e.postData.contents : '{}')
        if (payload.action !== 'decide') throw new Error('unknown_action')
        const actor = actorFromPayload_(payload.actor)
        const result = approvalDecision_(payload.token || '', actor, payload.rowNumber, payload.decision)
        return jsonResponse_({ok: true, status: result.status})
    } catch (error) {
        return jsonResponse_({ok: false, error: String(error.message || error)})
    }
}

function approvalQueue_(token, actor) {
    assertApprovalsToken_(token)
    const sheet = approvalsSheet_()
    const context = approvalRows_(sheet)
    return context.rows
        .filter(row => {
            const valid = approvalRowIsValid_(row, context.header)
            if (!valid) console.warn('approvals_malformed_row', row.rowNumber)
            return valid
        })
        .filter(row => approvalVisibleForActor_(row, context.header, actor))
        .map(row => approvalDto_(row, context.header, actor))
}

function approvalDecision_(token, actor, rowNumber, action) {
    assertApprovalsToken_(token)
    if (!Number.isInteger(Number(rowNumber)) || Number(rowNumber) <= 1) throw new Error('invalid_row')
    const approved = action === 'approve'
    if (!approved && action !== 'reject') throw new Error('invalid_action')

    const lock = LockService.getScriptLock()
    lock.waitLock(10000)
    try {
        const context = readApprovalRow_(Number(rowNumber))
        const row = context.row
        const header = context.header
        const targetColumn = action === 'reject' ? 'Отмена' : (isDirector_(actor.position) ? 'Дата ГД' : 'Дата РО')

        const visible = approvalVisibleForActor_(row, header, actor)
        if (!approvalActorResponsible_(row, header, actor)) throw new Error('not_available')
        if (!approvalRowIsValid_(row, header)) throw new Error('malformed_row')
        if (action === 'reject' && (cellText_(row.values[header[normalizeCell_('Дата РО')]]) || cellText_(row.values[header[normalizeCell_('Дата ГД')]]))) throw new Error('conflict')
        if (action === 'approve' && cellText_(row.values[header[normalizeCell_('Отмена')]])) throw new Error('conflict')
        if (!visible && !cellText_(row.values[header[normalizeCell_(targetColumn)]])) throw new Error('not_available')
        if (cellText_(row.values[header[normalizeCell_(targetColumn)]])) {
            return {status: 'already_processed'}
        }

        context.sheet.getRange(Number(rowNumber), header[normalizeCell_(targetColumn)] + 1).setValue(new Date())
        appendApprovalAudit_(actor, Number(rowNumber), action)
        return {status: action === 'reject' ? 'rejected' : 'approved'}
    } finally {
        lock.releaseLock()
    }
}

function approvalsSheet_() {
    if (!APPROVALS_SPREADSHEET_ID) throw new Error('approvals_source_unconfigured')
    const sheet = SpreadsheetApp.openById(APPROVALS_SPREADSHEET_ID).getSheetByName(APPROVALS_SHEET_NAME)
    if (!sheet) throw new Error('approvals_sheet_missing')
    return sheet
}

function approvalRows_(sheet) {
    const values = sheet.getDataRange().getDisplayValues()
    if (!values.length) throw new Error('approvals_headers_missing')
    const names = values[0].map(normalizeCell_)
    const header = {}
    names.forEach((name, index) => { if (name) header[name] = index })
    APPROVALS_REQUIRED_HEADERS.forEach(name => {
        if (header[normalizeCell_(name)] === undefined) throw new Error('approvals_column_missing')
    })
    const rows = []
    for (let index = 1; index < values.length; index += 1) {
        rows.push({rowNumber: index + 1, values: values[index]})
    }
    return {header: header, rows: rows}
}

function readApprovalRow_(rowNumber) {
    const sheet = approvalsSheet_()
    const context = approvalRows_(sheet)
    const found = context.rows.filter(row => row.rowNumber === rowNumber)[0]
    if (!found) throw new Error('row_not_found')
    return {sheet: sheet, header: context.header, row: found}
}

function approvalActorStageMatches_(row, header, actor) {
    if (!actor || !normalizeCell_(actor.fio) || !normalizeCell_(actor.position)) return false
    const fio = normalizePerson_(actor.fio)
    if (isDirector_(actor.position)) {
        return cellText_(row.values[header[normalizeCell_('Ожидает ГД')]]) !== ''
    }
    return normalizePerson_(row.values[header[normalizeCell_('Согласование руководителя')]]) === fio
        && cellText_(row.values[header[normalizeCell_('Ожидает РО')]]) !== ''
}

function approvalActorResponsible_(row, header, actor) {
    if (!actor || !normalizeCell_(actor.fio) || !normalizeCell_(actor.position)) return false
    if (isDirector_(actor.position)) return true
    return normalizePerson_(row.values[header[normalizeCell_('Согласование руководителя')]]) === normalizePerson_(actor.fio)
}

function approvalVisibleForActor_(row, header, actor) {
    return !cellText_(row.values[header[normalizeCell_('Отмена')]]) && approvalActorStageMatches_(row, header, actor)
}

function approvalDto_(row, header, actor) {
    const value = name => row.values[header[normalizeCell_(name)]]
    return {
        rowNumber: row.rowNumber,
        stage: isDirector_(actor.position) ? 'director' : 'manager',
        site: cellText_(value('Площадка')),
        departmentType: [cellText_(value('Отдел')), cellText_(value('Тип'))].filter(Boolean).join(' '),
        invoice: cellText_(value('Счет')),
        amount: approvalAmount_(value('Сумма счета')),
        invoiceUrl: cellText_(value('Ссылка на счет')),
    }
}

function approvalAmount_(value) {
    const normalized = cellText_(value)
        .replace(/[^\d,.-]/g, '')
        .replace(/\.(?=\d{3}(?:\D|$))/g, '')
        .replace(',', '.')
    if (!normalized || normalized === '-' || normalized === '.' || normalized === '-.') return null
    const amount = Number(normalized)
    return Number.isFinite(amount) ? amount : null
}

function approvalRowIsValid_(row, header) {
    const value = name => cellText_(row.values[header[normalizeCell_(name)]])
    const amount = approvalAmount_(value('Сумма счета'))
    const validUrl = /^https:\/\/[^\s/$.?#].[^\s]*$/i.test(value('Ссылка на счет'))
    if (value('Площадка') && value('Отдел') && value('Тип') && value('Счет') && amount !== null && validUrl) return true
    return false
}

function appendApprovalAudit_(actor, rowNumber, action) {
    const spreadsheet = SpreadsheetApp.openById(APPROVALS_SPREADSHEET_ID)
    const sheet = spreadsheet.getSheetByName(APPROVALS_AUDIT_SHEET_NAME) || spreadsheet.insertSheet(APPROVALS_AUDIT_SHEET_NAME)
    if (sheet.getLastRow() === 0) sheet.appendRow(['Время', 'Действие', 'ФИО', 'Должность', 'Строка'])
    sheet.appendRow([new Date(), action, cellText_(actor.fio), cellText_(actor.position), rowNumber])
}

function assertApprovalsToken_(token) {
    if (!APPROVALS_BRIDGE_TOKEN || token !== APPROVALS_BRIDGE_TOKEN) throw new Error('forbidden')
}

function isDirector_(position) {
    return normalizeCell_(position) === normalizeCell_('Генеральный директор')
}

function actorFromParameters_(parameters) {
    return {fio: parameters.fio || '', position: parameters.position || ''}
}

function actorFromPayload_(actor) {
    return {fio: actor && actor.fio || '', position: actor && actor.position || ''}
}

function normalizePerson_(value) {
    return normalizeCell_(value)
}

function normalizeCell_(value) {
    return String(value === undefined || value === null ? '' : value).replace(/[\s\u00A0]+/g, ' ').trim().toLowerCase()
}

function cellText_(value) {
    return String(value === undefined || value === null ? '' : value).trim()
}

function jsonResponse_(payload) {
    return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON)
}

/**
 * Staging-only helper: append a fresh approval row so open ERP clients can
 * detect a new invoice and fire in-app/native notifications on the next poll.
 * Run manually via clasp: stagingAppendTestNotificationRows()
 */
function stagingAppendTestNotificationRows() {
    const sheet = approvalsSheet_()
    const context = approvalRows_(sheet)
    const header = context.header
    const invoiceColumn = header[normalizeCell_('Счет')]
    if (invoiceColumn === undefined) throw new Error('approvals_column_missing')

    const template = context.rows.filter(row =>
        cellText_(row.values[invoiceColumn]) === 'ERP-TEST-NOTIFY-ALL-20260829',
    )[0] || context.rows.filter(row => approvalRowIsValid_(row, header)).slice(-1)[0]

    if (!template) throw new Error('template_row_missing')

    const suffix = Utilities.formatDate(new Date(), 'Europe/Moscow', 'yyyyMMdd-HHmmss')
    const invoice = `ERP-TEST-PUSH-${suffix}`
    const row = template.values.slice()
    row[invoiceColumn] = invoice

    const dateManagerColumn = header[normalizeCell_('Дата РО')]
    const dateDirectorColumn = header[normalizeCell_('Дата ГД')]
    const cancelledColumn = header[normalizeCell_('Отмена')]
    if (dateManagerColumn !== undefined) row[dateManagerColumn] = ''
    if (dateDirectorColumn !== undefined) row[dateDirectorColumn] = ''
    if (cancelledColumn !== undefined) row[cancelledColumn] = ''

    sheet.appendRow(row)
    return {ok: true, invoice: invoice, rowNumber: sheet.getLastRow(), templateRowNumber: template.rowNumber}
}
