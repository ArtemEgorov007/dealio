import type {ErpAccessFlags, ErpBadgeIssue, ErpIssuedBadgeEntry, ErpPackingEntry, WorkshopId} from '~~/types/erp.types'
import {DEFAULT_ACCESS_FLAGS, workshopById} from '~~/types/erp.types'
import {parseCsv} from '~/utils/erp-csv'

const ISSUE_SHEET = 'Выдача'
const JOURNAL_SHEET = 'Журнал выдачи бирок'
const ISSUE_SHEET_GID = '1376055067'

const DEFAULT_SPREADSHEET_ID = '1HDj9ng5OdbgohhzdeP9LGVA-Fs_WI93m5IDWDdTXR-U'

const GAS_URL_STORAGE_KEY = 'erp-gas-url'

const MOCK_BADGES: Record<WorkshopId, string[]> = {
    kolpino: [
        'Бирка К-101 · Сборка корпуса',
        'Бирка К-102 · Покраска',
        'Бирка К-103 · Контроль качества',
    ],
    volkhonka: [
        'Бирка В-201 · Механический цех',
        'Бирка В-202 · Склад готовой продукции',
        'Бирка В-203 · Упаковка',
    ],
}

interface SheetsRuntimeConfig {
    spreadsheetId: string
    issueSheetGid: string
    apiKey: string
    gasUrl: string
}

interface GasResponse {
    ok?: boolean
    badges?: string[]
    entries?: ErpIssuedBadgeEntry[]
    packingEntries?: ErpPackingEntry[]
    error?: string
    fio?: string
    department?: string
    position?: string
    platform?: string
    role?: string
    login?: string
    password?: string
    access?: ErpAccessFlags
}

export interface ErpLoginProfile {
    fio: string
    department: string
    position: string
    platform: string
    role: string
    login: string
    password: string
    access: ErpAccessFlags
}

function getConfig(): SheetsRuntimeConfig {
    const config = useRuntimeConfig()
    const envGasUrl = config.public.erpGasUrl || ''
    const storedGasUrl = import.meta.client ? localStorage.getItem(GAS_URL_STORAGE_KEY) || '' : ''

    return {
        spreadsheetId: config.public.erpSpreadsheetId || DEFAULT_SPREADSHEET_ID,
        issueSheetGid: config.public.erpIssueSheetGid || ISSUE_SHEET_GID,
        apiKey: config.public.erpSheetsApiKey || '',
        gasUrl: envGasUrl || storedGasUrl,
    }
}

function isSheetsApiConfigured(config: SheetsRuntimeConfig): boolean {
    return Boolean(config.spreadsheetId && config.apiKey)
}

function isGasConfigured(config: SheetsRuntimeConfig): boolean {
    return Boolean(config.gasUrl)
}

function buildGasUrl(config: SheetsRuntimeConfig, params: Record<string, string>): string {
    const url = new URL(config.gasUrl)
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value)
    }
    return url.toString()
}

async function requestGas(config: SheetsRuntimeConfig, params: Record<string, string>): Promise<GasResponse> {
    let response: Response

    try {
        response = await fetch(buildGasUrl(config, params))
    } catch {
        throw new Error('Нет связи с сервером. Проверьте интернет и повторите.')
    }

    if (!response.ok) {
        throw new Error('Ошибка связи с Google Таблицей')
    }

    try {
        return await response.json() as GasResponse
    } catch {
        throw new Error('Неверный ответ от сервера.')
    }
}

async function requestGasPost(config: SheetsRuntimeConfig, payload: Record<string, string>): Promise<GasResponse> {
    let response: Response

    try {
        response = await fetch(config.gasUrl, {
            method: 'POST',
            headers: {'Content-Type': 'text/plain;charset=utf-8'},
            body: JSON.stringify(payload),
            redirect: 'follow',
        })
    } catch {
        throw new Error('Нет связи с сервером. Проверьте интернет и повторите.')
    }

    if (!response.ok) {
        throw new Error('Ошибка связи с Google Таблицей')
    }

    try {
        return await response.json() as GasResponse
    } catch {
        throw new Error('Неверный ответ от сервера. Обновите страницу и попробуйте снова.')
    }
}

function parseBadgeColumn(rows: string[][], workshopId: WorkshopId): string[] {
    if (rows.length === 0) return []

    const header = rows[0] ?? []
    const columnTitle = workshopById(workshopId).sheetColumn
    const columnIndex = header.findIndex(cell => cell.trim() === columnTitle)

    if (columnIndex < 0) {
        throw new Error(`Колонка «${columnTitle}» не найдена на листе «${ISSUE_SHEET}»`)
    }

    const badges: string[] = []

    for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
        const value = (rows[rowIndex]?.[columnIndex] ?? '').trim()
        if (value) badges.push(value)
    }

    return badges
}

