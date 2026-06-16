/** Appwrite collection `deals` — имена полей совпадают со схемой бэкенда */

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
    /** приоритет 1–5 */
    price: number
    status: EnumStatus
}
