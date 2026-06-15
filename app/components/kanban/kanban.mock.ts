import { EnumStatus } from '~~/types/cards.types'
import type { ICardRecord } from '~~/types/cards.types'

export const MOCK_CARDS: ICardRecord[] = [
    {
        $id: 'mock-001',
        $createdAt: '2024-05-10T09:15:00.000Z',
        name: 'Научиться играть на гитаре',
        price: 3,
        status: EnumStatus.todo,
        customer: {
            $id: 'cust-001',
            $createdAt: '2024-04-01T10:00:00.000Z',
            name: 'Желания',
            email: '',
            avatar_url: '',
            from_source: 'Личное'
        },
        comments: [
            {
                $id: 'com-001a',
                $createdAt: '2024-05-11T11:00:00.000Z',
                text: 'Купить акустическую гитару для начала'
            }
        ]
    },
    {
        $id: 'mock-002',
        $createdAt: '2024-05-12T14:30:00.000Z',
        name: 'Приложение для трекинга привычек',
        price: 4,
        status: EnumStatus.todo,
        customer: {
            $id: 'cust-002',
            $createdAt: '2024-04-15T12:00:00.000Z',
            name: 'Идеи',
            email: '',
            avatar_url: '',
            from_source: 'Side project'
        },
        comments: []
    },
    {
        $id: 'mock-003',
        $createdAt: '2024-05-03T08:45:00.000Z',
        name: 'Переработать личный сайт-портфолио',
        price: 3,
        status: EnumStatus['to-be-agreed'],
        customer: {
            $id: 'cust-003',
            $createdAt: '2024-03-20T09:00:00.000Z',
            name: 'Задачи',
            email: '',
            avatar_url: '',
            from_source: 'Работа'
        },
        comments: [
            {
                $id: 'com-003a',
                $createdAt: '2024-05-05T16:00:00.000Z',
                text: 'Выбрать палитру и шрифты'
            }
        ]
    },
    {
        $id: 'mock-004',
        $createdAt: '2024-04-28T11:00:00.000Z',
        name: 'Поездка в Японию весной',
        price: 5,
        status: EnumStatus['to-be-agreed'],
        customer: {
            $id: 'cust-004',
            $createdAt: '2024-04-10T08:00:00.000Z',
            name: 'Желания',
            email: '',
            avatar_url: '',
            from_source: 'Путешествия'
        },
        comments: []
    },
    {
        $id: 'mock-005',
        $createdAt: '2024-04-20T13:20:00.000Z',
        name: 'Написать статью про Vue 3 Composition API',
        price: 2,
        status: EnumStatus['in-progress'],
        customer: {
            $id: 'cust-005',
            $createdAt: '2024-03-05T14:00:00.000Z',
            name: 'Задачи',
            email: '',
            avatar_url: '',
            from_source: 'Блог'
        },
        comments: [
            {
                $id: 'com-005a',
                $createdAt: '2024-04-22T09:00:00.000Z',
                text: 'Черновик готов на 60%'
            }
        ]
    },
    {
        $id: 'mock-006',
        $createdAt: '2024-04-15T10:00:00.000Z',
        name: 'Освоить Figma для UI-дизайна',
        price: 3,
        status: EnumStatus['in-progress'],
        customer: {
            $id: 'cust-006',
            $createdAt: '2024-02-18T11:00:00.000Z',
            name: 'Идеи',
            email: '',
            avatar_url: '',
            from_source: 'Обучение'
        },
        comments: []
    },
    {
        $id: 'mock-007',
        $createdAt: '2024-04-05T09:30:00.000Z',
        name: 'Собрать домашний уголок для чтения',
        price: 2,
        status: EnumStatus.produced,
        customer: {
            $id: 'cust-007',
            $createdAt: '2024-01-12T10:00:00.000Z',
            name: 'Желания',
            email: '',
            avatar_url: '',
            from_source: 'Дом'
        },
        comments: [
            {
                $id: 'com-007a',
                $createdAt: '2024-04-08T15:00:00.000Z',
                text: 'Кресло заказано, жду доставку'
            }
        ]
    },
    {
        $id: 'mock-008',
        $createdAt: '2024-03-28T12:00:00.000Z',
        name: 'Запустить подкаст с друзьями',
        price: 4,
        status: EnumStatus.produced,
        customer: {
            $id: 'cust-008',
            $createdAt: '2024-01-30T09:00:00.000Z',
            name: 'Идеи',
            email: '',
            avatar_url: '',
            from_source: 'Side project'
        },
        comments: []
    },
    {
        $id: 'mock-009',
        $createdAt: '2024-03-15T08:00:00.000Z',
        name: 'Пробежать полумарафон',
        price: 5,
        status: EnumStatus.done,
        customer: {
            $id: 'cust-009',
            $createdAt: '2023-12-01T10:00:00.000Z',
            name: 'Желания',
            email: '',
            avatar_url: '',
            from_source: 'Спорт'
        },
        comments: [
            {
                $id: 'com-009a',
                $createdAt: '2024-03-20T14:00:00.000Z',
                text: 'Финишировал за 1:58 — личный рекорд!'
            }
        ]
    },
    {
        $id: 'mock-010',
        $createdAt: '2024-03-10T11:45:00.000Z',
        name: 'Разобрать фотоархив за 5 лет',
        price: 1,
        status: EnumStatus.done,
        customer: {
            $id: 'cust-010',
            $createdAt: '2023-11-15T09:00:00.000Z',
            name: 'Задачи',
            email: '',
            avatar_url: '',
            from_source: 'Личное'
        },
        comments: []
    }
]
