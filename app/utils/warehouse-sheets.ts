import type {WarehouseStockItem} from '~~/types/warehouse.types'

interface WarehouseConfig {
    gasUrl: string
}

function getConfig(): WarehouseConfig {
    const config = useRuntimeConfig()
    return {gasUrl: config.public.warehouseGasUrl || ''}
}

interface WarehouseGasResponse {
    ok?: boolean
    error?: string
    categories?: string[]
    items?: string[] | WarehouseStockItem[]
}

function buildUrl(gasUrl: string, params: Record<string, string>): string {
    const url = new URL(gasUrl)
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value)
    }
    return url.toString()
}

async function requestGet(params: Record<string, string>): Promise<WarehouseGasResponse> {
    const config = getConfig()
    if (!config.gasUrl) throw new Error('Склад не подключён')

    let response: Response
    try {
        response = await fetch(buildUrl(config.gasUrl, params))
    } catch {
        throw new Error('Нет связи с сервером. Проверьте интернет и повторите.')
    }

    if (!response.ok) throw new Error('Ошибка связи со складом')

    try {
        return await response.json() as WarehouseGasResponse
    } catch {
        throw new Error('Неверный ответ от сервера.')
    }
}

async function requestPost(payload: Record<string, string | number>): Promise<WarehouseGasResponse> {
    const config = getConfig()
    if (!config.gasUrl) throw new Error('Склад не подключён')

    let response: Response
    try {
        response = await fetch(config.gasUrl, {
            method: 'POST',
            headers: {'Content-Type': 'text/plain;charset=utf-8'},
            body: JSON.stringify(payload),
            redirect: 'follow',
        })
    } catch {
        throw new Error('Нет связи с сервером. Проверьте интернет и повторите.')
    }

    if (!response.ok) throw new Error('Ошибка связи со складом')

    try {
        return await response.json() as WarehouseGasResponse
    } catch {
        throw new Error('Неверный ответ от сервера. Обновите страницу и попробуйте снова.')
    }
}

export async function fetchWarehouseCategories(): Promise<string[]> {
    const result = await requestGet({action: 'categories'})
    if (!result.ok) throw new Error(result.error || 'Не удалось загрузить категории')
    return (result.categories as string[]) ?? []
}

export async function fetchWarehouseItems(category: string): Promise<string[]> {
    const result = await requestGet({action: 'items', category})
    if (!result.ok) throw new Error(result.error || 'Не удалось загрузить список товаров')
    return (result.items as string[]) ?? []
}

export async function fetchWarehouseStock(platform: string, category?: string): Promise<WarehouseStockItem[]> {
    const params: Record<string, string> = {action: 'stock', platform}
    if (category) params.category = category
    const result = await requestGet(params)
    if (!result.ok) throw new Error(result.error || 'Не удалось загрузить остатки')
    return (result.items as WarehouseStockItem[]) ?? []
}

export interface ReceiveItemPayload {
    platform: string
    cell: string
    name: string
    type: string
    qty: number
    unit: string
    fio: string
    requestId: string
}

export async function receiveWarehouseItem(payload: ReceiveItemPayload): Promise<void> {
    const result = await requestPost({action: 'receiveItem', ...payload})
    if (!result.ok) throw new Error(result.error || 'Не удалось оформить приём')
}

export interface IssueItemPayload {
    platform: string
    cell: string
    name: string
    type: string
    qty: number
    unit: string
    fio: string
    recipientFio: string
    requestId: string
}

export async function issueWarehouseItem(payload: IssueItemPayload): Promise<void> {
    const result = await requestPost({action: 'issueItem', ...payload})
    if (!result.ok) throw new Error(result.error || 'Не удалось оформить выдачу')
}
