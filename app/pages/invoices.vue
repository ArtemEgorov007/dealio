<script setup lang="ts">
import {fetchInvoices, invoiceFileUrl} from '~/utils/erp-supply'
import type {ErpInvoice} from '~/utils/erp-supply'

definePageMeta({layout: 'erp'})
useSeoMeta({title: 'Все счета | ERP'})

const invoices = ref<ErpInvoice[]>([])
const isLoading = ref(true)
const loadError = ref('')

const load = async () => {
    isLoading.value = true
    loadError.value = ''
    try {
        invoices.value = await fetchInvoices()
    } catch (error) {
        loadError.value = errorMessage(error, 'Не удалось загрузить счета')
    } finally {
        isLoading.value = false
    }
}

/** Статус красим по смыслу: отмена — тревожно, согласован — спокойно. */
const statusTone = (status: string): 'ok' | 'warn' | 'crit' | 'neutral' => {
    const value = status.toLowerCase()
    if (value.includes('отмен')) return 'crit'
    if (value.includes('согласован')) return 'ok'
    if (value.includes('ожидает')) return 'warn'
    return 'neutral'
}

const money = new Intl.NumberFormat('ru-RU', {style: 'currency', currency: 'RUB', maximumFractionDigits: 2})

const formatDate = (value: string): string => {
    const parts = value.split('-')
    return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : value
}

onMounted(load)
</script>

<template>
  <ErpScreen
      title="Все счета"
      subtitle="Направленные на согласование"
      icon="heroicons:document-text"
      :shift-link="{to: '/supply-work', label: 'Назад', icon: 'heroicons:chevron-left', iconSize: 13}"
  >
    <ErpEmptyState v-if="isLoading" loading>
      <span>Загрузка…</span>
    </ErpEmptyState>

    <ErpEmptyState v-else-if="loadError" error>
      <p>{{ loadError }}</p>
      <UiButton variant="outline" @click="load">Повторить</UiButton>
    </ErpEmptyState>

    <ErpEmptyState v-else-if="invoices.length === 0">
      <p>Счетов пока нет</p>
      <UiButton variant="outline" @click="$router.push('/invoice-new')">Завести счёт</UiButton>
    </ErpEmptyState>

    <div v-else class="inv-list">
      <article v-for="item in invoices" :key="item.id" class="inv-card">
        <header class="inv-card__head">
          <div class="inv-card__title">
            <strong>Счёт {{ item.invoice }}</strong>
            <span v-if="item.requestCode" class="inv-card__request">Заявка {{ item.requestCode }}</span>
          </div>
          <span class="inv-card__status" :class="`inv-card__status--${statusTone(item.status)}`">
            {{ item.status || '—' }}
          </span>
        </header>

        <p class="inv-card__amount">{{ money.format(item.amount) }}</p>

        <dl class="inv-card__rows">
          <div v-if="item.platform || item.department" class="inv-row">
            <dt>Площадка</dt>
            <dd>{{ [item.platform, item.department].filter(Boolean).join(' · ') }}</dd>
          </div>
          <div v-if="item.contract" class="inv-row">
            <dt>Договор</dt>
            <dd>{{ item.customer ? `${item.contract} · ${item.customer}` : item.contract }}</dd>
          </div>
          <div v-if="item.authorFio" class="inv-row">
            <dt>Завёл</dt>
            <dd>{{ item.authorFio }}</dd>
          </div>
          <div v-if="item.approverFio" class="inv-row">
            <dt>Согласующий</dt>
            <dd>{{ item.approverFio }}</dd>
          </div>
          <div v-if="item.approvedRoAt" class="inv-row">
            <dt>Согласовано РО</dt>
            <dd>{{ item.approverFio ? `${item.approverFio}, ` : '' }}{{ formatDate(item.approvedRoAt) }}</dd>
          </div>
          <div v-if="item.approvedGdAt" class="inv-row">
            <dt>Согласовано ГД</dt>
            <dd>{{ item.approvedGdFio ? `${item.approvedGdFio}, ` : '' }}{{ formatDate(item.approvedGdAt) }}</dd>
          </div>
          <div v-if="item.cancelledAt" class="inv-row">
            <dt>Отклонён</dt>
            <dd>{{ item.rejectedByFio ? `${item.rejectedByFio}, ` : '' }}{{ formatDate(item.cancelledAt) }}</dd>
          </div>
        </dl>

        <a v-if="item.hasFile" :href="invoiceFileUrl(item.id)" target="_blank" rel="noopener" class="inv-card__file">
          <Icon name="heroicons:document-text" size="15"/>
          <span>Открыть PDF</span>
        </a>
      </article>
    </div>
  </ErpScreen>
</template>

<style scoped lang="sass">
.inv-list
  display: flex
  flex-direction: column
  gap: 10px

.inv-card
  background: var(--color-card-bg)
  border-radius: 14px
  padding: 12px 14px
  box-shadow: var(--erp-shadow-card, 0 1px 0 rgba(0, 0, 0, 0.04))

.inv-card__head
  display: flex
  align-items: flex-start
  justify-content: space-between
  gap: 10px

.inv-card__title
  display: flex
  flex-direction: column
  gap: 2px
  min-width: 0

  strong
    font-size: 15px
    color: var(--color-text)

.inv-card__request
  font-size: 11.5px
  color: var(--color-text-secondary)

.inv-card__status
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

.inv-card__amount
  margin: 8px 0 6px
  font-size: 20px
  font-weight: 700
  color: var(--color-text)
  font-variant-numeric: tabular-nums

.inv-card__rows
  display: flex
  flex-direction: column
  gap: 3px
  margin: 0

.inv-row
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

.inv-card__file
  display: inline-flex
  align-items: center
  gap: 6px
  margin-top: 10px
  padding: 7px 11px
  border-radius: var(--radius-full)
  background: var(--color-primary-light)
  color: var(--color-primary)
  font-size: 12.5px
  font-weight: 600
  text-decoration: none
</style>
