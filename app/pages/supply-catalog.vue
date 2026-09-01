<script setup lang="ts">
import {fetchInvoiceFormData, fetchSupplyCatalog, setCatalogItemUnit} from '~/utils/erp-supply'
import type {ErpSupplyCatalogItem} from '~/utils/erp-supply'
import {filterByQuery} from '~/utils/text-search'
import {useAppToast} from '~/composables/useAppToast'

definePageMeta({layout: 'erp'})
useSeoMeta({title: 'Справочник ТМЦ | ERP'})

const {showError} = useAppToast()

const items = ref<ErpSupplyCatalogItem[]>([])
const units = ref<string[]>([])
const isLoading = ref(true)
const loadError = ref('')
const query = ref('')

// Редактируем по одной позиции: 300 полей ввода на экране — это и тормоза,
// и промахи пальцем.
const editingId = ref<number | null>(null)
const draftUnit = ref('')
const savingId = ref<number | null>(null)

const load = async () => {
    isLoading.value = true
    loadError.value = ''
    try {
        const [catalog, form] = await Promise.all([fetchSupplyCatalog(), fetchInvoiceFormData()])
        items.value = catalog
        units.value = form.units
    } catch (error) {
        loadError.value = errorMessage(error, 'Не удалось загрузить справочник')
    } finally {
        isLoading.value = false
    }
}

const found = computed(() =>
    filterByQuery(items.value, query.value, item => `${item.name} ${item.category} ${item.unit}`),
)

const filledCount = computed(() => items.value.filter(item => item.unit !== '').length)

const startEdit = (item: ErpSupplyCatalogItem) => {
    editingId.value = item.id
    draftUnit.value = item.unit
}

const cancelEdit = () => {
    editingId.value = null
    draftUnit.value = ''
}

const save = async (item: ErpSupplyCatalogItem) => {
    const value = draftUnit.value.trim()
    if (value === item.unit) {
        cancelEdit()
        return
    }
    savingId.value = item.id
    try {
        const result = await setCatalogItemUnit(item.id, value)
        item.unit = result.unit
        cancelEdit()
    } catch (error) {
        showError(error, 'Не удалось сохранить единицу измерения')
    } finally {
        savingId.value = null
    }
}

const pickUnit = (item: ErpSupplyCatalogItem, unit: string) => {
    draftUnit.value = unit
    void save(item)
}

onMounted(load)
</script>

