<script setup lang="ts">
import {fetchWorkshopBadges} from '~/utils/erp-sheets'
import {formatBadgeDisplay} from '~/utils/erp-csv'
import {filterByQuery} from '~/utils/text-search'
import {workshopLabel} from '~~/types/erp.types'
import {useErpEmployeeStore} from '~~/store/erp-employee.store'
import {useErpSessionStore} from '~~/store/erp-session.store'
import {useTabBarHidden} from '~/composables/useTabBarHidden'

definePageMeta({layout: 'erp'})

useSeoMeta({title: 'Выбор бирки | ERP'})

const employeeStore = useErpEmployeeStore()
const sessionStore = useErpSessionStore()
const router = useRouter()
const isTabBarHidden = useTabBarHidden()

const badges = ref<string[]>([])
const isLoading = ref(true)
const error = ref('')
const query = ref('')
const pendingBadge = ref<string | null>(null)

const workshopTitle = computed(() =>
    employeeStore.workshopId ? workshopLabel(employeeStore.workshopId) : '',
)

// Заголовок + подтекст строки: первая строка (или часть до «·») — жирная,
// остальное — серым под ней, как в макете «Корпоративный синий»
const badgeParts = (badge: string): { title: string; sub: string } => {
    const display = formatBadgeDisplay(badge)
    const newlineIndex = display.indexOf('\n')
    if (newlineIndex > 0) {
        return {
            title: display.slice(0, newlineIndex).trim(),
            sub: display.slice(newlineIndex + 1).replace(/\n+/g, ' · ').trim(),
        }
    }
    const dotIndex = display.indexOf('·')
    if (dotIndex > 0) {
        return {title: display.slice(0, dotIndex).trim(), sub: display.slice(dotIndex + 1).trim()}
    }
    return {title: display, sub: ''}
}

const filteredBadges = computed(() => filterByQuery(badges.value, query.value, badge => badge))

const searchCountLabel = computed(() => {
    if (!badges.value.length) return ''
    return `Найдено ${filteredBadges.value.length} из ${badges.value.length}`
})

const loadBadges = async () => {
    if (!employeeStore.workshopId) return

    isLoading.value = true
    error.value = ''

    try {
        badges.value = await fetchWorkshopBadges(employeeStore.workshopId)
    } catch (loadError) {
        error.value = loadError instanceof Error ? loadError.message : 'Ошибка загрузки бирок'
    } finally {
        isLoading.value = false
    }
}

const selectBadge = (content: string) => {
    pendingBadge.value = content
}

const cancelPendingBadge = () => {
    pendingBadge.value = null
}

const onBadgeIssued = (skippedJournal: boolean) => {
    if (!pendingBadge.value) return
    sessionStore.selectBadge(pendingBadge.value)
    sessionStore.markIssued(skippedJournal)
    pendingBadge.value = null
    router.push('/receipt')
}

onMounted(loadBadges)
</script>

<template>
  <ErpScreen
      title="Выбор бирки"
      :subtitle="`Цех: ${workshopTitle}`"
      icon="heroicons:tag"
      :shift-link="{ to: '/shift', label: 'Бирки за смену' }"
  >
    <template v-if="!isLoading && !error && badges.length > 0" #search>
      <ErpSearchBar
          v-model="query"
          placeholder="Поиск по бирке"
          :count-label="searchCountLabel"
          @focusin="isTabBarHidden = true"
          @focusout="isTabBarHidden = false"
      />
    </template>

    <ErpEmptyState v-if="isLoading" loading>
      <span>Загрузка списка…</span>
    </ErpEmptyState>

    <ErpEmptyState v-else-if="error" error>
      <p>{{ error }}</p>
      <UiButton variant="outline" @click="loadBadges">Повторить</UiButton>
    </ErpEmptyState>

    <ErpEmptyState v-else-if="badges.length === 0">
      <p>Для цеха «{{ workshopTitle }}» бирки не найдены</p>
    </ErpEmptyState>

    <ErpEmptyState v-else-if="filteredBadges.length === 0">
      <p>Ничего не найдено по запросу «{{ query }}»</p>
      <UiButton variant="outline" @click="query = ''">Очистить поиск</UiButton>
    </ErpEmptyState>

    <ErpGroupedList v-else>
      <ErpListRow
          v-for="badge in filteredBadges"
          :key="badge"
          chevron
          class="badge-list-row"
          @click="selectBadge(badge)"
      >
        <template #leading>
          <span class="badge-row-ic">
            <Icon name="heroicons:tag" size="16"/>
          </span>
        </template>
        <span class="badge-row">
          <span class="badge-row__title">{{ badgeParts(badge).title }}</span>
          <span v-if="badgeParts(badge).sub" class="badge-row__sub">{{ badgeParts(badge).sub }}</span>
        </span>
      </ErpListRow>
    </ErpGroupedList>
  </ErpScreen>

  <ErpBadgeConfirmSheet
      :badge="pendingBadge"
      @issued="onBadgeIssued"
      @cancel="cancelPendingBadge"
  />
</template>

<style scoped lang="sass">
/* Иконка, текст и стрелка центрируются по вертикали — ровные строки как в макете */
.badge-list-row
  align-items: center
  padding-top: 10px
  padding-bottom: 10px

.badge-row-ic
  display: flex
  align-items: center
  justify-content: center
  width: 30px
  height: 30px
  border-radius: 9px
  background: rgba(1, 110, 215, 0.10)
  color: var(--color-primary)

.badge-row
  display: flex
  flex-direction: column
  gap: 1px
  min-width: 0

.badge-row__title
  font-size: 15px
  font-weight: 650
  line-height: 1.3
  color: var(--color-text)

.badge-row__sub
  font-size: 12px
  line-height: 1.35
  color: var(--color-text-secondary)
</style>
