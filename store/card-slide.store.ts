import {defineStore} from 'pinia'
import type {ICard} from '../app/components/kanban/kanban.types'

interface CardSlideState {
    card: ICard | null
    isOpen: boolean
}

const defaultValue: CardSlideState = {
    card: null,
    isOpen: false,
}

export const useCardSlideStore = defineStore('card-slide', {
    state: (): CardSlideState => ({...defaultValue}),
    actions: {
        clear() {
            this.$patch({...defaultValue})
        },
        set(card: ICard) {
            this.$patch({card, isOpen: true})
        },
    },
})
