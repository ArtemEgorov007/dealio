import {fetchWarehouseCategories} from '~/utils/warehouse-sheets'
import {filterByQuery} from '~/utils/text-search'

/**
 * Общий сценарий складских экранов «Приём» и «Выдача»:
 * загрузить категории -> выбрать одну -> загрузить её позиции -> искать по ним.
 *
 * Обе страницы держали одинаковые ~75 строк: состояния загрузки и ошибок,
 * стражи от устаревших ответов, сброс поиска и подскролл к списку. Отличались
 * только источником позиций (справочник номенклатуры против остатков площадки)
 * и текстом ошибки, поэтому различия вынесены в параметры.
 */
export function useWarehouseCatalog<TItem>(options: {
    /** Чем грузить позиции выбранной категории. */
    loadItems: (category: string) => Promise<TItem[]>
    /** Текст ошибки, если позиции не загрузились. */
    itemsErrorMessage: string
    /** По какому полю искать. */
    searchSelector: (item: TItem) => string
}) {
    const categories = ref<string[]>([])
    const categoriesLoading = ref(true)
    const categoriesError = ref('')

    const selectedCategory = ref<string | null>(null)
    const items = ref<TItem[]>([]) as Ref<TItem[]>
    const itemsLoading = ref(false)
    const itemsError = ref('')
    const query = ref('')

    const itemsSectionRef = ref<HTMLElement | null>(null)

    const filteredItems = computed(() => filterByQuery(items.value, query.value, options.searchSelector))

    const loadCategories = async () => {
        categoriesLoading.value = true
        categoriesError.value = ''
        try {
            categories.value = await fetchWarehouseCategories()
        } catch (error) {
            categoriesError.value = error instanceof Error ? error.message : 'Ошибка загрузки категорий'
        } finally {
            categoriesLoading.value = false
        }
    }

    const selectCategory = async (category: string) => {
        selectedCategory.value = category
        query.value = ''
        itemsLoading.value = true
        itemsError.value = ''

        // Подсказка, что снизу появился контент — иначе на длинной сетке категорий
        // не всегда очевидно, что список уже подгрузился под текущей прокруткой.
        nextTick(() => itemsSectionRef.value?.scrollIntoView({behavior: 'smooth', block: 'start'}))

        try {
            const fetched = await options.loadItems(category)
            // Быстрые переключения категорий дают гонку ответов: пишем результат
            // только если выбор с момента запроса не изменился.
            if (selectedCategory.value === category) items.value = fetched
        } catch (error) {
            if (selectedCategory.value === category) {
                itemsError.value = error instanceof Error ? error.message : options.itemsErrorMessage
            }
        } finally {
            if (selectedCategory.value === category) itemsLoading.value = false
        }
    }

    const retryItems = () => {
        if (selectedCategory.value) selectCategory(selectedCategory.value)
    }

    return {
        categories,
        categoriesLoading,
        categoriesError,
        loadCategories,
        selectedCategory,
        selectCategory,
        items,
        itemsLoading,
        itemsError,
        itemsSectionRef,
        retryItems,
        query,
        filteredItems,
    }
}
