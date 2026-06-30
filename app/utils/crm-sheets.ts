import type {CrmBadgeIssue, CrmIssuedBadgeEntry, WorkshopId} from '~~/types/crm.types'
import {workshopById} from '~~/types/crm.types'
import {parseCsv} from '~/utils/crm-csv'

const ISSUE_SHEET = 'Выдача'
const JOURNAL_SHEET = 'Журнал выдачи бирок'
const ISSUE_SHEET_GID = '1376055067'

const DEFAULT_SPREADSHEET_ID = '1HDj9ng5OdbgohhzdeP9LGVA-Fs_WI93m5IDWDdTXR-U'

const GAS_URL_STORAGE_KEY = 'crm-gas-url'

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
    entries?: CrmIssuedBadgeEntry[]
    error?: string
}

function getConfig(): SheetsRuntimeConfig {
    const config = useRuntimeConfig()
    const envGasUrl = config.public.crmGasUrl || ''
    const storedGasUrl = import.meta.client ? localStorage.getItem(GAS_URL_STORAGE_KEY) || '' : ''

    return {
        spreadsheetId: config.public.crmSpreadsheetId || DEFAULT_SPREADSHEET_ID,
        issueSheetGid: config.public.crmIssueSheetGid || ISSUE_SHEET_GID,
        apiKey: config.public.crmSheetsApiKey || '',
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
    const response = await fetch(buildGasUrl(config, params))

    if (!response.ok) {
        throw new Error('Ошибка связи с Google Таблицей')
    }

    return await response.json() as GasResponse
}

async function requestGasPost(config: SheetsRuntimeConfig, payload: Record<string, string>): Promise<GasResponse> {
    const response = await fetch(config.gasUrl, {
        method: 'POST',
        headers: {'Content-Type': 'text/plain;charset=utf-8'},
        body: JSON.stringify(payload),
        redirect: 'follow',
    })

    if (!response.ok) {
        throw new Error('Ошибка связи с Google Таблицей')
    }

    return await response.json() as GasResponse
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
    entry: CrmBadgeIssue,
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

export async function fetchIssuedBadgesToday(fio: string, workshopId: WorkshopId | null): Promise<CrmIssuedBadgeEntry[]> {
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

export async function deleteIssuedBadge(entry: CrmIssuedBadgeEntry, fio: string): Promise<void> {
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

export async function recordPackingEntry(workshopId: WorkshopId, qrText: string): Promise<void> {
    const config = getConfig()

    if (!isGasConfigured(config)) {
        throw new Error('Журнал не подключён')
    }

    const result = await requestGasPost(config, {
        action: 'recordPacking',
        workshop: workshopId,
        qrText,
    })

    if (!result.ok) {
        throw new Error(result.error || 'Не удалось записать упаковку')
    }
}

export type JournalWriteResult = 'ok' | 'skipped'

export async function appendBadgeJournalEntry(entry: CrmBadgeIssue): Promise<JournalWriteResult> {
    const config = getConfig()

    if (!isGasConfigured(config)) {
        return 'skipped'
    }

    await issueBadgeViaGas(config, entry)
    return 'ok'
}

export function getCrmSheetsMode(): 'gas' | 'csv' | 'api' | 'mock' {
    const config = getConfig()
    if (isGasConfigured(config)) return 'gas'
    if (config.spreadsheetId && config.issueSheetGid) return 'csv'
    if (isSheetsApiConfigured(config)) return 'api'
    return 'mock'
}

export function saveCrmGasUrl(url: string): void {
    if (!import.meta.client) return
    const trimmed = url.trim()
    if (trimmed) {
        localStorage.setItem(GAS_URL_STORAGE_KEY, trimmed)
    } else {
        localStorage.removeItem(GAS_URL_STORAGE_KEY)
    }
}

export function getCrmGasUrl(): string {
    return getConfig().gasUrl
}

export async function testCrmGasConnection(gasUrl: string): Promise<{ ok: boolean; badgesCount?: number; error?: string }> {
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
