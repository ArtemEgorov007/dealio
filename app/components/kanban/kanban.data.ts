import {EnumStatus} from "~~/types/cards.types";
import type {IColumn} from "~/components/kanban/kanban.types";
import {COLUMN_LABELS} from "~/components/kanban/kanban.labels";

export const KANBAN_DATA: IColumn[] = [
    {
        id: EnumStatus.ideas,
        name: COLUMN_LABELS[EnumStatus.ideas],
        items: [],
    },
    {
        id: EnumStatus.tasks,
        name: COLUMN_LABELS[EnumStatus.tasks],
        items: [],
    },
    {
        id: EnumStatus.doing,
        name: COLUMN_LABELS[EnumStatus.doing],
        items: [],
    },
    {
        id: EnumStatus.done,
        name: COLUMN_LABELS[EnumStatus.done],
        items: [],
    },
    {
        id: EnumStatus.wishlist,
        name: COLUMN_LABELS[EnumStatus.wishlist],
        items: [],
    },
]
