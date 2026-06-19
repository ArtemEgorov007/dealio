import {EnumStatus} from '~~/types/cards.types'

/** Значение категории в Appwrite / guest store */
export const WISHLIST_CATEGORY = 'Wishlist' as const

/** Подпись в UI */
export const WISHLIST_CATEGORY_LABEL = 'Желания'

export const COLUMN_LABELS: Record<EnumStatus, string> = {
    [EnumStatus.ideas]: 'Идеи',
    [EnumStatus.tasks]: 'Задачи',
    [EnumStatus.doing]: 'В работе',
    [EnumStatus.done]: 'Готово',
    [EnumStatus.wishlist]: WISHLIST_CATEGORY_LABEL,
}

export const CATEGORY_OPTIONS = [
    {value: 'Идея', label: 'Идея'},
    {value: 'Задача', label: 'Задача'},
    {value: WISHLIST_CATEGORY, label: WISHLIST_CATEGORY_LABEL},
] as const
