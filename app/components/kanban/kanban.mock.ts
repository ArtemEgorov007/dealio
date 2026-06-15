import { EnumStatus } from '~~/types/deals.types'
import type { IDeal } from '~~/types/deals.types'

export const MOCK_DEALS: IDeal[] = [
    {
        $id: 'mock-001',
        $createdAt: '2024-05-10T09:15:00.000Z',
        name: 'Поставка металлопроката для завода',
        price: 1_850_000,
        status: EnumStatus.todo,
        customer: {
            $id: 'cust-001',
            $createdAt: '2024-04-01T10:00:00.000Z',
            name: 'ООО «СтальГрупп»',
            email: 'zakaz@stalgroup.ru',
            avatar_url: '',
            from_source: 'Сайт'
        },
        comments: [
            {
                $id: 'com-001a',
                $createdAt: '2024-05-11T11:00:00.000Z',
                text: 'Запросили технические характеристики'
            }
        ]
    },
    {
        $id: 'mock-002',
        $createdAt: '2024-05-12T14:30:00.000Z',
        name: 'Монтаж вентиляционных систем',
        price: 420_000,
        status: EnumStatus.todo,
        customer: {
            $id: 'cust-002',
            $createdAt: '2024-04-15T12:00:00.000Z',
            name: 'АО «ПромСтрой»',
            email: 'tender@promstroy.com',
            avatar_url: '',
            from_source: 'Тендер'
        },
        comments: []
    },
    {
        $id: 'mock-003',
        $createdAt: '2024-05-03T08:45:00.000Z',
        name: 'Разработка CRM-системы для отдела продаж',
        price: 780_000,
        status: EnumStatus['to-be-agreed'],
        customer: {
            $id: 'cust-003',
            $createdAt: '2024-03-20T09:00:00.000Z',
            name: 'ООО «Трейд Плюс»',
            email: 'it@tradeplus.ru',
            avatar_url: '',
            from_source: 'Рекомендация'
        },
        comments: [
            {
                $id: 'com-003a',
                $createdAt: '2024-05-05T16:00:00.000Z',
                text: 'Согласовали список модулей'
            },
            {
                $id: 'com-003b',
                $createdAt: '2024-05-07T10:30:00.000Z',
                text: 'Ждём подписания NDA'
            }
        ]
    },
    {
        $id: 'mock-004',
        $createdAt: '2024-04-28T11:00:00.000Z',
        name: 'Поставка офисной мебели',
        price: 290_000,
        status: EnumStatus['to-be-agreed'],
        customer: {
            $id: 'cust-004',
            $createdAt: '2024-04-10T08:00:00.000Z',
            name: 'ЗАО «МебельОфис»',
            email: 'sales@mebeloffice.ru',
            avatar_url: '',
            from_source: 'Холодный звонок'
        },
        comments: []
    },
    {
        $id: 'mock-005',
        $createdAt: '2024-04-20T13:20:00.000Z',
        name: 'Изготовление рекламных конструкций',
        price: 560_000,
        status: EnumStatus['in-progress'],
        customer: {
            $id: 'cust-005',
            $createdAt: '2024-03-05T14:00:00.000Z',
            name: 'ООО «РекламаМастер»',
            email: 'project@reklamamaster.ru',
            avatar_url: '',
            from_source: 'Выставка'
        },
        comments: [
            {
                $id: 'com-005a',
                $createdAt: '2024-04-22T09:00:00.000Z',
                text: 'Макеты утверждены, приступили к производству'
            }
        ]
    },
    {
        $id: 'mock-006',
        $createdAt: '2024-04-15T10:00:00.000Z',
        name: 'Техническое обслуживание оборудования',
        price: 130_000,
        status: EnumStatus['in-progress'],
        customer: {
            $id: 'cust-006',
            $createdAt: '2024-02-18T11:00:00.000Z',
            name: 'ИП Коваленко В.А.',
            email: 'v.kovalenko@inbox.ru',
            avatar_url: '',
            from_source: 'Сайт'
        },
        comments: []
    },
    {
        $id: 'mock-007',
        $createdAt: '2024-04-05T09:30:00.000Z',
        name: 'Упаковочная линия под ключ',
        price: 3_200_000,
        status: EnumStatus.produced,
        customer: {
            $id: 'cust-007',
            $createdAt: '2024-01-12T10:00:00.000Z',
            name: 'ПАО «АгроПром»',
            email: 'equipment@agroprom.ru',
            avatar_url: '',
            from_source: 'Тендер'
        },
        comments: [
            {
                $id: 'com-007a',
                $createdAt: '2024-04-08T15:00:00.000Z',
                text: 'Оборудование произведено, ожидает инспекцию'
            }
        ]
    },
    {
        $id: 'mock-008',
        $createdAt: '2024-03-28T12:00:00.000Z',
        name: 'Поставка серверного оборудования',
        price: 640_000,
        status: EnumStatus.produced,
        customer: {
            $id: 'cust-008',
            $createdAt: '2024-01-30T09:00:00.000Z',
            name: 'ООО «ИТ-Систем»',
            email: 'procurement@itsystem.ru',
            avatar_url: '',
            from_source: 'Рекомендация'
        },
        comments: []
    },
    {
        $id: 'mock-009',
        $createdAt: '2024-03-15T08:00:00.000Z',
        name: 'Внедрение ERP-системы',
        price: 2_100_000,
        status: EnumStatus.done,
        customer: {
            $id: 'cust-009',
            $createdAt: '2023-12-01T10:00:00.000Z',
            name: 'АО «Металлург-Инвест»',
            email: 'digital@metallinvest.ru',
            avatar_url: '',
            from_source: 'Партнёр'
        },
        comments: [
            {
                $id: 'com-009a',
                $createdAt: '2024-03-20T14:00:00.000Z',
                text: 'Акт подписан, система передана в эксплуатацию'
            },
            {
                $id: 'com-009b',
                $createdAt: '2024-03-22T10:00:00.000Z',
                text: 'Обучение персонала завершено'
            }
        ]
    },
    {
        $id: 'mock-010',
        $createdAt: '2024-03-10T11:45:00.000Z',
        name: 'Логистика крупногабаритного груза',
        price: 380_000,
        status: EnumStatus.done,
        customer: {
            $id: 'cust-010',
            $createdAt: '2023-11-15T09:00:00.000Z',
            name: 'ООО «ТрансЛогик»',
            email: 'cargo@translogic.ru',
            avatar_url: '',
            from_source: 'Сайт'
        },
        comments: []
    }
]
