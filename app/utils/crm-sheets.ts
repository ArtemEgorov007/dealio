import type {WorkshopId} from '~~/types/crm.types'
import {workshopById} from '~~/types/crm.types'

const ISSUE_SHEET = 'Выдача'
const JOURNAL_SHEET = 'Журнал выдачи бирок'

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
    apiKey: string
    gasUrl: string
}

function getConfig(): SheetsRuntimeConfig {
    const config = useRuntimeConfig()
    return {
        spreadsheetId: config.public.crmSpreadsheetId || '',
        apiKey: config.public.crmSheetsApiKey || '',
        gasUrl: config.public.crmGasUrl || '',
    }
}

function isSheetsConfigured(config: SheetsRuntimeConfig): boolean {
    return Boolean(config.spreadsheetId && config.apiKey)
}

function isJournalConfigured(config: SheetsRuntimeConfig): boolean {
    return Boolean(config.gasUrl)
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

export async function fetchWorkshopBadges(workshopId: WorkshopId): Promise<string[]> {
    const config = getConfig()

    if (!isSheetsConfigured(config)) {
        return MOCK_BADGES[workshopId]
    }

    const range = encodeURIComponent(`${ISSUE_SHEET}!A1:Z1000`)
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${range}?key=${config.apiKey}`

    const response = await fetch(url)
    if (!response.ok) {
        throw new Error('Не удалось загрузить список бирок из Google Таблицы')
    }

    const payload = await response.json() as { values?: string[][] }
    return parseBadgeColumn(payload.values ?? [], workshopId)
}

export async function appendBadgeJournalEntry(entry: {
    issuedAt: string
    fio: string
    workshopLabel: string
    badgeContent: string
}): Promise<void> {
    const config = getConfig()

    if (!isJournalConfigured(config)) {
        if (import.meta.dev) return
        throw new Error('Не настроена запись в журнал (NUXT_PUBLIC_CRM_GAS_URL)')
    }

    const response = await fetch(config.gasUrl, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            sheet: JOURNAL_SHEET,
            row: [
                entry.issuedAt,
                entry.fio,
                entry.workshopLabel,
                entry.badgeContent,
            ],
        }),
    })

    if (!response.ok) {
        throw new Error('Не удалось записать выдачу в журнал')
    }

    const result = await response.json().catch(() => ({})) as { ok?: boolean; error?: string }

    if (result.ok === false) {
        throw new Error(result.error || 'Ошибка записи в журнал')
    }
}
