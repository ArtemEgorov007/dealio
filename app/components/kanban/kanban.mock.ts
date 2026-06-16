import { EnumStatus } from '~~/types/cards.types'
import type { ICardRecord } from '~~/types/cards.types'

export const MOCK_CARDS: ICardRecord[] = [
    {
        $id: 'mock-001',
        $createdAt: '2025-05-10T09:15:00.000Z',
        name: 'Завести Telegram-канал про фронтенд',
        price: 0,
        status: EnumStatus.ideas,
        customer: {
            $id: 'cat-001',
            $createdAt: '2025-05-10T09:00:00.000Z',
            name: 'Идея',
            email: '',
            avatar_url: '',
        },
        comments: [
            {
                $id: 'com-001a',
                $createdAt: '2025-05-11T11:00:00.000Z',
                text: 'Разбирать задачи с собесов, делиться инсайтами по Nuxt и Vue'
            }
        ]
    },
    {
        $id: 'mock-002',
        $createdAt: '2025-06-01T14:30:00.000Z',
        name: 'Pet-проект на WebGL — 3D визуализация данных',
        price: 0,
        status: EnumStatus.ideas,
        customer: {
            $id: 'cat-002',
            $createdAt: '2025-06-01T14:00:00.000Z',
            name: 'Идея',
            email: '',
            avatar_url: '',
        },
        comments: []
    },
    {
        $id: 'mock-003',
        $createdAt: '2025-05-20T08:45:00.000Z',
        name: 'Обновить резюме на hh.ru',
        price: 0,
        status: EnumStatus.tasks,
        customer: {
            $id: 'cat-003',
            $createdAt: '2025-05-20T08:00:00.000Z',
            name: 'Задача',
            email: '',
            avatar_url: '',
        },
        comments: [
            {
                $id: 'com-003a',
                $createdAt: '2025-05-21T10:00:00.000Z',
                text: 'Добавить Nuxt 4 и последние пет-проекты'
            }
        ]
    },
    {
        $id: 'mock-004',
        $createdAt: '2025-06-05T11:00:00.000Z',
        name: 'Дописать тесты для kanban-компонентов',
        price: 0,
        status: EnumStatus.tasks,
        customer: {
            $id: 'cat-004',
            $createdAt: '2025-06-05T10:00:00.000Z',
            name: 'Задача',
            email: '',
            avatar_url: '',
        },
        comments: []
    },
    {
        $id: 'mock-005',
        $createdAt: '2025-06-10T13:20:00.000Z',
        name: 'Редизайн портфолио — новый стек и кейсы',
        price: 0,
        status: EnumStatus.doing,
        customer: {
            $id: 'cat-005',
            $createdAt: '2025-06-10T13:00:00.000Z',
            name: 'Задача',
            email: '',
            avatar_url: '',
        },
        comments: [
            {
                $id: 'com-005a',
                $createdAt: '2025-06-12T09:00:00.000Z',
                text: 'Макет готов в Figma, верстаю главную'
            }
        ]
    },
    {
        $id: 'mock-006',
        $createdAt: '2025-06-08T10:00:00.000Z',
        name: 'Написать статью про Nuxt 4 для Habr',
        price: 0,
        status: EnumStatus.doing,
        customer: {
            $id: 'cat-006',
            $createdAt: '2025-06-08T09:00:00.000Z',
            name: 'Идея',
            email: '',
            avatar_url: '',
        },
        comments: []
    },
    {
        $id: 'mock-007',
        $createdAt: '2025-04-15T09:30:00.000Z',
        name: 'Задеплоить Dealio на GitHub Pages',
        price: 0,
        status: EnumStatus.done,
        customer: {
            $id: 'cat-007',
            $createdAt: '2025-04-15T09:00:00.000Z',
            name: 'Задача',
            email: '',
            avatar_url: '',
        },
        comments: [
            {
                $id: 'com-007a',
                $createdAt: '2025-04-16T15:00:00.000Z',
                text: 'CI/CD через GitHub Actions — работает'
            }
        ]
    },
    {
        $id: 'mock-008',
        $createdAt: '2025-03-28T12:00:00.000Z',
        name: 'Пройти курс по TypeScript Advanced',
        price: 0,
        status: EnumStatus.done,
        customer: {
            $id: 'cat-008',
            $createdAt: '2025-03-28T11:00:00.000Z',
            name: 'Задача',
            email: '',
            avatar_url: '',
        },
        comments: []
    },
    {
        $id: 'mock-009',
        $createdAt: '2025-06-14T10:00:00.000Z',
        name: 'Механическая клавиатура Keychron Q3',
        price: 12000,
        status: EnumStatus.wishlist,
        customer: {
            $id: 'cat-009',
            $createdAt: '2025-06-14T09:00:00.000Z',
            name: 'Wishlist',
            email: '',
            avatar_url: '',
        },
        comments: [
            {
                $id: 'com-009a',
                $createdAt: '2025-06-14T12:00:00.000Z',
                text: 'Тактильные свичи, RGB — самое то для вечерних сессий'
            }
        ]
    },
    {
        $id: 'mock-010',
        $createdAt: '2025-06-13T11:45:00.000Z',
        name: 'Монитор 4K LG UltraFine 27"',
        price: 45000,
        status: EnumStatus.wishlist,
        customer: {
            $id: 'cat-010',
            $createdAt: '2025-06-13T11:00:00.000Z',
            name: 'Wishlist',
            email: '',
            avatar_url: '',
        },
        comments: []
    },
    {
        $id: 'mock-011',
        $createdAt: '2025-06-12T16:00:00.000Z',
        name: 'Курс по CSS-анимациям и GSAP',
        price: 8000,
        status: EnumStatus.wishlist,
        customer: {
            $id: 'cat-011',
            $createdAt: '2025-06-12T15:00:00.000Z',
            name: 'Wishlist',
            email: '',
            avatar_url: '',
        },
        comments: [
            {
                $id: 'com-011a',
                $createdAt: '2025-06-12T17:00:00.000Z',
                text: 'Хочу добавить анимации на портфолио'
            }
        ]
    },
]
