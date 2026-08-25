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
 * GET  ?action=badges&workshop=kolpino|volkhonka
 * GET  ?action=issuedToday&fio=...&workshop=kolpino|volkhonka  (fio/workshop опциональны)
 * GET  ?action=handedOverToday&fio=...                            (fio опционален)
 * GET  ?action=packingToday&fio=...&machine=1..10
 * POST { action: 'issueBadge',       workshop, fio, badgeContent }
 * POST { action: 'deleteIssuedBadge', row, fio, badgeContent }
 * POST { action: 'recordPacking',    platform, fio, machine, qrText }
 * POST { action: 'recordHandover',   fio, badgeContent }
 * POST { action: 'undoHandover',     row, fio, badgeContent }
 * POST { action: 'recordMeasurement', fio, badge, coverage, zone1..zone5 }
 * POST { action: 'login',            login, password }
 */
// Script Property SPREADSHEET_ID переопределяет дефолт — используется для staging-копии
// таблицы, прод-деплой не задаёт это свойство и продолжает работать с дефолтом как раньше.
const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')
    || '1HDj9ng5OdbgohhzdeP9LGVA-Fs_WI93m5IDWDdTXR-U'
const ISSUE_SHEET = 'Выдача'
const JOURNAL_SHEET = 'Журнал выдачи бирок'
const LOGIST_SHEET = 'Логисты'
const HANDOVER_SHEET = 'Сдача'
const MEASUREMENT_SHEET = 'Промеры'

// Имя цеха = имя колонки на листе «Выдача» = имя исходного листа с бирками.
const WORKSHOP_SHEETS = {
    kolpino: 'Колпино',
    volkhonka: 'Волхонка',
}

// Отдельная таблица доступа сотрудников (логины/пароли/статусы) — НЕ «Ведомости».
// Script Property ACCESS_SPREADSHEET_ID переопределяет дефолт по той же схеме, что и SPREADSHEET_ID.
const ACCESS_SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('ACCESS_SPREADSHEET_ID')
    || '12TAfi2p6hMBG_MnP4LEROnZ6BaJp0bTFHd93jq06Qz8'
const STAFF_SHEET = 'Сотрудники'
const ACTIVE_STATUS = 'Работает'

