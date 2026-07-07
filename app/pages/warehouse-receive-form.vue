<script setup lang="ts">
import {receiveWarehouseItem} from '~/utils/warehouse-sheets'
import {WAREHOUSE_UNITS, WAREHOUSE_TYPES} from '~~/types/warehouse.types'
import {useErpEmployeeStore} from '~~/store/erp-employee.store'
import {useErpSessionStore} from '~~/store/erp-session.store'
import {useAppToast} from '~/composables/useAppToast'

definePageMeta({layout: 'erp'})
useSeoMeta({title: 'Приём товара | ERP'})

const employeeStore = useErpEmployeeStore()
const sessionStore = useErpSessionStore()
const router = useRouter()
const {showSuccess, showError} = useAppToast()

const itemName = computed(() => sessionStore.warehouseReceiveItem ?? '')

const qty = ref('')
const unit = ref<typeof WAREHOUSE_UNITS[number] | null>(null)
const cell = ref('')
const type = ref<typeof WAREHOUSE_TYPES[number]>('Новый')
const isLoading = ref(false)

const qtyError = computed(() => {
    const trimmed = qty.value.trim()
    if (!trimmed) return ''
    return /^\d+$/.test(trimmed) ? '' : 'Только целые числа'
})

const canSubmit = computed(() =>
    !isLoading.value
    && qty.value.trim() !== ''
    && !qtyError.value
    && unit.value !== null
    && cell.value.trim() !== '',
)

const submit = async () => {
    if (!canSubmit.value) return

    isLoading.value = true

    try {
        await receiveWarehouseItem({
            platform: employeeStore.platform,
            cell: cell.value.trim(),
            name: itemName.value,
            type: type.value,
            qty: parseInt(qty.value, 10),
            unit: unit.value!,
            fio: employeeStore.fio,
        })
        showSuccess('Товар принят', itemName.value)
        sessionStore.clearWarehouseReceiveItem()
        router.push('/warehouse-receive')
    } catch (error) {
        showError(error, 'Не удалось оформить приём')
    } finally {
        isLoading.value = false
    }
}

const goBack = () => router.push('/warehouse-receive')

onMounted(() => {
    if (!sessionStore.hasWarehouseReceiveItem) {
        router.replace('/warehouse-receive')
    }
})
</script>

<template>
  <ErpScreen title="Приём товара" icon="heroicons:arrow-down-tray">
    <div class="wh-item-card">
      <span class="wh-item-card__label">Товар</span>
      <span class="wh-item-card__value">{{ itemName }}</span>
    </div>

    <div class="wh-section">
      <p class="wh-section__title">Единица измерения</p>
      <div class="wh-chip-row">
        <button
            v-for="opt in WAREHOUSE_UNITS"
            :key="opt"
            type="button"
            class="wh-chip"
            :class="{ 'wh-chip--active': unit === opt }"
            @click="unit = opt"
        >
          {{ opt }}
        </button>
      </div>
    </div>

    <div class="wh-section">
      <p class="wh-section__title">Тип</p>
      <div class="wh-toggle-row">
        <button
            v-for="opt in WAREHOUSE_TYPES"
            :key="opt"
            type="button"
            class="wh-toggle-opt"
            :class="{ 'wh-toggle-opt--active': type === opt }"
            @click="type = opt"
        >
          {{ opt }}
        </button>
      </div>
    </div>

    <UiInput
        id="receive-qty"
        v-model="qty"
        label="Количество"
        inputmode="numeric"
        :error="qtyError"
    />
    <UiInput
        id="receive-cell"
        v-model="cell"
        label="Ячейка хранения"
    />

    <template #footer>
      <UiButton
          block
          :loading="isLoading"
          :disabled="!canSubmit"
          @click="submit"
      >
        Принять
      </UiButton>
      <UiButton block variant="ghost" @click="goBack">
        Назад
      </UiButton>
    </template>
  </ErpScreen>
</template>

<style scoped lang="sass">
.wh-item-card
  display: flex
  align-items: center
  gap: var(--spacing-3)
  padding: 14px 16px
  border-radius: 13px
  background-color: var(--color-card-bg)
  box-shadow: var(--erp-shadow-card, 0 1px 0 rgba(0, 0, 0, 0.04))

.wh-item-card__label
  flex-shrink: 0
  font-size: 11px
  font-weight: 600
  text-transform: uppercase
  letter-spacing: 0.5px
  color: var(--color-text-secondary)

.wh-item-card__value
  flex: 1
  min-width: 0
  font-size: var(--font-size-base)
  font-weight: 500
  line-height: 1.4
  color: var(--color-text)

.wh-section
  display: flex
  flex-direction: column
  gap: var(--spacing-2)

.wh-section__title
  margin: 0 0 0 4px
  font-size: 13px
  font-weight: 500
  color: var(--color-text-secondary)
  text-transform: uppercase
  letter-spacing: 0.3px

.wh-chip-row
  display: flex
  gap: 6px
  flex-wrap: wrap

.wh-chip
  padding: 7px 13px
  border-radius: 999px
  font-size: 13px
  font-weight: 600
  background: var(--color-card-bg)
  border: 1px solid var(--color-border)
  color: var(--color-text-secondary)
  cursor: pointer

  &--active
    background: var(--color-primary)
    border-color: var(--color-primary)
    color: #fff

.wh-toggle-row
  display: flex
  gap: 2px
  background: rgba(118, 118, 128, 0.12)
  border-radius: 9px
  padding: 2px

.wh-toggle-opt
  flex: 1
  padding: 7px 8px
  border: none
  border-radius: 7px
  background: transparent
  color: var(--color-text)
  font-size: var(--font-size-sm)
  font-weight: 500
  cursor: pointer

  &--active
    background: #FFFFFF
    color: var(--color-text)
    font-weight: 600
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12), 0 0.5px 1px rgba(0, 0, 0, 0.06)
</style>
