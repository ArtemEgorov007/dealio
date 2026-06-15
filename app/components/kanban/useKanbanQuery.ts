import {useQuery} from "@tanstack/vue-query";
import {COLLECTION_DEALS, DB_ID} from "~~/app.constants";
import {KANBAN_DATA} from "~/components/kanban/kanban.data";
import {MOCK_DEALS} from "~/components/kanban/kanban.mock";
import type {IDeal} from "~~/types/deals.types";
import type {ICard, IColumn} from "~/components/kanban/kanban.types";
import {isGuestSession} from "~~/store/auth.store";

export function useKanbanQuery() {
    return useQuery({
        queryKey: ['deals'],
        queryFn: async () => {
            if (import.meta.client && isGuestSession()) {
                return { documents: MOCK_DEALS, total: MOCK_DEALS.length }
            }
            try {
                const response = await DB.listDocuments(DB_ID, COLLECTION_DEALS);
                return response;
            } catch (error) {
                console.error('Error fetching deals:', error);
                throw new Error('Не удалось загрузить данные. Проверьте подключение к интернету и попробуйте снова.');
            }
        },
        select(data) {
            try {
                const newBoard: IColumn[] = JSON.parse(JSON.stringify(KANBAN_DATA));
                const deals = data.documents as unknown as IDeal[];

                for (const deal of deals) {
                    const column = newBoard.find(e => e.id === deal.status);

                    if (column) {
                        column.items.push({
                            $createdAt: deal.$createdAt,
                            id: deal.$id,
                            name: deal.name,
                            price: deal.price,
                            companyName: deal.customer?.name || 'Не указан',
                            status: column.name,
                        });
                    }
                }
                
                // Sort items by creation date (newest first)
                newBoard.forEach(column => {
                    column.items.sort((a, b) => 
                        new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime()
                    );
                });
                
                return newBoard;
            } catch (error) {
                console.error('Error processing deals data:', error);
                throw new Error('Ошибка обработки данных сделок');
            }
        },
        retry: 1,
        staleTime: 5 * 60 * 1000, // 5 minutes
        cacheTime: 10 * 60 * 1000, // 10 minutes
    });
}