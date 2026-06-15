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
    'todo' = 'todo',
    'to-be-agreed' = 'to-be-agreed',
    'in-progress' = 'in-progress',
    'produced' = 'produced',
    'done' = 'done',
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