<template>
  <ErpScreen
      title="Справочник ТМЦ"
      subtitle="Номенклатура склада"
      icon="heroicons:book-open"
      :shift-link="{to: '/supply-work', label: 'Назад', icon: 'heroicons:chevron-left', iconSize: 13}"
  >
    <ErpEmptyState v-if="isLoading" loading>
      <span>Загрузка…</span>
    </ErpEmptyState>

    <ErpEmptyState v-else-if="loadError" error>
      <p>{{ loadError }}</p>
      <UiButton variant="outline" @click="load">Повторить</UiButton>
    </ErpEmptyState>

    <template v-else>
      <input
          v-model="query"
          type="search"
          class="tmc-search"
          placeholder="Поиск по названию, категории, единице"
          autocomplete="off"
      >

      <p class="tmc-count">
        {{ found.length }} из {{ items.length }} · единица проставлена у {{ filledCount }}
      </p>

      <ErpEmptyState v-if="found.length === 0">
        <p>Ничего не нашлось</p>
        <UiButton variant="outline" @click="query = ''">Показать всё</UiButton>
      </ErpEmptyState>

      <div v-else class="tmc-table">
        <div class="tmc-head">
          <span>Категория</span>
          <span>Наименование</span>
          <span class="tmc-head__unit">Ед. изм.</span>
        </div>

        <div v-for="item in found" :key="item.id" class="tmc-row">
          <span class="tmc-cell tmc-cell--category">{{ item.category || '—' }}</span>
          <span class="tmc-cell tmc-cell--name">{{ item.name }}</span>

          <template v-if="editingId === item.id">
            <div class="tmc-edit">
              <input
                  v-model="draftUnit"
                  type="text"
                  class="tmc-edit__input"
                  placeholder="ед."
                  maxlength="32"
                  autocomplete="off"
                  @keydown.enter.prevent="save(item)"
                  @keydown.esc="cancelEdit"
              >
              <button
                  type="button"
                  class="tmc-edit__save"
                  :disabled="savingId === item.id"
                  aria-label="Сохранить единицу"
                  @click="save(item)"
              >
                <Icon name="heroicons:check" size="15"/>
              </button>
            </div>
          </template>
          <button
              v-else
              type="button"
              class="tmc-cell tmc-cell--unit"
              :class="{'tmc-cell--empty': !item.unit}"
              @click="startEdit(item)"
          >
            {{ item.unit || '—' }}
          </button>

          <div v-if="editingId === item.id" class="tmc-units">
            <button
                v-for="unit in units"
                :key="unit"
                type="button"
                class="tmc-units__chip"
                @click="pickUnit(item, unit)"
            >
              {{ unit }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </ErpScreen>
</template>

<style scoped lang="sass">
.tmc-search
  width: 100%
  padding: 11px 12px
  border: none
  border-radius: 12px
  background: var(--color-card-bg)
  box-shadow: var(--erp-shadow-card, 0 1px 0 rgba(0, 0, 0, 0.04))
  color: var(--color-text)
  // Размер шрифта не задаём: erp-theme.css держит поля на 16px против зума iOS.

  &::placeholder
    color: var(--color-text-secondary)
    font-size: 13px

  &:focus
    outline: 2px solid var(--color-primary)
    outline-offset: -1px

.tmc-count
  margin: 6px 0 0 12px
  font-size: 11.5px
  color: var(--color-text-secondary)
  font-variant-numeric: tabular-nums

.tmc-table
  background: var(--color-card-bg)
  border-radius: 14px
  box-shadow: var(--erp-shadow-card, 0 1px 0 rgba(0, 0, 0, 0.04))
  overflow: hidden

.tmc-head, .tmc-row
  display: grid
  // Категория узкая, наименование забирает остаток, единица — минимум под
  // «компл.». Так три колонки читаются даже на 390px.
  grid-template-columns: 88px 1fr 62px
  gap: 8px
  align-items: center
  padding: 9px 12px

.tmc-head
  border-bottom: 0.5px solid rgba(60, 60, 67, 0.18)
  font-size: 10.5px
  font-weight: 700
  letter-spacing: 0.3px
  text-transform: uppercase
  color: var(--color-text-secondary)

.tmc-head__unit
  text-align: right

.tmc-row
  border-bottom: 0.5px solid rgba(60, 60, 67, 0.12)

  &:last-child
    border-bottom: none

.tmc-cell
  min-width: 0
  font-size: 13px

.tmc-cell--category
  color: var(--color-text-secondary)
  overflow: hidden
  text-overflow: ellipsis

.tmc-cell--name
  color: var(--color-text)

.tmc-cell--unit
  padding: 4px 0
  border: none
  background: none
  text-align: right
  font-weight: 600
  color: var(--color-primary)
  cursor: pointer

.tmc-cell--empty
  color: var(--color-text-secondary)
  font-weight: 400

.tmc-edit
  display: flex
  align-items: center
  gap: 4px

.tmc-edit__input
  width: 100%
  min-width: 0
  padding: 5px 7px
  border: none
  border-radius: 8px
  background: var(--color-primary-light)
  color: var(--color-text)
  text-align: right

  &:focus
    outline: 2px solid var(--color-primary)
    outline-offset: -1px

.tmc-edit__save
  flex-shrink: 0
  border: none
  background: none
  color: var(--color-primary)
  cursor: pointer

.tmc-units
  grid-column: 1 / -1
  display: flex
  flex-wrap: wrap
  gap: 6px
  padding-top: 8px

.tmc-units__chip
  padding: 5px 10px
  border: none
  border-radius: var(--radius-full)
  background: var(--color-primary-light)
  color: var(--color-primary)
  font-size: 12.5px
  font-weight: 600
  cursor: pointer
</style>