function doGet(e) {
    try {
        const action = e.parameter.action

        if (action === 'badges') {
            const badges = getWorkshopBadges_(e.parameter.workshop)
            return jsonResponse_({ok: true, badges: badges})
        }

        if (action === 'issuedToday') {
            const entries = getIssuedBadgesToday_(e.parameter.fio || '', e.parameter.workshop || '')
            return jsonResponse_({ok: true, entries: entries})
        }

        if (action === 'handedOverToday') {
            const entries = getHandedOverBadgesToday_(e.parameter.fio || '')
            return jsonResponse_({ok: true, entries: entries})
        }

        if (action === 'packingToday') {
            const entries = getPackingToday_(e.parameter.fio || '', e.parameter.machine || '')
            return jsonResponse_({ok: true, packingEntries: entries})
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
            recordPacking_(payload.platform || '', payload.fio || '', payload.machine || '', payload.qrText || '')
            return jsonResponse_({ok: true})
        }

        if (payload.action === 'recordHandover') {
            recordHandover_(payload.fio || '', payload.badgeContent || '')
            return jsonResponse_({ok: true})
        }

        if (payload.action === 'undoHandover') {
            undoHandover_(payload.row, payload.fio || '', payload.badgeContent || '')
            return jsonResponse_({ok: true})
        }

        if (payload.action === 'recordMeasurement') {
            recordMeasurement_(
                payload.fio || '',
                payload.badge || '',
                payload.coverage || '',
                payload.zone1 || '',
                payload.zone2 || '',
                payload.zone3 || '',
                payload.zone4 || '',
                payload.zone5 || '',
            )
            return jsonResponse_({ok: true})
        }

        if (payload.action === 'login') {
            const profile = login_(payload.login || '', payload.password || '')
            return jsonResponse_({
                ok: true,
                fio: profile.fio,
                department: profile.department,
                position: profile.position,
                platform: profile.platform,
                role: profile.role,
                login: profile.login,
                password: profile.password,
                access: profile.access,
            })
        }

        if (payload.action === 'personnelDepartments') {
            const context = requirePersonnelActor_(payload.actorLogin || '', payload.actorPassword || '')
            return jsonResponse_({
                ok: true,
                departments: personnelDepartments_(context),
                platforms: personnelPlatforms_(),
                rights: personnelRights_(context),
            })
        }

        if (payload.action === 'personnelEmployees') {
            const context = requirePersonnelActor_(payload.actorLogin || '', payload.actorPassword || '')
            return jsonResponse_({
                ok: true,
                employees: personnelEmployees_(context, payload.department || ''),
            })
        }

        if (payload.action === 'personnelEmployee') {
            const context = requirePersonnelActor_(payload.actorLogin || '', payload.actorPassword || '')
            return jsonResponse_({
                ok: true,
                employee: personnelEmployee_(context, payload.row, payload.fio || ''),
            })
        }

        if (payload.action === 'personnelSave') {
            const context = requirePersonnelActor_(payload.actorLogin || '', payload.actorPassword || '')
            return jsonResponse_({ok: true, employee: savePersonnelEmployee_(context, payload)})
        }

        if (payload.action === 'personnelCreate') {
            const context = requirePersonnelActor_(payload.actorLogin || '', payload.actorPassword || '')
            return jsonResponse_({ok: true, employee: createPersonnelEmployee_(context, payload)})
        }

        if (payload.action === 'personnelDismiss') {
            const context = requirePersonnelActor_(payload.actorLogin || '', payload.actorPassword || '')
            dismissPersonnelEmployee_(context, payload.row, payload.fio || '')
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
 *
 * Заказчик переставил/переименовал столбцы на «Журнал выдачи бирок» —
 * пишем по заголовку, а не по фиксированному индексу. Заполняем только
 * День (дата+время), Дата (только дата), Цех, Инженер, Бирка — остальные
 * столбцы не трогаем.
 */
function issueBadge_(workshop, fio, badgeContent) {
    const workshopLabel = getWorkshopSheetName_(workshop)
    const sheet = getJournalSheet_()
    const header = getSheetHeader_(sheet)

    const dayIndex = requireColumn_(header, 'День', JOURNAL_SHEET)
    const dateIndex = requireColumn_(header, 'Дата', JOURNAL_SHEET)
    const workshopIndex = requireColumn_(header, 'Цех', JOURNAL_SHEET)
    const engineerIndex = requireColumn_(header, 'Инженер', JOURNAL_SHEET)
    const badgeIndex = requireColumn_(header, 'Бирка', JOURNAL_SHEET)

    const now = new Date()
    const row = new Array(header.length).fill('')
    row[dayIndex] = now
    row[dateIndex] = now
    row[workshopIndex] = workshopLabel
    row[engineerIndex] = fio
    row[badgeIndex] = badgeContent

    const lock = LockService.getScriptLock()
    if (!lock.tryLock(5000)) {
        throw new Error('busy')
    }

    try {
        sheet.appendRow(row)
    } finally {
        lock.releaseLock()
    }
}

/**
 * Бирки, выданные сегодня — для экрана «Бирки за смену».
 * fio опционален для счётчика менеджера; workshop — для списка цеха.
 */
function getIssuedBadgesToday_(fio, workshop) {
    const sheet = getJournalSheet_()
    const header = getSheetHeader_(sheet)

    const dayIndex = requireColumn_(header, 'День', JOURNAL_SHEET)
    const workshopIndex = requireColumn_(header, 'Цех', JOURNAL_SHEET)
    const engineerIndex = requireColumn_(header, 'Инженер', JOURNAL_SHEET)
    const badgeIndex = requireColumn_(header, 'Бирка', JOURNAL_SHEET)

    const workshopLabelFilter = workshop ? getWorkshopSheetName_(workshop) : ''
    const fioNormalized = normalizeCell_(fio)
    const todayKey = formatDateKey_(new Date())

    const values = sheet.getDataRange().getValues()
    const entries = []

    for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
        const row = values[rowIndex]
        const rowDate = row[dayIndex]

        if (fioNormalized && normalizeCell_(row[engineerIndex]) !== fioNormalized) continue
        if (workshopLabelFilter && normalizeCell_(row[workshopIndex]) !== workshopLabelFilter) continue
        if (!(rowDate instanceof Date) || formatDateKey_(rowDate) !== todayKey) continue

        entries.push({
            row: rowIndex + 1,
            badge: normalizeCell_(row[badgeIndex]),
            time: Utilities.formatDate(rowDate, Session.getScriptTimeZone(), 'HH:mm'),
        })
    }

    return entries
}

/**
 * Удаляет выданную бирку из журнала — кнопка-крестик на экране «Бирки за смену».
 */
function deleteIssuedBadge_(row, fio, badgeContent) {
    const rowNumber = Number(row)
    const sheet = getJournalSheet_()
    const header = getSheetHeader_(sheet)
    const engineerIndex = requireColumn_(header, 'Инженер', JOURNAL_SHEET)
    const badgeIndex = requireColumn_(header, 'Бирка', JOURNAL_SHEET)

    const lock = LockService.getScriptLock()
    if (!lock.tryLock(5000)) {
        throw new Error('busy')
    }

    try {
        if (!rowNumber || rowNumber < 2 || rowNumber > sheet.getLastRow()) {
            throw new Error('Строка не найдена — обновите список и попробуйте снова')
        }

        const rowValues = sheet.getRange(rowNumber, 1, 1, header.length).getValues()[0]
        const rowMatches = normalizeCell_(rowValues[engineerIndex]) === normalizeCell_(fio)
            && normalizeCell_(rowValues[badgeIndex]) === normalizeCell_(badgeContent)

        if (!rowMatches) {
            throw new Error('Строка изменилась — обновите список и попробуйте снова')
        }

        sheet.deleteRow(rowNumber)
    } finally {
        lock.releaseLock()
    }
}

/**
 * Сдача работ — создаёт новую строку в листе «Сдача».
 * Столбцы: Дата, Инженер, Бирка.
 */
function recordHandover_(fio, badgeContent) {
    const sheet = getOrCreateHandoverSheet_()
    const header = getSheetHeader_(sheet)

    const dateIndex = requireColumn_(header, 'Дата', HANDOVER_SHEET)
    const engineerIndex = requireColumn_(header, 'Инженер', HANDOVER_SHEET)
    const badgeIndex = requireColumn_(header, 'Бирка', HANDOVER_SHEET)

    const row = new Array(header.length).fill('')
    row[dateIndex] = new Date()
    row[engineerIndex] = fio
    row[badgeIndex] = badgeContent

    const lock = LockService.getScriptLock()
    if (!lock.tryLock(5000)) {
        throw new Error('busy')
    }

    try {
        assertBadgeNotRecorded_(sheet, badgeContent, HANDOVER_SHEET)
        sheet.appendRow(row)
    } finally {
        lock.releaseLock()
    }
}

/**
 * Бирки, сданные сегодня — для экрана «Сдачи». fio опционален для менеджера.
 */
function getHandedOverBadgesToday_(fio) {
    const sheet = getOrCreateHandoverSheet_()
    const header = getSheetHeader_(sheet)

    const dateIndex = requireColumn_(header, 'Дата', HANDOVER_SHEET)
    const engineerIndex = requireColumn_(header, 'Инженер', HANDOVER_SHEET)
    const badgeIndex = requireColumn_(header, 'Бирка', HANDOVER_SHEET)

    const fioNormalized = normalizeCell_(fio)
    const todayKey = formatDateKey_(new Date())

    const values = sheet.getDataRange().getValues()
    const entries = []

    for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
        const row = values[rowIndex]
        const dateVal = row[dateIndex]

        if (fioNormalized && normalizeCell_(row[engineerIndex]) !== fioNormalized) continue
        if (!(dateVal instanceof Date) || formatDateKey_(dateVal) !== todayKey) continue

        entries.push({
            row: rowIndex + 1,
            badge: normalizeCell_(row[badgeIndex]),
            time: Utilities.formatDate(dateVal, Session.getScriptTimeZone(), 'HH:mm'),
        })
    }

    return entries
}

/**
 * Отменяет сдачу — удаляет строку из листа «Сдача».
 * TOCTOU-safe: перед удалением проверяем, что строка не сдвинулась.
 */
function undoHandover_(row, fio, badgeContent) {
    const rowNumber = Number(row)
    const sheet = getOrCreateHandoverSheet_()
    const header = getSheetHeader_(sheet)
    const engineerIndex = requireColumn_(header, 'Инженер', HANDOVER_SHEET)
    const badgeIndex = requireColumn_(header, 'Бирка', HANDOVER_SHEET)

    const lock = LockService.getScriptLock()
    if (!lock.tryLock(5000)) {
        throw new Error('busy')
    }

    try {
        if (!rowNumber || rowNumber < 2 || rowNumber > sheet.getLastRow()) {
            throw new Error('Строка не найдена — обновите список и попробуйте снова')
        }

        const rowValues = sheet.getRange(rowNumber, 1, 1, header.length).getValues()[0]
        const rowMatches = normalizeCell_(rowValues[engineerIndex]) === normalizeCell_(fio)
            && normalizeCell_(rowValues[badgeIndex]) === normalizeCell_(badgeContent)

        if (!rowMatches) {
            throw new Error('Строка изменилась — обновите список и попробуйте снова')
        }

        sheet.deleteRow(rowNumber)
    } finally {
        lock.releaseLock()
    }
}

/**
 * Записывает промер в лист «Промеры».
 * Столбцы: Дата, Бирка, Покрытие, Зона 1..5, Оценка, Контролер.
 * zone* — строки; пустая строка → оставить ячейку пустой.
 */
function recordMeasurement_(fio, badge, coverage, zone1, zone2, zone3, zone4, zone5) {
    const sheet = getOrCreateMeasurementSheet_()
    const header = getSheetHeader_(sheet)

    const dateIdx = requireColumn_(header, 'Дата', MEASUREMENT_SHEET)
    const badgeIdx = requireColumn_(header, 'Бирка', MEASUREMENT_SHEET)
    const coverageIdx = requireColumn_(header, 'Покрытие', MEASUREMENT_SHEET)
    const zone1Idx = requireColumn_(header, 'Зона 1', MEASUREMENT_SHEET)
    const zone2Idx = requireColumn_(header, 'Зона 2', MEASUREMENT_SHEET)
    const zone3Idx = requireColumn_(header, 'Зона 3', MEASUREMENT_SHEET)
    const zone4Idx = requireColumn_(header, 'Зона 4', MEASUREMENT_SHEET)
    const zone5Idx = requireColumn_(header, 'Зона 5', MEASUREMENT_SHEET)
    const ratingIdx = requireColumn_(header, 'Оценка', MEASUREMENT_SHEET)
    const controllerIdx = requireColumn_(header, 'Контролер', MEASUREMENT_SHEET)

    const toNum = (v) => {
        const s = String(v || '').trim()
        if (!s) return ''
        const n = parseInt(s, 10)
        return isNaN(n) ? '' : n
    }

    const z1 = toNum(zone1)
    const z2 = toNum(zone2)
    const z3 = toNum(zone3)
    const z4 = toNum(zone4)
    const z5 = toNum(zone5)

    // Пустые зоны не попадают в оценку — иначе «250/260//240/255» с дырами.
    const rating = coverage + ': ' + [z1, z2, z3, z4, z5].filter(function (z) { return z !== '' }).join('/')

    const row = new Array(header.length).fill('')
    row[dateIdx] = new Date()
    row[badgeIdx] = badge
    row[coverageIdx] = coverage
    row[zone1Idx] = z1
    row[zone2Idx] = z2
    row[zone3Idx] = z3
    row[zone4Idx] = z4
    row[zone5Idx] = z5
    row[ratingIdx] = rating
    row[controllerIdx] = fio

    const lock = LockService.getScriptLock()
    if (!lock.tryLock(5000)) {
        throw new Error('busy')
    }

    try {
        sheet.appendRow(row)
    } finally {
        lock.releaseLock()
    }
}

/**
 * Вход по логину/паролю — сверяем с листом «Сотрудники» в отдельной
 * таблице «Доступ к серверу». Возвращает профиль сотрудника и флаги доступа.
 *
 * Новые столбцы (Площадка, доступы) опциональны — берём indexOf, при -1
 * используем дефолт «true» для флагов доступа (показываем всё, пока
 * администратор не выставил ограничения).
 */
function login_(loginValue, password) {
    const sheet = SpreadsheetApp.openById(ACCESS_SPREADSHEET_ID).getSheetByName(STAFF_SHEET)
    if (!sheet) {
        throw new Error('Не найден лист «' + STAFF_SHEET + '»')
    }

    const header = getSheetHeader_(sheet)
    const fioIndex = requireColumn_(header, 'ФИО', STAFF_SHEET)
    const loginIndex = requireColumn_(header, 'Логин', STAFF_SHEET)
    const passwordIndex = requireColumn_(header, 'Пароль', STAFF_SHEET)
    const statusIndex = requireColumn_(header, 'Статус', STAFF_SHEET)
    const departmentIndex = requireColumn_(header, 'Отдел', STAFF_SHEET)
    const positionIndex = requireColumn_(header, 'Должность', STAFF_SHEET)

    // Столбцы доступа. Fail-closed: если столбца нет (idx < 0) или значение
    // не «Да» — доступ НЕ выдаётся (см. isYes ниже). Раньше отсутствие/опечатка
    // столбца молча открывали раздел всем сотрудникам.
    // «Доступ к сдаче» в таблице пока нет — раздел «Сдача» закрыт у всех, пока
    // столбец не добавят со значением «Да» нужным людям.
    const platformIndex = header.indexOf('Площадка')
    const roleIndex = header.indexOf('Роль')
    const accessBadgesIndex = header.indexOf('Доступ к биркам')
    const accessMeasurementsIndex = header.indexOf('Доступ к промерам')
    const accessPackingIndex = header.indexOf('Доступ к упаковкам')
    const accessHandoverIndex = header.indexOf('Доступ к сдаче')
    const accessReportsIndex = header.indexOf('Доступ к отчетам')
    // Заголовок в таблице «Доступ к серверу» — «Право согласования» (без «на»).
    // Раньше indexOf не находил → -1 → доступ по дефолту открывался всем.
    const accessApprovalsIndex = header.indexOf('Право согласования')
    const accessSupplyIndex = header.indexOf('Заказ снабжения')
    const accessOrdersIndex = header.indexOf('Работа со снабжением')
    const accessWarehouseIndex = header.indexOf('Доступ к складу')
    const accessPersonnelIndex = header.indexOf('Управление кадрами')

    const loginNormalized = normalizeCell_(loginValue).toLowerCase()
    const values = sheet.getDataRange().getValues()

    for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
        const row = values[rowIndex]
        if (normalizeCell_(row[loginIndex]).toLowerCase() !== loginNormalized) continue
        if (normalizeCell_(row[passwordIndex]) !== password) continue

        if (normalizeCell_(row[statusIndex]) !== ACTIVE_STATUS) {
            throw new Error('Учётная запись отключена — обратитесь к руководителю')
        }

        const isYes = (idx) => idx < 0 ? false : normalizeCell_(row[idx]).toLowerCase() === 'да'
        const strAt = (idx) => idx >= 0 ? normalizeCell_(row[idx]) : ''

        return {
            fio: normalizeCell_(row[fioIndex]),
            department: normalizeCell_(row[departmentIndex]),
            position: normalizeCell_(row[positionIndex]),
            platform: strAt(platformIndex),
            role: strAt(roleIndex),
            login: normalizeCell_(row[loginIndex]),
            password: normalizeCell_(row[passwordIndex]),
            access: {
                badges: isYes(accessBadgesIndex),
                measurements: isYes(accessMeasurementsIndex),
                packing: isYes(accessPackingIndex),
                handover: isYes(accessHandoverIndex),
                reports: isYes(accessReportsIndex),
                approvals: isYes(accessApprovalsIndex),
                supply: isYes(accessSupplyIndex),
                orders: isYes(accessOrdersIndex),
                warehouse: isYes(accessWarehouseIndex),
                personnel: isYes(accessPersonnelIndex),
            },
        }
    }

    throw new Error('Неверный логин или пароль')
}

