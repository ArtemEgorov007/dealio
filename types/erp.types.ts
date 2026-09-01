export type WorkshopId = 'kolpino' | 'volkhonka'

export interface WorkshopOption {
    id: WorkshopId
    label: string
    sheetColumn: string
}

export const ERP_WORKSHOPS: WorkshopOption[] = [
    {id: 'kolpino', label: 'Колпино', sheetColumn: 'Колпино'},
    {id: 'volkhonka', label: 'Волхонка', sheetColumn: 'Волхонка'},
]

export interface ErpAccessFlags {
    badges: boolean
    measurements: boolean
    packing: boolean
    handover: boolean
    reports: boolean
    approvals: boolean
    supply: boolean
    orders: boolean
    warehouse: boolean
    personnel: boolean
    contracts: boolean
}

// Fail-closed: доступ выдаётся только тем флагам, что сервер (GAS login_) явно
// вернул как true из таблицы. Отсутствие флага в ответе = нет доступа, а не
// «показать всё». Раньше дефолты были all-true и маскировали дырку в доступах.
export const DEFAULT_ACCESS_FLAGS: ErpAccessFlags = {
    badges: false,
    measurements: false,
    packing: false,
    handover: false,
    reports: false,
    approvals: false,
    supply: false,
    orders: false,
    warehouse: false,
    personnel: false,
    contracts: false,
}

export interface ErpEmployeeProfile {
    fio: string
    workshopId: WorkshopId | null
    department?: string
    position?: string
    platform?: string
    role?: string
    login?: string
    password?: string
    access?: ErpAccessFlags
}

export interface ErpBadgeIssue {
    workshopId: WorkshopId
    fio: string
    badgeContent: string
}

export interface ErpIssuedBadgeEntry {
    row: number
    badge: string
    time: string
}

export interface ErpPackingEntry {
    titleAndMark: string
    weight: number
}

export interface ErpPersonnelDepartment {
    department: string
    activeCount: number
}

export interface ErpPersonnelRow {
    row: number
    fio: string
    position: string
}

export interface ErpPersonnelRight {
    name: string
    value: 'Да' | 'Нет'
}

export interface ErpPersonnelEmployee extends ErpPersonnelRow {
    department: string
    platform: string
    role: 'Исполнитель' | 'Менеджер'
    login: string
    password: string
    status: string
    rights: ErpPersonnelRight[]
}

export interface ErpPersonnelDraft {
    fio: string
    department: string
    position: string
    platform: string
    role: 'Исполнитель' | 'Менеджер'
    login: string
    password?: string
    rights: ErpPersonnelRight[]
}

export function workshopById(id: WorkshopId): WorkshopOption {
    const found = ERP_WORKSHOPS.find(item => item.id === id)
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
