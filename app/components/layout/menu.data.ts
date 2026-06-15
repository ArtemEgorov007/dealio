export interface IMenuItem {
    name: string
    url: string
    icon: string
}

export const MENU_DATA: IMenuItem[] = [
    {
        icon: 'heroicons:squares-2x2',
        name: 'Доска',
        url: '/',
    },
    {
        icon: 'heroicons:light-bulb',
        name: 'Обзор',
        url: '/dashboard',
    },
    {
        name: 'Идеи',
        icon: 'heroicons:sparkles',
        url: '/ideas',
    },
    {
        name: 'Задачи',
        icon: 'heroicons:clipboard-document-check',
        url: '/tasks',
    },
    {
        name: 'Желания',
        icon: 'heroicons:heart',
        url: '/wishlist',
    },
    {
        name: 'Архив',
        icon: 'heroicons:archive-box',
        url: '/archive',
    },
    {
        name: 'Настройки',
        icon: 'radix-icons:gear',
        url: '/settings',
    },
    {
        name: 'Помощь',
        icon: 'radix-icons:question-mark',
        url: '/help',
    },
]