function getStaffSchema_(sheet) {
    const header = getSheetHeader_(sheet)
    return {
        header: header,
        fioIndex: requireColumn_(header, 'ФИО', STAFF_SHEET),
        departmentIndex: requireColumn_(header, 'Отдел', STAFF_SHEET),
        positionIndex: requireColumn_(header, 'Должность', STAFF_SHEET),
        platformIndex: requireColumn_(header, 'Площадка', STAFF_SHEET),
        roleIndex: requireColumn_(header, 'Роль', STAFF_SHEET),
        loginIndex: requireColumn_(header, 'Логин', STAFF_SHEET),
        passwordIndex: requireColumn_(header, 'Пароль', STAFF_SHEET),
        statusIndex: requireColumn_(header, 'Статус', STAFF_SHEET),
        personnelAccessIndex: requireColumn_(header, 'Управление кадрами', STAFF_SHEET),
        rightsHeaders: header.slice(10),
    }
}

function requirePersonnelActor_(loginValue, password) {
    const sheet = SpreadsheetApp.openById(ACCESS_SPREADSHEET_ID).getSheetByName(STAFF_SHEET)
    if (!sheet) throw new Error('Не найден лист «' + STAFF_SHEET + '»')

    const schema = getStaffSchema_(sheet)
    const loginNormalized = normalizeCell_(loginValue).toLowerCase()
    const values = sheet.getDataRange().getValues()

    for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
        const row = values[rowIndex]
        if (normalizeCell_(row[schema.loginIndex]).toLowerCase() !== loginNormalized) continue
        if (normalizeCell_(row[schema.passwordIndex]) !== password) continue
        if (normalizeCell_(row[schema.statusIndex]) !== ACTIVE_STATUS) {
            throw new Error('Учётная запись отключена — обратитесь к руководителю')
        }
        if (normalizeCell_(row[schema.personnelAccessIndex]).toLowerCase() !== 'да') {
            throw new Error('Нет доступа к управлению кадрами')
        }
        return {sheet: sheet, schema: schema}
    }

    throw new Error('Неверный логин или пароль')
}

