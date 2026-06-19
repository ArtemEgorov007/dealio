import type {InjectionKey, Ref} from 'vue'

import type {ICard} from '~/components/kanban/kanban.types'

export interface KanbanDragContext {
    dragCard: Readonly<Ref<ICard | null>>
    dropTargetColumnId: Readonly<Ref<string | null>>
    movingToColumnId: Readonly<Ref<string | null | undefined>>
    onCardPointerDown: (event: PointerEvent, card: ICard, columnId: string) => void
    wasDragging: Readonly<Ref<boolean>>
}

export const KANBAN_DRAG_KEY: InjectionKey<KanbanDragContext> = Symbol('kanban-drag')
