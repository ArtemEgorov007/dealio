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

export interface CrmEmployeeProfile {
    fio: string
    workshopId: WorkshopId | null
}

export interface CrmBadgeIssue {
    workshopId: WorkshopId
    fio: string
    badgeContent: string
}

export function workshopById(id: WorkshopId): WorkshopOption {
    const found = CRM_WORKSHOPS.find(item => item.id === id)
    if (!found) throw new Error(`Unknown workshop: ${id}`)
    return found
}

export function workshopLabel(id: WorkshopId): string {
    return workshopById(id).label
}