function personnelDepartments_(context) {
    const values = context.sheet.getDataRange().getValues()
    const counts = {}
    for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
        const row = values[rowIndex]
        const department = normalizeCell_(row[context.schema.departmentIndex])
        if (!department || normalizeCell_(row[context.schema.statusIndex]) !== ACTIVE_STATUS) continue
        counts[department] = (counts[department] || 0) + 1
    }
    return Object.keys(counts).map((department) => ({department: department, activeCount: counts[department]}))
}

function personnelRights_(context) {
    return context.schema.rightsHeaders.filter((name) => Boolean(name)).map((name) => ({name: name, value: 'Нет'}))
}

function personnelPlatforms_() {
    const sheet = SpreadsheetApp.openById(ACCESS_SPREADSHEET_ID).getSheetByName('Площадки')
    if (!sheet) throw new Error('Не найден лист «Площадки»')
    const values = sheet.getDataRange().getValues()
    const found = {}
    const platforms = []
    for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
        for (let columnIndex = 0; columnIndex < values[rowIndex].length; columnIndex += 1) {
            const value = normalizeCell_(values[rowIndex][columnIndex])
            if (!value || found[value]) continue
            found[value] = true
            platforms.push(value)
        }
    }
    return platforms
}

function personnelEmployees_(context, departmentValue) {
    const department = normalizeCell_(departmentValue)
    const values = context.sheet.getDataRange().getValues()
    const employees = []
    for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
        const row = values[rowIndex]
        if (normalizeCell_(row[context.schema.departmentIndex]) !== department) continue
        employees.push({
            row: rowIndex + 1,
            fio: normalizeCell_(row[context.schema.fioIndex]),
            position: normalizeCell_(row[context.schema.positionIndex]),
        })
    }
    return employees
}

