<script setup lang="ts">
import dayjs from 'dayjs'
import 'dayjs/locale/ru'

import {CATEGORY_OPTIONS, COLUMN_LABELS} from '~/components/kanban/kanban.labels'
import {useUpdateCard} from '~/components/kanban/slideover/useUpdateCard'
import {useCardSlideStore} from '~~/store/card-slide.store'
import {useAuthStore} from '~~/store/auth.store'
import type {Priority} from '~~/store/board.store'
import {EnumStatus} from '~~/types/cards.types'

dayjs.locale('ru')

const store = useCardSlideStore()
const authStore = useAuthStore()
const {mutate, isPending, isError, error} = useUpdateCard()

const editName = ref('')
const editCategory = ref('')
const editStatus = ref<EnumStatus>(EnumStatus.ideas)
const editPriority = ref<Priority>('medium')
const editPrice = ref(0)

const formatDate = (date?: string): string =>
    date ? dayjs(date).format('D MMMM YYYY') : '—'

const isGuest = computed(() => authStore.isGuest)

const categoryOptions = CATEGORY_OPTIONS.map(option => ({
  value: option.value,
  label: option.label,
}))

const statusOptions = Object.entries(COLUMN_LABELS).map(([value, label]) => ({
  value,
  label,
}))

const PRIORITY_OPTIONS: {value: Priority; label: string}[] = [
  {value: 'high', label: 'Высокий'},
  {value: 'medium', label: 'Средний'},
  {value: 'low', label: 'Низкий'},
]

const priorityOptions = PRIORITY_OPTIONS.map(option => ({
  value: option.value,
  label: option.label,
}))

const priorityTone = computed(() => editPriority.value)

const isWishlistCategory = computed(() => editCategory.value === 'Wishlist')

const syncFromStore = () => {
  const card = store.card
  if (!card) return

  editName.value = card.name
  editCategory.value = card.category
  editStatus.value = card.status as EnumStatus
  editPriority.value = card.priority
  editPrice.value = card.price
}

watch(() => store.card?.id, syncFromStore, {immediate: true})

const saveField = (fields: Partial<{
  name: string
  category: string
  status: EnumStatus
  priority: Priority
  price: number
}>) => {
  if (!store.card?.id || isPending.value) return

  mutate({
    id: store.card.id,
    ...fields,
  })
}

const saveName = () => {
  const trimmed = editName.value.trim()
  if (!trimmed || trimmed === store.card?.name) return
  saveField({name: trimmed})
}

const saveCategory = (value: string | number) => {
  const category = String(value)
  editCategory.value = category
  if (category === store.card?.category) return

  const patch: Parameters<typeof saveField>[0] = {category}
  if (category !== 'Wishlist') {
    editPrice.value = 0
    patch.price = 0
  }

  saveField(patch)
}

const saveStatus = (value: string | number) => {
  const status = String(value) as EnumStatus
  editStatus.value = status
  if (status === store.card?.status) return
  saveField({status})
}

const savePriority = (value: string | number) => {
  const priority = String(value) as Priority
  editPriority.value = priority
  if (priority === store.card?.priority) return
  if (!isGuest.value) return
  saveField({priority})
}

const savePrice = () => {
  const price = Number(editPrice.value) || 0
  if (price === store.card?.price) return
  saveField({price})
}
</script>

<template>
  <div class="card-info">
    <UiInput
        id="slideover-name"
        v-model="editName"
        label="Заголовок"
        placeholder="Название элемента"
        flush
        :disabled="isPending"
        @blur="saveName"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
    />

    <UiInput
        v-if="isWishlistCategory"
        id="slideover-price"
        v-model="editPrice"
        label="Стоимость, ₽"
        type="number"
        placeholder="0"
        :min="0"
        flush
        :disabled="isPending"
        @blur="savePrice"
    />

    <div v-if="isError" class="card-info__error">
      <Icon name="heroicons:exclamation-circle" size="14"/>
      {{ (error as Error).message }}
    </div>

    <div class="card-info__divider"></div>

    <div class="card-info__fields">
      <UiSelect
          id="slideover-category"
          :model-value="editCategory"
          label="Тип"
          :options="categoryOptions"
          flush
          :disabled="isPending"
          @change="saveCategory"
      />

      <UiSelect
          id="slideover-status"
          :model-value="editStatus"
          label="Колонка"
          :options="statusOptions"
          flush
          :disabled="isPending"
          @change="saveStatus"
      />

      <UiSelect
          v-if="isGuest"
          id="slideover-priority"
          :model-value="editPriority"
          label="Приоритет"
          :options="priorityOptions"
          :tone="priorityTone"
          flush
          :disabled="isPending"
          @change="savePriority"
      />

      <div v-else class="card-info__readonly">
        <span class="field-label">Приоритет</span>
        <span class="field-value">{{ priorityOptions.find(o => o.value === editPriority)?.label ?? '—' }}</span>
      </div>

      <div class="card-info__readonly">
        <span class="field-label">Дата добавления</span>
        <span class="field-value">{{ formatDate(store.card?.$createdAt) }}</span>
      </div>
    </div>

    <p v-if="isPending" class="card-info__saving">Сохранение...</p>
  </div>
</template>

<style scoped lang="sass">
.card-info
  display: flex
  flex-direction: column
  gap: var(--spacing-3)

.card-info__divider
  height: 1px
  background-color: var(--color-border)
  margin: var(--spacing-1) 0

.card-info__fields
  display: flex
  flex-direction: column
  gap: var(--spacing-3)

.card-info__readonly
  display: flex
  align-items: center
  justify-content: space-between
  gap: var(--spacing-3)
  padding: var(--spacing-2) 0
  border-bottom: var(--border-width) solid var(--color-border)

  &:last-child
    border-bottom: none

.field-label
  font-size: var(--font-size-xs)
  font-weight: 700
  color: var(--color-text-muted)
  text-transform: uppercase
  letter-spacing: 0.5px
  flex-shrink: 0

.field-value
  font-size: var(--font-size-sm)
  font-weight: 600
  color: var(--color-text)
  text-align: right

.card-info__error
  display: flex
  align-items: center
  gap: var(--spacing-2)
  padding: var(--spacing-2) var(--spacing-3)
  background-color: var(--color-error-bg)
  color: var(--color-error-text)
  border: 1px solid var(--color-error-border)
  border-radius: var(--radius-md)
  font-size: var(--font-size-xs)
  font-weight: 500

.card-info__saving
  margin: 0
  font-size: var(--font-size-xs)
  font-weight: 600
  color: var(--color-text-muted)
</style>
