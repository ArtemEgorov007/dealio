/** Appwrite collection `deals` — имена полей совпадают со схемой бэкенда */

import type {Models} from 'appwrite'

export interface IBaseField {
    $createdAt: string
    $id: string
}

export interface ICategoryField extends IBaseField {
    name: string
    email: string
    avatar_url: string
    from_source?: string
}

export interface IComment extends IBaseField {
    text: string
}

export enum EnumStatus {
    'ideas' = 'ideas',
    'tasks' = 'tasks',
    'doing' = 'doing',
    'done' = 'done',
    'wishlist' = 'wishlist',
}

export interface ICardRecord extends IBaseField {
    comments: IComment[]
    /** категория карточки в Appwrite хранится в поле customer */
    customer: ICategoryField
    name: string
    /** стоимость в рублях (Wishlist) */
    price: number
    status: EnumStatus
}

/** Документ Appwrite целиком (системные поля + доменные) — для запросов через SDK */
export type ICardDocument = ICardRecord & Models.Document

/** Payload создания карточки: customer без системных полей Appwrite */
export interface INewCardData {
    name: string
    price: number
    status: EnumStatus
    customer: Pick<ICategoryField, 'name' | 'email'>
    comments: IComment[]
}
