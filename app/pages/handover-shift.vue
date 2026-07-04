<script setup lang="ts">
import {fetchHandedOverBadgesToday} from '~/utils/erp-sheets'
import {formatBadgeDisplay} from '~/utils/erp-csv'
import type {ErpIssuedBadgeEntry} from '~~/types/erp.types'
import {useErpEmployeeStore} from '~~/store/erp-employee.store'

definePageMeta({layout: 'erp'})

useSeoMeta({title: 'Сдача работ | ERP'})

const employeeStore = useErpEmployeeStore()
const router = useRouter()

const entries = ref<ErpIssuedBadgeEntry[]>([])
const isLoading = ref(true)
const error = ref('')
const pendingUndo = ref<ErpIssuedBadgeEntry | null>(null)

const load = async () => {
    isLoading.value = true
    error.value = ''

    try {
        entries.value = await fetchHandedOverBadgesToday(employeeStore.fio)
    } catch (loadError) {
        error.value = loadError instanceof Error ? loadError.message : 'Ошибка загрузки'
    } finally {
        isLoading.value = false
    }
}

const goBack = () => {
    router.push('/scan-handover')
}

const requestUndo = (entry: ErpIssuedBadgeEntry) => {
    pendingUndo.value = entry
}

const cancelUndo = () => {
    pendingUndo.value = null
}

const onUndone = (entry: ErpIssuedBadgeEntry) => {
    entries.value = entries.value.filter(item => item.row !== entry.row)
    pendingUndo.value = null
}

onMounted(load)
</script>

<template>
  <ErpScreen
      title="Сдача работ"
      :subtitle="employeeStore.fio"
      icon="heroicons:check-badge"
  >
    <ErpEmptyState v-if="isLoading" loading>
      <span>Загрузка…</span>
    </ErpEmptyState>

    <ErpEmptyState v-else-if="error" error>
      <p>{{ error }}</p>
      <UiButton variant="outline" @click="load">Повторить</UiButton>
    </ErpEmptyState>

    <ErpEmptyState v-else-if="entries.length === 0">
      <p>За смену сдач пока не было</p>
    </ErpEmptyState>

    <template v-else>
      <ErpSectionLabel>Сдано сегодня: {{ entries.length }}</ErpSectionLabel>

      <ErpGroupedList>
        <ErpListRow
            v-for="entry in entries"
            :key="entry.row"
            tag="article"
            multiline
        >
          <span class="shift-row">
            <span class="shift-row__time">{{ entry.time }}</span>
            <span class="shift-row__badge">{{ formatBadgeDisplay(entry.badge) }}</span>
          </span>

          <template #trailing>
            <button
                type="button"
                class="erp-row-action erp-row-action--danger"
                aria-label="Отменить сдачу"
                @click.stop="requestUndo(entry)"
            >
              <Icon name="heroicons:arrow-uturn-left" size="16"/>
            </button>
          </template>
        </ErpListRow>
      </ErpGroupedList>
    </template>

    <template #footer>
      <UiButton block variant="outline" @click="goBack">
        Назад
      </UiButton>
    </template>
  </ErpScreen>

  <ErpUndoHandoverSheet
      :entry="pendingUndo"
      @undone="onUndone"
      @cancel="cancelUndo"
  />
</template>

<style scoped lang="sass">
.shift-row
  display: flex
  flex-direction: column
  gap: 2px
  min-width: 0

.shift-row__time
  font-size: 13px
  color: var(--color-text-secondary)

.shift-row__badge
  font-size: 15px
  line-height: 1.35
  white-space: pre-line
</style>
