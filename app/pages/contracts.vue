<script setup lang="ts">
import {contractMoney, fetchContracts} from '~/utils/erp-contracts'
import type {ErpContract} from '~/utils/erp-contracts'

definePageMeta({layout: 'erp'})
useSeoMeta({title: 'Договоры | ERP'})

const router = useRouter()
const contracts = ref<ErpContract[]>([])
const isLoading = ref(true)
const loadError = ref('')

const load = async () => {
    isLoading.value = true
    loadError.value = ''
    try {
        contracts.value = await fetchContracts()
    } catch (error) {
        loadError.value = errorMessage(error, 'Не удалось загрузить договоры')
    } finally {
        isLoading.value = false
    }
}

onMounted(load)
</script>

<template>
  <ErpScreen title="Договоры" subtitle="Справочник договоров" icon="heroicons:document-duplicate">
    <ErpEmptyState v-if="isLoading" loading>
      <span>Загрузка…</span>
    </ErpEmptyState>

    <ErpEmptyState v-else-if="loadError" error>
      <p>{{ loadError }}</p>
      <UiButton variant="outline" @click="load">Повторить</UiButton>
    </ErpEmptyState>

    <ErpEmptyState v-else-if="contracts.length === 0">
      <p>Договоров пока нет</p>
      <UiButton variant="outline" @click="router.push('/contract-new')">Добавить договор</UiButton>
    </ErpEmptyState>

    <div v-else class="ctr-list">
      <button
          v-for="item in contracts"
          :key="item.id"
          type="button"
          class="ctr-card"
          @click="router.push({path: '/contract', query: {id: item.id}})"
      >
        <span class="ctr-card__head">
          <strong class="ctr-card__number">{{ item.internalNumber }}</strong>
          <span class="ctr-card__amount">{{ contractMoney.format(item.summary.limitAmount) }}</span>
        </span>
        <span class="ctr-card__customer">{{ item.customer }}</span>
        <span class="ctr-card__subject">{{ item.subject }}</span>
        <span class="ctr-card__foot">
          <span>Договор {{ item.contractNumber }}</span>
          <span>{{ item.ratesCount }} расценок</span>
        </span>
      </button>
    </div>

    <template #footer>
      <UiButton block @click="router.push('/contract-new')">Добавить договор</UiButton>
    </template>
  </ErpScreen>
</template>

<style scoped lang="sass">
.ctr-list
  display: flex
  flex-direction: column
  gap: 10px

.ctr-card
  display: flex
  flex-direction: column
  gap: 3px
  width: 100%
  padding: 12px 14px
  border: none
  border-radius: 14px
  background: var(--color-card-bg)
  box-shadow: var(--erp-shadow-card, 0 1px 0 rgba(0, 0, 0, 0.04))
  text-align: left
  cursor: pointer

.ctr-card__head
  display: flex
  align-items: baseline
  justify-content: space-between
  gap: 10px

.ctr-card__number
  font-size: 15px
  color: var(--color-text)

.ctr-card__amount
  flex-shrink: 0
  font-size: 13.5px
  font-weight: 600
  color: var(--color-primary)
  font-variant-numeric: tabular-nums

.ctr-card__customer
  font-size: 13.5px
  color: var(--color-text)

.ctr-card__subject
  font-size: 12.5px
  color: var(--color-text-secondary)
  overflow: hidden
  display: -webkit-box
  -webkit-line-clamp: 2
  -webkit-box-orient: vertical

.ctr-card__foot
  display: flex
  justify-content: space-between
  gap: 10px
  margin-top: 4px
  font-size: 11.5px
  color: var(--color-text-secondary)
</style>
