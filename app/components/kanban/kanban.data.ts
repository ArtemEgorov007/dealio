import {EnumStatus} from "~~/types/cards.types";
import type {IColumn} from "~/components/kanban/kanban.types";
import {COLUMN_LABELS} from "~/components/kanban/kanban.labels";

export const KANBAN_DATA: IColumn[] = [
    {
        id: EnumStatus.todo,
        name: COLUMN_LABELS[EnumStatus.todo],
        items: [],
    },
    {
        id: EnumStatus['to-be-agreed'],
        name: COLUMN_LABELS[EnumStatus['to-be-agreed']],
        items: [],
    },
    {
        id: EnumStatus['in-progress'],
        name: COLUMN_LABELS[EnumStatus['in-progress']],
        items: [],
    },
    {
        id: EnumStatus.produced,
        name: COLUMN_LABELS[EnumStatus.produced],
        items: [],
    },
    {
        id: EnumStatus.done,
        name: COLUMN_LABELS[EnumStatus.done],
        items: [],
    },
]