function personnelEmployee_(context, rowNumber, fio) {
    const row = requirePersonnelRow_(context, rowNumber, fio)
    const rights = []
    for (let index = 10; index < context.schema.header.length; index += 1) {
        const name = context.schema.header[index]
        if (!name) continue
        rights.push({name: name, value: normalizeCell_(row[index]).toLowerCase() === 'да' ? 'Да' : 'Нет'})
    }
    return {
        row: Number(rowNumber),
        fio: normalizeCell_(row[context.schema.fioIndex]),
        department: normalizeCell_(row[context.schema.departmentIndex]),
        position: normalizeCell_(row[context.schema.positionIndex]),
        platform: normalizeCell_(row[context.schema.platformIndex]),
        role: normalizeCell_(row[context.schema.roleIndex]),
        login: normalizeCell_(row[context.schema.loginIndex]),
        password: normalizeCell_(row[context.schema.passwordIndex]),
        status: normalizeCell_(row[context.schema.statusIndex]),
        rights: rights,
    }
}

function requirePersonnelRow_(context, rowNumber, fio) {
    const row = Number(rowNumber)
    if (!Number.isInteger(row) || row < 2 || row > context.sheet.getLastRow()) throw new Error('Сотрудник не найден')
    const values = context.sheet.getRange(row, 1, 1, context.schema.header.length).getValues()
    const employee = values[0]
    if (normalizeCell_(employee[context.schema.fioIndex]) !== normalizeCell_(fio)) throw new Error('Данные сотрудника изменились — обновите список')
    return employee
}

