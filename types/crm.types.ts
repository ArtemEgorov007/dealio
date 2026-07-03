export type WorkshopId = 'kolpino' | 'volkhonka'

export interface WorkshopOption {
    id: WorkshopId
    label: string
    sheetColumn: string
}

export const CRM_WORKSHOPS: WorkshopOption[] = [
    {id: 'kolpino', label: 'Колпино', sheetColumn: 'Колпино'},
    {id: 'volkhonka', label: 'Волхонка', sheetColumn: 'Волхонка'},
]

export interface CrmAccessFlags {
    badges: boolean
    measurements: boolean
    packing: boolean
    handover: boolean
    reports: boolean
    approvals: boolean
    supply: boolean
    orders: boolean
    warehouse: boolean
}

// Fail-closed: доступ выдаётся только тем флагам, что сервер (GAS login_) явно
// вернул как true из таблицы. Отсутствие флага в ответе = нет доступа, а не
// «показать всё». Раньше дефолты были all-true и маскировали дырку в доступах.
export const DEFAULT_ACCESS_FLAGS: CrmAccessFlags = {
    badges: false,
    measurements: false,
    packing: false,
    handover: false,
    reports: false,
    approvals: false,
    supply: false,
    orders: false,
    warehouse: false,
}

export interface CrmEmployeeProfile {
    fio: string
    workshopId: WorkshopId | null
    department?: string
    position?: string
    platform?: string
    login?: string
    password?: string
    access?: CrmAccessFlags
}

export interface CrmBadgeIssue {
    workshopId: WorkshopId
    fio: string
    badgeContent: string
}

export interface CrmIssuedBadgeEntry {
    row: number
    badge: string
    time: string
}

export function workshopById(id: WorkshopId): WorkshopOption {
    const found = CRM_WORKSHOPS.find(item => item.id === id)
    if (!found) throw new Error(`Unknown workshop: ${id}`)
    return found
}

export function workshopLabel(id: WorkshopId): string {
    return workshopById(id).label
}

const MIN_FIO_LENGTH = 3

export function isValidFio(fio: string): boolean {
    return fio.trim().length >= MIN_FIO_LENGTH
}
