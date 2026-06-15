import {EnumStatus} from '~~/types/cards.types'

export const COLUMN_LABELS: Record<EnumStatus, string> = {
    [EnumStatus.todo]: 'Идеи',
    [EnumStatus['to-be-agreed']]: 'Запланировано',
    [EnumStatus['in-progress']]: 'В работе',
    [EnumStatus.produced]: 'На проверке',
    [EnumStatus.done]: 'Готово',
}

export const CATEGORY_OPTIONS = [
    {value: 'Идеи', label: 'Идеи'},
    {value: 'Задачи', label: 'Задачи'},
    {value: 'Желания', label: 'Желания'},
    {value: 'Личное', label: 'Личное'},
] as const

export const PRIORITY_LABELS: Record<number, string> = {
    1: 'Низкий',
    2: 'Обычный',
    3: 'Средний',
    4: 'Высокий',
    5: 'Срочно',
}