function ensurePersonnelLoginUnique_(context, login, ownRow) {
    const normalized = normalizeCell_(login).toLowerCase()
    if (!normalized) throw new Error('Укажите логин')
    const values = context.sheet.getDataRange().getValues()
    for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
        if (rowIndex + 1 === ownRow) continue
        if (normalizeCell_(values[rowIndex][context.schema.loginIndex]).toLowerCase() === normalized) {
            throw new Error('Такой логин уже существует')
        }
    }
}

function setPersonnelValue_(sheet, row, columnIndex, value) {
    sheet.getRange(row, columnIndex + 1).setValue(value)
}

function writePersonnelRights_(context, row, rights) {
    const values = rights && typeof rights === 'object' ? rights : {}
    for (let index = 10; index < context.schema.header.length; index += 1) {
        const name = context.schema.header[index]
        if (!name || !Object.prototype.hasOwnProperty.call(values, name)) continue
        setPersonnelValue_(context.sheet, row, index, normalizeCell_(values[name]).toLowerCase() === 'да' ? 'Да' : 'Нет')
    }
}

function savePersonnelEmployee_(context, payload) {
    const lock = LockService.getScriptLock()
    if (!lock.tryLock(5000)) throw new Error('busy')
    try {
        const row = Number(payload.row)
        requirePersonnelRow_(context, row, payload.fio || '')
        ensurePersonnelLoginUnique_(context, payload.login || '', row)
        setPersonnelValue_(context.sheet, row, context.schema.platformIndex, normalizeCell_(payload.platform))
        setPersonnelValue_(context.sheet, row, context.schema.roleIndex, normalizePersonnelRole_(payload.role))
        setPersonnelValue_(context.sheet, row, context.schema.loginIndex, normalizeCell_(payload.login))
        if (normalizeCell_(payload.password)) setPersonnelValue_(context.sheet, row, context.schema.passwordIndex, normalizeCell_(payload.password))
        writePersonnelRights_(context, row, payload.rights)
        return personnelEmployee_(context, row, payload.fio || '')
    } finally {
        lock.releaseLock()
    }
}

