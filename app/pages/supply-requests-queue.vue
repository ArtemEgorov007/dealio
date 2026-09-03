<script setup lang="ts">
import {useErpSupplyQueueStore} from '~~/store/erp-supply-queue.store'
import type {ErpSupplyQueueStatus} from '~/utils/erp-supply'

definePageMeta({layout: 'erp'})
useSeoMeta({title: 'Заявки | ERP'})

const queueStore = useErpSupplyQueueStore()
const isLoading = ref(true)
const loadError = ref('')

const load = async () => {
    isLoading.value = true
    loadError.value = ''
    try {
        await queueStore.refresh()
    } catch (error) {
        loadError.value = errorMessage(error, 'Не удалось загрузить заявки')
    } finally {
        isLoading.value = false
    }
}

onMounted(load)

const TABS: Array<{key: ErpSupplyQueueStatus; label: string}> = [
    {key: 'new', label: 'Новые'},
    {key: 'awaiting_ro', label: 'Ожидают РО'},
    {key: 'awaiting_gd', label: 'Ожидают ГД'},
    {key: 'approved', label: 'Согласованные'},
    {key: 'cancelled', label: 'Отменен'},
]

const activeTab = ref<ErpSupplyQueueStatus>('new')

const tabCount = (key: ErpSupplyQueueStatus): number =>
    queueStore.rows.filter(row => row.queueStatus === key).length

const visibleRequests = computed(() =>
    queueStore.rows.filter(row => row.queueStatus === activeTab.value),
)

const emptyMessage = (key: ErpSupplyQueueStatus): string => ({
    new: 'Новых заявок нет',
    awaiting_ro: 'Заявок, ждущих РО, нет',
    awaiting_gd: 'Заявок, ждущих ГД, нет',
    approved: 'Согласованных заявок нет',
    cancelled: 'Отменённых заявок нет',
}[key])

const formatDate = (value: string): string => {
    const parts = value.split('-')
    return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : value
}
</script>

<template>
  <ErpScreen
      title="Заявки"
      subtitle="Статус по заявкам снабжения"
      icon="heroicons:clipboard-document-list"
      :shift-link="{to: '/supply-work', label: 'Назад', icon: 'heroicons:chevron-left', iconSize: 13}"
  >
    <div class="queue-tabs" role="tablist">
      <button
          v-for="tab in TABS"
          :key="tab.key"
          type="button"
          role="tab"
          class="queue-tabs__item"
          :class="{'queue-tabs__item--active': activeTab === tab.key}"
          :aria-selected="activeTab === tab.key"
          @click="activeTab = tab.key"
      >
        <span>{{ tab.label }}</span>
        <span v-if="tabCount(tab.key) > 0" class="queue-tabs__count">{{ tabCount(tab.key) }}</span>
      </button>
    </div>

    <ErpEmptyState v-if="isLoading" loading>
      <span>Загрузка…</span>
    </ErpEmptyState>

    <ErpEmptyState v-else-if="loadError" error>
      <p>{{ loadError }}</p>
      <UiButton variant="outline" @click="load">Повторить</UiButton>
    </ErpEmptyState>

    <ErpEmptyState v-else-if="visibleRequests.length === 0">
      <p>{{ emptyMessage(activeTab) }}</p>
    </ErpEmptyState>

    <div v-else class="queue-list">
      <article v-for="item in visibleRequests" :key="item.requestCode" class="queue-card">
        <header class="queue-card__head">
          <div class="queue-card__title">
            <strong>{{ item.requestCode }}</strong>
            <span v-if="item.requestedAt" class="queue-card__date">{{ formatDate(item.requestedAt) }}</span>
          </div>
        </header>

        <ul v-if="item.items.length > 0" class="queue-card__items">
          <li v-for="(line, index) in item.items" :key="`${line.name}-${index}`" class="queue-item">
            <span class="queue-item__name">{{ line.name }}</span>
            <span class="queue-item__qty">{{ line.quantity }} {{ line.unit }}</span>
          </li>
        </ul>

        <dl class="queue-card__rows">
          <div v-if="item.department" class="queue-row">
            <dt>Отдел</dt>
            <dd>{{ item.department }}</dd>
          </div>
          <div v-if="item.employeeFio" class="queue-row">
            <dt>Заказал</dt>
            <dd>{{ item.employeeFio }}</dd>
          </div>
        </dl>
      </article>
    </div>
  </ErpScreen>
</template>

<style scoped lang="sass">
.queue-tabs
  display: flex
  gap: 6px
  overflow-x: auto
  scrollbar-width: none
  margin-bottom: 14px

  &::-webkit-scrollbar
    display: none

.queue-tabs__item
  flex-shrink: 0
  display: flex
  align-items: center
  gap: 6px
  padding: 8px 12px
  border: none
  border-radius: var(--radius-full)
  background: var(--color-card-bg)
  color: var(--color-text-secondary)
  font-size: 12.5px
  font-weight: 700
  white-space: nowrap
  cursor: pointer
  transition: background-color 0.15s ease, color 0.15s ease

  &--active
    background: var(--color-primary)
    color: #fff

.queue-tabs__count
  min-width: 18px
  height: 18px
  padding: 0 5px
  display: flex
  align-items: center
  justify-content: center
  border-radius: var(--radius-full)
  background: rgba(0, 0, 0, 0.12)
  font-size: 10.5px
  font-variant-numeric: tabular-nums

.queue-tabs__item--active .queue-tabs__count
  background: rgba(255, 255, 255, 0.24)

.queue-list
  display: flex
  flex-direction: column
  gap: 10px

.queue-card
  background: var(--color-card-bg)
  border-radius: 14px
  padding: 12px 14px
  box-shadow: var(--erp-shadow-card, 0 1px 0 rgba(0, 0, 0, 0.04))

.queue-card__head
  display: flex
  align-items: flex-start
  justify-content: space-between
  gap: 10px

.queue-card__title
  display: flex
  flex-wrap: wrap
  align-items: baseline
  gap: 8px
  min-width: 0

  strong
    font-size: 15px
    color: var(--color-text)

.queue-card__date
  font-size: 12px
  color: var(--color-text-secondary)
  font-variant-numeric: tabular-nums

.queue-card__items
  display: flex
  flex-direction: column
  gap: 4px
  margin: 10px 0 0
  padding: 0
  list-style: none

.queue-item
  display: flex
  align-items: baseline
  justify-content: space-between
  gap: 10px
  font-size: 13.5px

.queue-item__name
  min-width: 0
  color: var(--color-text)

.queue-item__qty
  flex-shrink: 0
  color: var(--color-text-secondary)
  font-variant-numeric: tabular-nums

.queue-card__rows
  display: flex
  flex-direction: column
  gap: 3px
  margin: 10px 0 0

.queue-row
  display: flex
  align-items: baseline
  justify-content: space-between
  gap: 10px
  font-size: 13px

  dt
    flex-shrink: 0
    color: var(--color-text-secondary)

  dd
    margin: 0
    min-width: 0
    text-align: right
    color: var(--color-text)
</style>
