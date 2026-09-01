<script setup lang="ts">
import {
    createCatalogItem,
    deleteCatalogItem,
    fetchInvoiceFormData,
    fetchItemStock,
    fetchSupplyCatalog,
    updateCatalogItem,
} from '~/utils/erp-supply'
import type {ErpItemStock, ErpSupplyCatalogItem} from '~/utils/erp-supply'
import {filterByQuery} from '~/utils/text-search'
import {useAppToast} from '~/composables/useAppToast'

definePageMeta({layout: 'erp'})
useSeoMeta({title: 'Справочник ТМЦ | ERP'})

const {showSuccess, showError} = useAppToast()

const items = ref<ErpSupplyCatalogItem[]>([])
const units = ref<string[]>([])
const isLoading = ref(true)
const loadError = ref('')
const query = ref('')

// Два режима одного экрана. Просмотр: нажатие на позицию показывает остатки.
// Правка: нажатие открывает поля, справа появляется удаление, внизу «Добавить».
const isEditing = ref(false)
const isSaving = ref(false)

// Правка идёт по одной позиции: 300 открытых форм на экране — это и тормоза,
// и промахи пальцем.
const editingId = ref<number | null>(null)
const draft = ref({name: '', category: '', unit: ''})
const editForm = useTemplateRef<HTMLElement[]>('editForm')

// Остатки открываются под нажатой позицией: отдельный экран ради трёх строк
// уводил бы из справочника и обратно.
const stockId = ref<number | null>(null)
const stock = ref<ErpItemStock | null>(null)
const isStockLoading = ref(false)

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

const closeAll = () => {
    editingId.value = null
    stockId.value = null
    stock.value = null
}

const toggleEditing = () => {
    isEditing.value = !isEditing.value
    closeAll()
}

/** Нажатие на позицию: в правке — форма, в просмотре — остатки. */
const onItemTap = async (item: ErpSupplyCatalogItem) => {
    if (isEditing.value) {
        if (editingId.value === item.id) {
            editingId.value = null
            return
        }
        editingId.value = item.id
        draft.value = {name: item.name, category: item.category, unit: item.unit}
        // Позиция может стоять в конце длинного списка: без прокрутки форма
        // открывается за нижним краем экрана, и выглядит это как «ничего не
        // произошло».
        await nextTick()
        editForm.value[0]?.scrollIntoView({block: 'nearest', behavior: 'smooth'})
        return
    }

    if (stockId.value === item.id) {
        closeAll()
        return
    }
    stockId.value = item.id
    stock.value = null
    isStockLoading.value = true
    try {
        stock.value = await fetchItemStock(item.id)
    } catch (error) {
        showError(error, 'Не удалось загрузить остатки')
        stockId.value = null
    } finally {
        isStockLoading.value = false
    }
}

const saveDraft = async (item: ErpSupplyCatalogItem) => {
    const name = draft.value.name.trim()
    if (!name) {
        showError(null, 'Укажите наименование')
        return
    }
    isSaving.value = true
    try {
        const saved = await updateCatalogItem(item.id, {
            name,
            category: draft.value.category.trim(),
            unit: draft.value.unit.trim(),
        })
        Object.assign(item, saved)
        editingId.value = null
    } catch (error) {
        showError(error, 'Не удалось сохранить позицию')
    } finally {
        isSaving.value = false
    }
}

const removeItem = async (item: ErpSupplyCatalogItem) => {
    isSaving.value = true
    try {
        await deleteCatalogItem(item.id)
        items.value = items.value.filter(row => row.id !== item.id)
        if (editingId.value === item.id) editingId.value = null
        showSuccess('Позиция удалена', item.name)
    } catch (error) {
        showError(error, 'Не удалось удалить позицию')
    } finally {
        isSaving.value = false
    }
}

// Новая позиция
const isAdding = ref(false)
const newItem = ref({name: '', category: '', unit: ''})

const startAdding = () => {
    closeAll()
    isAdding.value = true
    newItem.value = {name: '', category: '', unit: ''}
}

const addItem = async () => {
    const name = newItem.value.name.trim()
    if (!name) {
        showError(null, 'Укажите наименование')
        return
    }
    isSaving.value = true
    try {
        const created = await createCatalogItem({
            name,
            category: newItem.value.category.trim(),
            unit: newItem.value.unit.trim(),
        })
        items.value = [...items.value, created]
        isAdding.value = false
        showSuccess('Позиция добавлена', created.name)
    } catch (error) {
        showError(error, 'Не удалось добавить позицию')
    } finally {
        isSaving.value = false
    }
}

const balance = new Intl.NumberFormat('ru-RU', {maximumFractionDigits: 3})

onMounted(load)
</script>