function createPersonnelEmployee_(context, payload) {
    const fio = normalizeCell_(payload.fio)
    const department = normalizeCell_(payload.department)
    const position = normalizeCell_(payload.position)
    if (!fio || !department || !position) throw new Error('Заполните ФИО, отдел и должность')

    const lock = LockService.getScriptLock()
    if (!lock.tryLock(5000)) throw new Error('busy')
    try {
        ensurePersonnelLoginUnique_(context, payload.login || '', 0)
        const row = new Array(context.schema.header.length).fill('')
        row[context.schema.fioIndex] = fio
        row[context.schema.departmentIndex] = department
        row[context.schema.positionIndex] = position
        row[context.schema.platformIndex] = normalizeCell_(payload.platform)
        row[context.schema.roleIndex] = normalizePersonnelRole_(payload.role)
        row[context.schema.loginIndex] = normalizeCell_(payload.login)
        row[context.schema.passwordIndex] = generatePersonnelPassword_()
        row[context.schema.statusIndex] = ACTIVE_STATUS
        for (let index = 10; index < context.schema.header.length; index += 1) {
            const name = context.schema.header[index]
            if (!name || !payload.rights || !Object.prototype.hasOwnProperty.call(payload.rights, name)) continue
            row[index] = normalizeCell_(payload.rights[name]).toLowerCase() === 'да' ? 'Да' : 'Нет'
        }
        context.sheet.appendRow(row)
        return personnelEmployee_(context, context.sheet.getLastRow(), fio)
    } finally {
        lock.releaseLock()
    }
}

function dismissPersonnelEmployee_(context, rowNumber, fio) {
    const lock = LockService.getScriptLock()
    if (!lock.tryLock(5000)) throw new Error('busy')
    try {
        const row = Number(rowNumber)
        requirePersonnelRow_(context, row, fio)
        setPersonnelValue_(context.sheet, row, context.schema.statusIndex, 'Уволен')
    } finally {
        lock.releaseLock()
    }
}

function normalizePersonnelRole_(value) {
    const role = normalizeCell_(value)
    if (role !== 'Исполнитель' && role !== 'Менеджер') throw new Error('Выберите роль')
    return role
}

function generatePersonnelPassword_() {
    const lower = 'abcdefghijklmnopqrstuvwxyz'
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const digits = '0123456789'
    const alphabet = lower + upper + digits
    const chars = [lower.charAt(Math.floor(Math.random() * lower.length)), upper.charAt(Math.floor(Math.random() * upper.length)), digits.charAt(Math.floor(Math.random() * digits.length))]
    while (chars.length < 10) chars.push(alphabet.charAt(Math.floor(Math.random() * alphabet.length)))
    for (let index = chars.length - 1; index > 0; index -= 1) {
        const target = Math.floor(Math.random() * (index + 1))
        const value = chars[index]
        chars[index] = chars[target]
        chars[target] = value
    }
    return chars.join('')
}

function getJournalSheet_() {
    const sheet = getSpreadsheet_().getSheetByName(JOURNAL_SHEET)
    if (!sheet) {
        throw new Error('Sheet not found: ' + JOURNAL_SHEET)
    }
    return sheet
}

function getOrCreateHandoverSheet_() {
    const spreadsheet = getSpreadsheet_()
    let sheet = spreadsheet.getSheetByName(HANDOVER_SHEET)

    if (!sheet) {
        sheet = spreadsheet.insertSheet(HANDOVER_SHEET)
        sheet.appendRow(['Дата', 'Инженер', 'Бирка'])
    }

    return sheet
}

function getOrCreateMeasurementSheet_() {
    const spreadsheet = getSpreadsheet_()
    let sheet = spreadsheet.getSheetByName(MEASUREMENT_SHEET)

    if (!sheet) {
        sheet = spreadsheet.insertSheet(MEASUREMENT_SHEET)
        // Заголовки как в реальном листе «Промеры» (включая «Титул и марка»),
        // чтобы пересозданный лист совпадал по структуре с оригиналом.
        sheet.appendRow(['Дата', 'Бирка', 'Титул и марка', 'Покрытие', 'Зона 1', 'Зона 2', 'Зона 3', 'Зона 4', 'Зона 5', 'Оценка', 'Контролер'])
    }

    return sheet
}

/**
 * Заголовок листа почти никогда не меняется — кешируем на 5 минут вместо
 * сетевого Sheets-чтения на каждую выдачу/упаковку/удаление. Если столбцы
 * только что переставили вручную, ошибка «столбец не найден» может на
 * несколько минут отставать от факта — это приемлемо для редкой ручной
 * правки структуры листа.
 */
function getSheetHeader_(sheet) {
    const cache = CacheService.getScriptCache()
    const cacheKey = 'header:' + sheet.getParent().getId() + ':' + sheet.getName()
    const cached = cache.get(cacheKey)
    if (cached) return JSON.parse(cached)

    const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(normalizeCell_)
    cache.put(cacheKey, JSON.stringify(header), 300)
    return header
}

function requireColumn_(header, columnName, sheetName) {
    const index = header.indexOf(columnName)
    if (index < 0) {
        throw new Error('Не найден столбец «' + columnName + '» на листе «' + sheetName + '»')
    }
    return index
}

