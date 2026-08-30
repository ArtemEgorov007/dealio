<script setup lang="ts">
import {fetchMySupplyRequests} from '~/utils/erp-supply'
import type {ErpSupplyRequest} from '~/utils/erp-supply'

definePageMeta({layout: 'erp'})
useSeoMeta({title: 'Ваши заявки | ERP'})

const requests = ref<ErpSupplyRequest[]>([])
const isLoading = ref(true)
const loadError = ref('')

const load = async () => {
    isLoading.value = true
    loadError.value = ''
    try {
        requests.value = await fetchMySupplyRequests()
    } catch (error) {
        loadError.value = errorMessage(error, 'Не удалось загрузить заявки')
    } finally {
        isLoading.value = false
    }
}

/** Статус красим по смыслу: ожидание — нейтрально, отказ — тревожно. */
const statusTone = (status: string): 'ok' | 'warn' | 'crit' | 'neutral' => {
    const value = status.toLowerCase()
    if (value.includes('отмен') || value.includes('отклон')) return 'crit'
    if (value.includes('согласован') || value.includes('получен')) return 'ok'
    if (value.includes('ожидает')) return 'warn'
    return 'neutral'
}

const formatDate = (value: string): string => {
    // С сервера приходит YYYY-MM-DD; показываем привычное ДД.ММ.ГГГГ.
    const parts = value.split('-')
    return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : value
}

onMounted(load)
</script>

<template>
  <ErpScreen
      title="Ваши заявки"
      subtitle="Заявки на снабжение"
      icon="heroicons:clipboard-document-list"
      :shift-link="{to: '/supply', label: 'Снабжение', icon: 'heroicons:chevron-left', iconSize: 13}"
  >
    <ErpEmptyState v-if="isLoading" loading>
      <span>Загрузка…</span>
    </ErpEmptyState>

    <ErpEmptyState v-else-if="loadError" error>
      <p>{{ loadError }}</p>
      <UiButton variant="outline" @click="load">Повторить</UiButton>
    </ErpEmptyState>

    <ErpEmptyState v-else-if="requests.length === 0">
      <p>Вы ещё не создавали заявок</p>
      <UiButton variant="outline" @click="$router.push('/supply')">Создать заявку</UiButton>
    </ErpEmptyState>

    <div v-else class="req-list">
      <article v-for="request in requests" :key="request.requestCode" class="req-card">
        <header class="req-card__head">
          <div class="req-card__title">
            <strong>{{ request.requestCode }}</strong>
            <span class="req-card__date">{{ formatDate(request.requestedAt) }}</span>
          </div>
          <span class="req-card__status" :class="`req-card__status--${statusTone(request.status)}`">
            {{ request.status }}
          </span>
        </header>

        <ul class="req-card__items">
          <li v-for="item in request.items" :key="item.name" class="req-item">
            <span class="req-item__name">{{ item.name }}</span>
            <span class="req-item__qty">{{ item.quantity }} {{ item.unit }}</span>
          </li>
        </ul>

        <p v-if="request.invoice" class="req-card__invoice">Счёт: {{ request.invoice }}</p>
      </article>
    </div>
  </ErpScreen>
</template>

<style scoped lang="sass">
.req-list
  display: flex
  flex-direction: column
  gap: 10px

.req-card
  background: var(--color-card-bg)
  border-radius: 14px
  padding: 12px 14px
  box-shadow: var(--erp-shadow-card, 0 1px 0 rgba(0, 0, 0, 0.04))

.req-card__head
  display: flex
  align-items: flex-start
  justify-content: space-between
  gap: 10px
  margin-bottom: 8px

.req-card__title
  display: flex
  flex-direction: column
  gap: 2px
  min-width: 0

  strong
    font-size: 15px
    color: var(--color-text)

.req-card__date
  font-size: 11.5px
  color: var(--color-text-secondary)

.req-card__status
  flex-shrink: 0
  padding: 3px 9px
  border-radius: var(--radius-full)
  font-size: 11px
  font-weight: 700
  white-space: nowrap

  &--warn
    background: rgba(231, 146, 11, 0.12)
    color: var(--erp-warn, #E7920B)

  &--ok
    background: rgba(47, 180, 99, 0.12)
    color: var(--erp-ok, #2FB463)

  &--crit
    background: rgba(217, 45, 32, 0.12)
    color: #d92d20

  &--neutral
    background: var(--color-primary-light)
    color: var(--color-primary)

.req-card__items
  display: flex
  flex-direction: column
  gap: 4px
  margin: 0
  padding: 0
  list-style: none

.req-item
  display: flex
  align-items: baseline
  justify-content: space-between
  gap: 10px
  font-size: 13.5px

.req-item__name
  color: var(--color-text)
  min-width: 0

.req-item__qty
  flex-shrink: 0
  color: var(--color-text-secondary)
  font-variant-numeric: tabular-nums

.req-card__invoice
  margin: 8px 0 0
  font-size: 12px
  color: var(--color-text-secondary)
</style>
