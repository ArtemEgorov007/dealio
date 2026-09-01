<script setup lang="ts">
import {contractMoney, fetchContract} from '~/utils/erp-contracts'
import type {ErpContract, ErpContractRate} from '~/utils/erp-contracts'

definePageMeta({layout: 'erp'})
useSeoMeta({title: 'Договор | ERP'})

const route = useRoute()
const router = useRouter()

const contractId = computed(() => Number(route.query.id ?? 0))
const contract = ref<ErpContract | null>(null)
const rates = ref<ErpContractRate[]>([])
const isLoading = ref(true)
const loadError = ref('')

const load = async () => {
    if (!contractId.value) {
        loadError.value = 'Договор не выбран'
        isLoading.value = false
        return
    }
    isLoading.value = true
    loadError.value = ''
    try {
        const data = await fetchContract(contractId.value)
        contract.value = data.contract
        rates.value = data.rates
    } catch (error) {
        loadError.value = errorMessage(error, 'Не удалось загрузить договор')
    } finally {
        isLoading.value = false
    }
}

// Порядок как в ТЗ. Аванс, СМР, ИД и КС пока нулевые: их источники ещё не
// заведены, и строки стоят на месте, чтобы было видно, чего ждём.
const summaryRows = computed(() => {
    const s = contract.value?.summary
    if (!s) return []
    return [
        {label: 'Предельная сумма', value: s.limitAmount, pending: false},
        {label: 'Аванс', value: s.advance, pending: true},
        {label: 'СМР', value: s.construction, pending: true},
        {label: 'ИД', value: s.executiveDocs, pending: true},
        {label: 'КС', value: s.acts, pending: true},
    ]
})

const priceText = (value: number | null): string => value === null ? '—' : contractMoney.format(value)

onMounted(load)
</script>

<template>
  <ErpScreen
      :title="contract?.internalNumber || 'Договор'"
      :subtitle="contract?.customer || 'Карточка договора'"
      icon="heroicons:document-duplicate"
      :shift-link="{to: '/contracts', label: 'Договоры', icon: 'heroicons:chevron-left', iconSize: 13}"
  >
    <ErpEmptyState v-if="isLoading" loading>
      <span>Загрузка…</span>
    </ErpEmptyState>

    <ErpEmptyState v-else-if="loadError" error>
      <p>{{ loadError }}</p>
      <UiButton variant="outline" @click="router.push('/contracts')">К списку договоров</UiButton>
    </ErpEmptyState>

    <template v-else-if="contract">
      <ErpSectionLabel>Сводка</ErpSectionLabel>
      <dl class="sum-card">
        <div v-for="row in summaryRows" :key="row.label" class="sum-row">
          <dt>{{ row.label }}</dt>
          <dd :class="{'sum-row__pending': row.pending}">
            {{ contractMoney.format(row.value) }}
          </dd>
        </div>
      </dl>
      <p class="sum-note">Аванс, СМР, ИД и КС появятся, когда заведём их учёт</p>

      <ErpSectionLabel>Договор</ErpSectionLabel>
      <dl class="sum-card">
        <div class="sum-row">
          <dt>Номер</dt>
          <dd>{{ contract.contractNumber }}</dd>
        </div>
        <div class="sum-row sum-row--stacked">
          <dt>Предмет</dt>
          <dd>{{ contract.subject }}</dd>
        </div>
      </dl>

      <ErpSectionLabel>Расценки</ErpSectionLabel>
      <ErpEmptyState v-if="rates.length === 0">
        <p>Расценок пока нет</p>
      </ErpEmptyState>
      <div v-else class="rate-list">
        <article v-for="(rate, index) in rates" :key="rate.id ?? index" class="rate-card">
          <p class="rate-card__params">
            {{ [rate.param1, rate.param2, rate.param3, rate.param4].filter(Boolean).join(' · ') || '—' }}
          </p>
          <div class="rate-card__prices">
            <span><span class="rate-card__unit">за м²</span> {{ priceText(rate.priceM2) }}</span>
            <span><span class="rate-card__unit">за тн</span> {{ priceText(rate.priceTon) }}</span>
          </div>
        </article>
      </div>
    </template>

    <template #footer>
      <UiButton
          v-if="contract"
          block
          @click="router.push({path: '/contract-rates', query: {id: contract.id}})"
      >
        {{ rates.length ? 'Изменить расценки' : 'Добавить расценки' }}
      </UiButton>
    </template>
  </ErpScreen>
</template>

<style scoped lang="sass">
.sum-card
  display: flex
  flex-direction: column
  margin: 0
  background: var(--color-card-bg)
  border-radius: 14px
  box-shadow: var(--erp-shadow-card, 0 1px 0 rgba(0, 0, 0, 0.04))
  overflow: hidden

.sum-row
  display: flex
  align-items: baseline
  justify-content: space-between
  gap: 12px
  padding: 10px 14px
  border-bottom: 0.5px solid rgba(60, 60, 67, 0.12)

  &:last-child
    border-bottom: none

  dt
    flex-shrink: 0
    font-size: 13px
    color: var(--color-text-secondary)

  dd
    margin: 0
    min-width: 0
    text-align: right
    font-size: 14px
    font-weight: 600
    color: var(--color-text)
    font-variant-numeric: tabular-nums

.sum-row--stacked
  flex-direction: column
  align-items: flex-start

  dd
    text-align: left
    font-weight: 400
    font-size: 13.5px

.sum-row__pending
  color: var(--color-text-secondary)
  font-weight: 400

.sum-note
  margin: 6px 0 0 12px
  font-size: 11px
  color: var(--color-text-secondary)

.rate-list
  display: flex
  flex-direction: column
  gap: 8px

.rate-card
  padding: 11px 14px
  background: var(--color-card-bg)
  border-radius: 12px
  box-shadow: var(--erp-shadow-card, 0 1px 0 rgba(0, 0, 0, 0.04))

.rate-card__params
  margin: 0 0 6px
  font-size: 13.5px
  color: var(--color-text)

.rate-card__prices
  display: flex
  gap: 16px
  font-size: 13px
  color: var(--color-text)
  font-variant-numeric: tabular-nums

.rate-card__unit
  margin-right: 4px
  font-size: 11px
  color: var(--color-text-secondary)
</style>
