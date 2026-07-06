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
 * GET  ?action=issuedToday&fio=...&workshop=kolpino|volkhonka  (workshop опционален)
 * GET  ?action=handedOverToday&fio=...
 * POST { action: 'issueBadge',       workshop, fio, badgeContent }
 * POST { action: 'deleteIssuedBadge', row, fio, badgeContent }
 * POST { action: 'recordPacking',    workshop, qrText }
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
                login: profile.login,
                password: profile.password,
                access: profile.access,
            })
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
 * Бирки, выданные сотрудником сегодня — для экрана «Бирки за смену».
 * workshop опционален: без него отдаёт бирки по всем цехам.
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

        if (normalizeCell_(row[engineerIndex]) !== fioNormalized) continue
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
 * Бирки, сданные сотрудником ОКК сегодня — для экрана «Сдачи».
 * Читает лист «Сдача».
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

        if (normalizeCell_(row[engineerIndex]) !== fioNormalized) continue
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
            },
        }
    }

    throw new Error('Неверный логин или пароль')
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
 */
function recordPacking_(workshop, qrText) {
    const workshopLabel = getWorkshopSheetName_(workshop)
    const sheet = getOrCreateLogistSheet_()

    const lock = LockService.getScriptLock()
    if (!lock.tryLock(5000)) {
        throw new Error('busy')
    }

    try {
        assertBadgeNotRecorded_(sheet, qrText, LOGIST_SHEET)
        const row = buildLogistRow_(sheet, workshopLabel, qrText)
        sheet.appendRow(row)
    } finally {
        lock.releaseLock()
    }
}

function buildLogistRow_(sheet, workshopLabel, qrText) {
    const header = getSheetHeader_(sheet)

    const dateIndex = requireColumn_(header, 'Дата', LOGIST_SHEET)
    const workshopIndex = requireColumn_(header, 'Цех', LOGIST_SHEET)
    const badgeIndex = requireColumn_(header, 'Бирка', LOGIST_SHEET)

    const row = new Array(header.length).fill('')
    row[dateIndex] = new Date()
    row[workshopIndex] = workshopLabel
    row[badgeIndex] = qrText

    return row
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
