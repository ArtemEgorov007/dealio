import {EnumStatus} from '~~/types/cards.types'

/** Значения enum `status` в Appwrite collection `deals` */
export type AppwriteDealStatus =
    | 'todo'
    | 'to-be-agreed'
    | 'in-progress'
    | 'produced'
    | 'done'

const UI_TO_APPWRITE: Record<EnumStatus, AppwriteDealStatus> = {
    [EnumStatus.ideas]: 'todo',
    [EnumStatus.tasks]: 'to-be-agreed',
    [EnumStatus.doing]: 'in-progress',
    [EnumStatus.done]: 'done',
    [EnumStatus.wishlist]: 'produced',
}

const APPWRITE_TO_UI: Record<AppwriteDealStatus, EnumStatus> = {
    'todo': EnumStatus.ideas,
    'to-be-agreed': EnumStatus.tasks,
    'in-progress': EnumStatus.doing,
    'produced': EnumStatus.wishlist,
    'done': EnumStatus.done,
}

export function toAppwriteStatus(status: EnumStatus | string): AppwriteDealStatus {
    if (status in UI_TO_APPWRITE) {
        return UI_TO_APPWRITE[status as EnumStatus]
    }

    if (status in APPWRITE_TO_UI) {
        return status as AppwriteDealStatus
    }

    return 'todo'
}

export function fromAppwriteStatus(status: string): EnumStatus {
    if (status in APPWRITE_TO_UI) {
        return APPWRITE_TO_UI[status as AppwriteDealStatus]
    }

    if (status in UI_TO_APPWRITE) {
        return status as EnumStatus
    }

    return EnumStatus.ideas
}