async function fetchBadgesViaPublicCsv(config: SheetsRuntimeConfig, workshopId: WorkshopId): Promise<string[]> {
    const url = `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/export?format=csv&gid=${config.issueSheetGid}`
    const response = await fetch(url)

    if (!response.ok) {
        throw new Error('Не удалось загрузить лист «Выдача»')
    }

    const csvText = await response.text()
    if (csvText.trimStart().startsWith('<')) {
        throw new Error('Лист «Выдача» недоступен для чтения')
    }

    return parseBadgeColumn(parseCsv(csvText), workshopId)
}

async function fetchBadgesViaGas(config: SheetsRuntimeConfig, workshopId: WorkshopId): Promise<string[]> {
    const result = await requestGas(config, {
        action: 'badges',
        workshop: workshopId,
    })

    if (!result.ok) {
        throw new Error(result.error || 'Не удалось загрузить бирки')
    }

    return result.badges ?? []
}

async function fetchBadgesViaApi(config: SheetsRuntimeConfig, workshopId: WorkshopId): Promise<string[]> {
    const range = encodeURIComponent(`${ISSUE_SHEET}!A1:Z5000`)
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${range}?key=${config.apiKey}`

    const response = await fetch(url)
    if (!response.ok) {
        throw new Error('Не удалось загрузить список бирок из Google Таблицы')
    }

    const payload = await response.json() as { values?: string[][] }
    return parseBadgeColumn(payload.values ?? [], workshopId)
}

export async function fetchWorkshopBadges(workshopId: WorkshopId): Promise<string[]> {
    const config = getConfig()
    let gasError: unknown

    if (isGasConfigured(config)) {
        try {
            return await fetchBadgesViaGas(config, workshopId)
        } catch (error) {
            // fallback если GAS ещё не задеплоен, а таблица уже публична —
            // но если ни один способ не сработает, это и есть реальная
            // причина сбоя, её и покажем вызывающему коду.
            gasError = error
        }
    }

    try {
        return await fetchBadgesViaPublicCsv(config, workshopId)
    } catch {
        // пробуем другие способы
    }

    if (isSheetsApiConfigured(config)) {
        return fetchBadgesViaApi(config, workshopId)
    }

    // Моки — только когда вообще ничего не настроено (первый запуск без
    // конфигурации). Если GAS настроен, но недоступен, это поломка,
    // которую нужно показать пользователю, а не подменять тестовыми данными.
    if (gasError) throw gasError

    return MOCK_BADGES[workshopId]
}

async function issueBadgeViaGas(
    config: SheetsRuntimeConfig,
    entry: ErpBadgeIssue,
): Promise<void> {
    const result = await requestGasPost(config, {
        action: 'issueBadge',
        workshop: entry.workshopId,
        fio: entry.fio,
        badgeContent: entry.badgeContent,
    })

    if (!result.ok) {
        throw new Error(result.error || 'Ошибка записи в журнал')
    }
}

export async function fetchIssuedBadgesToday(fio: string, workshopId: WorkshopId | null): Promise<ErpIssuedBadgeEntry[]> {
    const config = getConfig()

    if (!isGasConfigured(config)) {
        return []
    }

    const result = await requestGas(config, {
        action: 'issuedToday',
        fio,
        ...(workshopId ? {workshop: workshopId} : {}),
    })

    if (!result.ok) {
        throw new Error(result.error || 'Не удалось загрузить бирки за смену')
    }

    return result.entries ?? []
}

export async function deleteIssuedBadge(entry: ErpIssuedBadgeEntry, fio: string): Promise<void> {
    const config = getConfig()

    if (!isGasConfigured(config)) {
        throw new Error('Журнал не подключён')
    }

    const result = await requestGasPost(config, {
        action: 'deleteIssuedBadge',
        row: String(entry.row),
        fio,
        badgeContent: entry.badge,
    })

    if (!result.ok) {
        throw new Error(result.error || 'Не удалось удалить бирку')
    }
}

export async function fetchHandedOverBadgesToday(fio: string): Promise<ErpIssuedBadgeEntry[]> {
    const config = getConfig()

    if (!isGasConfigured(config)) {
        return []
    }

    const result = await requestGas(config, {
        action: 'handedOverToday',
        fio,
    })

    if (!result.ok) {
        throw new Error(result.error || 'Не удалось загрузить сданные бирки')
    }

    return result.entries ?? []
}

export async function recordHandoverEntry(fio: string, badgeContent: string): Promise<void> {
    const config = getConfig()

    if (!isGasConfigured(config)) {
        throw new Error('Журнал не подключён')
    }

    const result = await requestGasPost(config, {
        action: 'recordHandover',
        fio,
        badgeContent,
    })

    if (!result.ok) {
        throw new Error(result.error || 'Не удалось записать сдачу')
    }
}

export async function undoHandover(entry: ErpIssuedBadgeEntry, fio: string): Promise<void> {
    const config = getConfig()

    if (!isGasConfigured(config)) {
        throw new Error('Журнал не подключён')
    }

    const result = await requestGasPost(config, {
        action: 'undoHandover',
        row: String(entry.row),
        fio,
        badgeContent: entry.badge,
    })

    if (!result.ok) {
        throw new Error(result.error || 'Не удалось отменить сдачу')
    }
}

export async function loginErpEmployee(login: string, password: string): Promise<ErpLoginProfile> {
    const config = getConfig()

    if (!isGasConfigured(config)) {
        throw new Error('Журнал не подключён')
    }

    const result = await requestGasPost(config, {action: 'login', login, password})

    if (!result.ok || !result.fio) {
        throw new Error(result.error || 'Не удалось войти')
    }

    return {
        fio: result.fio,
        department: result.department ?? '',
        position: result.position ?? '',
        platform: result.platform ?? '',
        role: result.role ?? '',
        login: result.login ?? login,
        password: result.password ?? '',
        access: result.access
            ? {...DEFAULT_ACCESS_FLAGS, ...result.access}
            : {...DEFAULT_ACCESS_FLAGS},
    }
}

export async function recordMeasurement(
    fio: string,
    badge: string,
    coverage: string,
    zones: (number | null)[],
): Promise<void> {
    const config = getConfig()

    if (!isGasConfigured(config)) {
        throw new Error('Журнал не подключён')
    }

    const [z1, z2, z3, z4, z5] = zones

    const result = await requestGasPost(config, {
        action: 'recordMeasurement',
        fio,
        badge,
        coverage,
        zone1: z1 != null ? String(z1) : '',
        zone2: z2 != null ? String(z2) : '',
        zone3: z3 != null ? String(z3) : '',
        zone4: z4 != null ? String(z4) : '',
        zone5: z5 != null ? String(z5) : '',
    })

    if (!result.ok) {
        throw new Error(result.error || 'Не удалось записать промер')
    }
}

export async function recordPackingEntry(platform: string, fio: string, machine: string, qrText: string): Promise<void> {
    const config = getConfig()

    if (!isGasConfigured(config)) {
        throw new Error('Журнал не подключён')
    }

    const result = await requestGasPost(config, {
        action: 'recordPacking',
        platform,
        fio,
        machine,
        qrText,
    })

    if (!result.ok) {
        throw new Error(result.error || 'Не удалось записать упаковку')
    }
}

export async function fetchPackingToday(fio: string, machine: string): Promise<ErpPackingEntry[]> {
    const config = getConfig()

    if (!isGasConfigured(config)) {
        return []
    }

    const result = await requestGas(config, {
        action: 'packingToday',
        fio,
        machine,
    })

    if (!result.ok) {
        throw new Error(result.error || 'Не удалось загрузить упаковку за смену')
    }

    return result.packingEntries ?? []
}

export type JournalWriteResult = 'ok' | 'skipped'

export async function appendBadgeJournalEntry(entry: ErpBadgeIssue): Promise<JournalWriteResult> {
    const config = getConfig()

    if (!isGasConfigured(config)) {
        return 'skipped'
    }

    await issueBadgeViaGas(config, entry)
    return 'ok'
}

export function getErpSheetsMode(): 'gas' | 'csv' | 'api' | 'mock' {
    const config = getConfig()
    if (isGasConfigured(config)) return 'gas'
    if (config.spreadsheetId && config.issueSheetGid) return 'csv'
    if (isSheetsApiConfigured(config)) return 'api'
    return 'mock'
}

export function saveErpGasUrl(url: string): void {
    if (!import.meta.client) return
    const trimmed = url.trim()
    if (trimmed) {
        localStorage.setItem(GAS_URL_STORAGE_KEY, trimmed)
    } else {
        localStorage.removeItem(GAS_URL_STORAGE_KEY)
    }
}

export function getErpGasUrl(): string {
    return getConfig().gasUrl
}

export async function testErpGasConnection(gasUrl: string): Promise<{ ok: boolean; badgesCount?: number; error?: string }> {
    const config = {...getConfig(), gasUrl}
    try {
        const badges = await fetchBadgesViaGas(config, 'kolpino')
        return {ok: true, badgesCount: badges.length}
    } catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : 'Ошибка подключения',
        }
    }
}

export {DEFAULT_SPREADSHEET_ID, ISSUE_SHEET, ISSUE_SHEET_GID, JOURNAL_SHEET}