/**
 * Записывает считанный QR упаковки на лист «Логисты». Лист создаётся
 * автоматически при первом вызове, если его ещё нет в таблице.
 *
 * «Цех» заполняется площадкой из профиля сотрудника (platform), а не
 * выбором цеха на отдельном экране — выбор цеха для упаковки убран.
 * «Вес»/«Титул»/«Титул и марка» ничего не пишут — на реальном листе
 * это готовые Arrayformula-колонки, считающие значения из «Бирка»
 * автоматически при появлении новой строки.
 */
function recordPacking_(platform, fio, machine, qrText) {
    const sheet = getOrCreateLogistSheet_()

    const lock = LockService.getScriptLock()
    if (!lock.tryLock(5000)) {
        throw new Error('busy')
    }

    try {
        assertBadgeNotRecorded_(sheet, qrText, LOGIST_SHEET)
        const row = buildLogistRow_(sheet, platform, fio, machine, qrText)
        sheet.appendRow(row)
    } finally {
        lock.releaseLock()
    }
}

function buildLogistRow_(sheet, platform, fio, machine, qrText) {
    const header = getSheetHeader_(sheet)

    const dateIndex = requireColumn_(header, 'Дата', LOGIST_SHEET)
    const workshopIndex = requireColumn_(header, 'Цех', LOGIST_SHEET)
    const fioIndex = requireColumn_(header, 'ФИО', LOGIST_SHEET)
    const badgeIndex = requireColumn_(header, 'Бирка', LOGIST_SHEET)
    const machineIndex = requireColumn_(header, 'Машина', LOGIST_SHEET)

    const row = new Array(header.length).fill('')
    row[dateIndex] = new Date()
    row[workshopIndex] = platform
    row[fioIndex] = fio
    row[badgeIndex] = qrText
    row[machineIndex] = machine

    return row
}

/**
 * Список упаковок сотрудника за сегодня на конкретную машину — для
 * таблицы на экране «Упаковка» (сколько уже загружено на эту машину).
 */
function getPackingToday_(fio, machine) {
    const sheet = getOrCreateLogistSheet_()
    const header = getSheetHeader_(sheet)

    const dateIndex = requireColumn_(header, 'Дата', LOGIST_SHEET)
    const fioIndex = requireColumn_(header, 'ФИО', LOGIST_SHEET)
    const weightIndex = requireColumn_(header, 'Вес', LOGIST_SHEET)
    const titleMarkIndex = requireColumn_(header, 'Титул и марка', LOGIST_SHEET)
    const machineIndex = requireColumn_(header, 'Машина', LOGIST_SHEET)

    const fioNormalized = normalizeCell_(fio)
    const machineNormalized = normalizeCell_(machine)
    const todayKey = formatDateKey_(new Date())

    const values = sheet.getDataRange().getValues()
    const entries = []

    for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
        const row = values[rowIndex]
        const rowDate = row[dateIndex]

        if (normalizeCell_(row[fioIndex]) !== fioNormalized) continue
        if (normalizeCell_(row[machineIndex]) !== machineNormalized) continue
        if (!(rowDate instanceof Date) || formatDateKey_(rowDate) !== todayKey) continue

        entries.push({
            titleAndMark: normalizeCell_(row[titleMarkIndex]),
            weight: Number(row[weightIndex]) || 0,
        })
    }

    return entries
}

function getOrCreateLogistSheet_() {
    const spreadsheet = getSpreadsheet_()
    let sheet = spreadsheet.getSheetByName(LOGIST_SHEET)

    if (!sheet) {
        sheet = spreadsheet.insertSheet(LOGIST_SHEET)
        // Заголовки как в реальном листе «Логисты» (включая «Титул», «Титул и
        // марка», «Машина») — иначе пересозданный лист был бы урезан.
        sheet.appendRow(['Дата', 'Цех', 'ФИО', 'Накладная', 'Бирка', 'Вес', 'Титул', 'Титул и марка', 'Машина'])
    }

    return sheet
}

/**
 * Упаковка и сдача — одна бирка не должна попасть в таблицу дважды.
 * Проверяем только столбец «Бирка» на целевом листе; журнал выдачи,
 * промеры и прочие записи не затрагиваем.
 */
function assertBadgeNotRecorded_(sheet, badgeContent, sheetName) {
    const normalized = normalizeCell_(badgeContent)
    if (!normalized) return

    const header = getSheetHeader_(sheet)
    const badgeIndex = requireColumn_(header, 'Бирка', sheetName)
    const values = sheet.getDataRange().getValues()

    for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
        if (normalizeCell_(values[rowIndex][badgeIndex]) === normalized) {
            throw new Error('Бирка уже записана')
        }
    }
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