<template>
  <ErpScreen
      title="Справочник ТМЦ"
      subtitle="Номенклатура склада"
      icon="heroicons:book-open"
      :shift-link="{
          label: isEditing ? 'Готово' : 'Изменить',
          icon: isEditing ? 'heroicons:check' : 'heroicons:pencil-square',
          iconSize: 13,
          onClick: toggleEditing,
      }"
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

      <section v-if="isAdding" class="tmc-new">
        <ErpSectionLabel>Новая позиция</ErpSectionLabel>
        <label class="tmc-field">
          <span class="tmc-field__label">Категория</span>
          <input v-model="newItem.category" type="text" class="tmc-input" placeholder="Например, СИЗ">
        </label>
        <label class="tmc-field">
          <span class="tmc-field__label">Наименование</span>
          <input v-model="newItem.name" type="text" class="tmc-input" placeholder="Как называется позиция">
        </label>
        <label class="tmc-field">
          <span class="tmc-field__label">Ед. изм.</span>
          <input v-model="newItem.unit" type="text" class="tmc-input" placeholder="шт., кг, м2" maxlength="32">
        </label>
        <div class="tmc-units">
          <button
              v-for="unit in units"
              :key="unit"
              type="button"
              class="tmc-units__chip"
              @click="newItem.unit = unit"
          >
            {{ unit }}
          </button>
        </div>
        <div class="tmc-new__actions">
          <UiButton :loading="isSaving" @click="addItem">Добавить</UiButton>
          <UiButton variant="outline" @click="isAdding = false">Отмена</UiButton>
        </div>
      </section>

      <ErpEmptyState v-if="found.length === 0">
        <p>Ничего не нашлось</p>
        <UiButton variant="outline" @click="query = ''">Показать всё</UiButton>
      </ErpEmptyState>

      <div v-else class="tmc-table">
        <div class="tmc-head" :class="{'tmc-head--editing': isEditing}">
          <span>Категория</span>
          <span>Наименование</span>
          <span class="tmc-head__unit">Ед. изм.</span>
          <span v-if="isEditing"/>
        </div>

        <div v-for="item in found" :key="item.id" class="tmc-group">
          <div class="tmc-row" :class="{'tmc-row--editing': isEditing}">
            <button type="button" class="tmc-tap" @click="onItemTap(item)">
              <span class="tmc-cell tmc-cell--category">{{ item.category || '—' }}</span>
              <span class="tmc-cell tmc-cell--name">{{ item.name }}</span>
              <span class="tmc-cell tmc-cell--unit" :class="{'tmc-cell--empty': !item.unit}">
                {{ item.unit || '—' }}
              </span>
            </button>
            <button
                v-if="isEditing"
                type="button"
                class="tmc-remove"
                :disabled="isSaving"
                aria-label="Удалить позицию"
                @click="removeItem(item)"
            >
              <Icon name="heroicons:trash" size="15"/>
            </button>
          </div>

          <div v-if="isEditing && editingId === item.id" ref="editForm" class="tmc-edit">
            <label class="tmc-field">
              <span class="tmc-field__label">Категория</span>
              <input v-model="draft.category" type="text" class="tmc-input" placeholder="Например, СИЗ">
            </label>
            <label class="tmc-field">
              <span class="tmc-field__label">Наименование</span>
              <input v-model="draft.name" type="text" class="tmc-input" placeholder="Как называется позиция">
            </label>
            <label class="tmc-field">
              <span class="tmc-field__label">Ед. изм.</span>
              <input v-model="draft.unit" type="text" class="tmc-input" placeholder="шт., кг, м2" maxlength="32">
            </label>
            <div class="tmc-units">
              <button
                  v-for="unit in units"
                  :key="unit"
                  type="button"
                  class="tmc-units__chip"
                  @click="draft.unit = unit"
              >
                {{ unit }}
              </button>
            </div>
            <div class="tmc-edit__actions">
              <UiButton :loading="isSaving" @click="saveDraft(item)">Сохранить</UiButton>
              <UiButton variant="outline" @click="editingId = null">Отмена</UiButton>
            </div>
          </div>

          <div v-if="!isEditing && stockId === item.id" class="tmc-stock">
            <ErpEmptyState v-if="isStockLoading" loading>
              <span>Загрузка остатков…</span>
            </ErpEmptyState>
            <template v-else-if="stock">
              <p v-if="stock.stock.length === 0" class="tmc-stock__empty">На складах не числится</p>
              <template v-else>
                <div v-for="(row, index) in stock.stock" :key="index" class="tmc-stock__row">
                  <span class="tmc-stock__place">
                    {{ [row.platform, row.cell].filter(Boolean).join(' · ') }}
                  </span>
                  <span class="tmc-stock__value">{{ balance.format(row.balance) }} {{ row.unit || stock.unit }}</span>
                </div>
                <div class="tmc-stock__row tmc-stock__row--total">
                  <span class="tmc-stock__place">Всего</span>
                  <span class="tmc-stock__value">{{ balance.format(stock.total) }} {{ stock.unit }}</span>
                </div>
              </template>
            </template>
          </div>
        </div>
      </div>
    </template>

    <!--
      Пока открыта форма — правки или новой позиции — «Добавить» убираем: он
      закрывает собой «Сохранить» у формы и предлагает второе действие там,
      где сотрудник уже занят одним.
    -->
    <template v-if="isEditing && !isAdding && editingId === null" #footer>
      <UiButton block @click="startAdding">Добавить</UiButton>
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

