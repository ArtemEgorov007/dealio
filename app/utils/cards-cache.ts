import type {QueryClient} from '@tanstack/vue-query'

import {CARDS_QUERY_KEY, CARDS_STATS_QUERY_KEY} from '~/components/kanban/kanban.types'

export function clearCardsCache(queryClient: QueryClient) {
    queryClient.removeQueries({queryKey: [CARDS_QUERY_KEY]})
    queryClient.removeQueries({queryKey: [CARDS_STATS_QUERY_KEY]})
}
