import {EnumStatus} from '~~/types/cards.types'

export const COLUMN_LABELS: Record<EnumStatus, string> = {
    [EnumStatus.ideas]: '💡 Идеи',
    [EnumStatus.tasks]: '✅ Задачи',
    [EnumStatus.doing]: '⚡ В работе',
    [EnumStatus.done]: '🎉 Готово',
    [EnumStatus.wishlist]: '🎁 Wishlist',
}

export const CATEGORY_OPTIONS = [
    {value: 'Идея', label: '💡 Идея'},
    {value: 'Задача', label: '✅ Задача'},
    {value: 'Wishlist', label: '🎁 Wishlist'},
] as const