.tmc-new
  display: flex
  flex-direction: column
  gap: 8px
  padding: 12px
  background: var(--color-card-bg)
  border-radius: 14px
  box-shadow: var(--erp-shadow-card, 0 1px 0 rgba(0, 0, 0, 0.04))

.tmc-new__actions, .tmc-edit__actions
  display: grid
  grid-template-columns: 1fr 1fr
  gap: 8px

.tmc-table
  background: var(--color-card-bg)
  border-radius: 14px
  box-shadow: var(--erp-shadow-card, 0 1px 0 rgba(0, 0, 0, 0.04))
  overflow: hidden

.tmc-head
  display: grid
  // Категория узкая, наименование забирает остаток, единица — минимум под
  // «компл.». Так три колонки читаются даже на 390px.
  grid-template-columns: 88px 1fr 62px
  gap: 8px
  align-items: center
  padding: 9px 12px
  border-bottom: 0.5px solid rgba(60, 60, 67, 0.18)
  font-size: 10.5px
  font-weight: 700
  letter-spacing: 0.3px
  text-transform: uppercase
  color: var(--color-text-secondary)

.tmc-head--editing
  // Место под колонку с удалением, чтобы шапка не съезжала относительно строк.
  grid-template-columns: 88px 1fr 62px 32px

.tmc-head__unit
  text-align: right

.tmc-group
  border-bottom: 0.5px solid rgba(60, 60, 67, 0.12)

  &:last-child
    border-bottom: none

.tmc-row
  display: flex
  align-items: stretch

.tmc-tap
  flex: 1
  display: grid
  grid-template-columns: 88px 1fr 62px
  gap: 8px
  align-items: center
  min-width: 0
  padding: 9px 12px
  border: none
  background: none
  text-align: left
  cursor: pointer

.tmc-remove
  flex-shrink: 0
  width: 40px
  border: none
  background: none
  color: #d92d20
  cursor: pointer

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
  text-align: right
  font-weight: 600
  color: var(--color-primary)

.tmc-cell--empty
  color: var(--color-text-secondary)
  font-weight: 400

.tmc-edit, .tmc-stock
  display: flex
  flex-direction: column
  gap: 8px
  padding: 10px 12px 12px
  background: var(--color-primary-light)

// Подпись над полем, а не только плейсхолдер: заполненные «СИЗ» и
// «Перчатки х/б» без неё выглядят одинаково, и в форме переименования не
// видно, где категория, а где наименование. Оформление — как в форме счёта.
.tmc-field
  display: block
  min-width: 0

.tmc-field__label
  display: block
  margin: 0 0 4px 12px
  font-size: 11px
  font-weight: 600
  letter-spacing: 0.2px
  text-transform: uppercase
  color: var(--color-text-secondary)

.tmc-input
  width: 100%
  padding: 10px 11px
  border: none
  border-radius: 10px
  background: var(--color-card-bg)
  color: var(--color-text)

  &::placeholder
    color: var(--color-text-secondary)
    font-size: 13px

  &:focus
    outline: 2px solid var(--color-primary)
    outline-offset: -1px

.tmc-units
  display: flex
  flex-wrap: wrap
  gap: 6px

.tmc-units__chip
  padding: 5px 10px
  border: none
  border-radius: var(--radius-full)
  background: var(--color-card-bg)
  color: var(--color-primary)
  font-size: 12.5px
  font-weight: 600
  cursor: pointer

.tmc-stock__row
  display: flex
  align-items: baseline
  justify-content: space-between
  gap: 12px
  font-size: 13px

.tmc-stock__row--total
  padding-top: 6px
  border-top: 0.5px solid rgba(60, 60, 67, 0.18)
  font-weight: 700

.tmc-stock__place
  color: var(--color-text-secondary)
  min-width: 0

.tmc-stock__value
  flex-shrink: 0
  color: var(--color-text)
  font-variant-numeric: tabular-nums

.tmc-stock__empty
  margin: 0
  font-size: 13px
  color: var(--color-text-secondary)
</style>
