<script setup lang="ts">
import {ref, watch} from 'vue'
import {useMutation, useQueryClient} from '@tanstack/vue-query'
import {v4 as uuid} from 'uuid'
import {useForm} from 'vee-validate'

import type {ICardRecord} from '~~/types/cards.types'
import {EnumStatus} from '~~/types/cards.types'
import {isGuestSession} from '~~/store/auth.store'
import {useBoardStore, type Priority} from '~~/store/board.store'
import type {IBoardCard} from '~~/store/board.store'
import {CATEGORY_OPTIONS} from '~/components/kanban/kanban.labels'
import {CARDS_QUERY_KEY, CARDS_STATS_QUERY_KEY} from '~/components/kanban/kanban.types'
import {createCard} from '~/utils/appwrite-cards'

interface ICardFormState {
  name: string
  price: number
  customer: {
    name: string
    email: string
  }
  status: string
  priority: Priority
}

const CATEGORY_BY_STATUS: Partial<Record<EnumStatus, string>> = {
  [EnumStatus.ideas]: 'Идея',
  [EnumStatus.tasks]: 'Задача',
  [EnumStatus.wishlist]: 'Wishlist',
}

const PRIORITY_OPTIONS: {value: Priority; label: string}[] = [
  {value: 'high', label: 'Высокий'},
  {value: 'medium', label: 'Средний'},
  {value: 'low', label: 'Низкий'},
]

const categoryOptions = CATEGORY_OPTIONS.map(option => ({
  value: option.value,
  label: option.label,
}))

const priorityOptions = PRIORITY_OPTIONS.map(option => ({
  value: option.value,
  label: option.label,
}))

const props = defineProps({
  status: {type: String, default: 'ideas'}
})

const emit = defineEmits<{
  (e: 'card-created'): void
}>()

const isOpenForm = ref(false)

const defaultCategory = () =>
    CATEGORY_BY_STATUS[props.status as EnumStatus] ?? 'Идея'

const toggleForm = () => {
  isOpenForm.value = !isOpenForm.value
  if (isOpenForm.value) {
    category.value = defaultCategory()
  }
}

const queryClient = useQueryClient()
const boardStore = useBoardStore()

const {handleSubmit, defineField, handleReset, errors, setFieldValue} = useForm<ICardFormState>({
  initialValues: {
    status: props.status,
    name: '',
    price: 0,
    customer: {name: defaultCategory(), email: ''},
    priority: 'medium',
  }
})

const [name, nameAttrs] = defineField('name')
const [price, priceAttrs] = defineField('price')
const [category] = defineField('customer.name')
const [priority] = defineField('priority')

const priorityTone = computed(() => priority.value as 'high' | 'medium' | 'low')

watch(() => props.status, (status) => {
  setFieldValue('status', status)
  if (!isOpenForm.value) {
    setFieldValue('customer.name', CATEGORY_BY_STATUS[status as EnumStatus] ?? 'Идея')
  }
})

const {mutate, isPending, isError, error} = useMutation({
  mutationKey: ['create-card'],
  mutationFn: async (data: ICardFormState) => {
    if (!data.name.trim()) {
      throw new Error('Название обязательно')
    }
    if (data.price < 0) {
      throw new Error('Стоимость не может быть отрицательной')
    }
    if (!data.customer.name.trim()) {
      throw new Error('Выберите тип')
    }

    const documentId = uuid()
    const payload = {
      name: data.name.trim(),
      price: data.price,
      status: data.status as ICardRecord['status'],
      customer: {
        name: data.customer.name.trim(),
        email: data.customer.email.trim() || 'noreply@dealio.app'
      },
      comments: [] as ICardRecord['comments'],
    }

    if (import.meta.client && isGuestSession()) {
      const newCard: IBoardCard = {
        $id: documentId,
        $createdAt: new Date().toISOString(),
        name: payload.name,
        price: payload.price,
        status: payload.status,
        customer: {
          $id: uuid(),
          $createdAt: new Date().toISOString(),
          name: payload.customer.name,
          email: payload.customer.email,
          avatar_url: '',
        },
        comments: [],
        priority: data.priority,
        archived: false,
      }
      return newCard
    }

    return createCard(documentId, payload)
  },
  onSuccess: (result) => {
    if (import.meta.client && isGuestSession() && result) {
      const newCard = result as IBoardCard
      boardStore.addCard(newCard)
      queryClient.invalidateQueries({queryKey: [CARDS_QUERY_KEY]})
      queryClient.invalidateQueries({queryKey: [CARDS_STATS_QUERY_KEY]})
    } else {
      queryClient.invalidateQueries({queryKey: [CARDS_QUERY_KEY]})
    }

    handleReset()
    isOpenForm.value = false
    emit('card-created')
  },
})

const onSubmit = handleSubmit(values => mutate(values))
</script>

<template>
  <div class="create-card">
    <button
        v-if="!isOpenForm"
        class="create-card__trigger"
        @click="toggleForm"
        aria-label="Добавить карточку"
    >
      <Icon name="heroicons:plus" size="14"/>
      <span>Добавить</span>
    </button>

    <Transition name="form-expand">
      <form
          v-if="isOpenForm"
          class="create-card__form"
          @submit.prevent="onSubmit"
          novalidate
      >
        <div class="create-card__header">
          <span class="create-card__title">Новый элемент</span>
          <button
              type="button"
              class="create-card__close"
              @click="toggleForm"
              aria-label="Закрыть форму"
          >
            <Icon name="heroicons:x-mark" size="16"/>
          </button>
        </div>

        <div v-if="isError" class="create-card__error">
          <Icon name="heroicons:exclamation-circle" size="14"/>
          {{ (error as Error).message }}
        </div>

        <UiInput
            id="card-name"
            v-model="name"
            v-bind="nameAttrs"
            label="Заголовок"
            placeholder="Что хотите добавить?"
            type="text"
            :error="errors.name"
            flush
            required
        />

        <UiSelect
            id="card-category"
            v-model="category"
            label="Тип"
            :options="categoryOptions"
            flush
        />

        <UiSelect
            id="card-priority"
            v-model="priority"
            label="Приоритет"
            :options="priorityOptions"
            :tone="priorityTone"
            flush
        />

        <UiInput
            v-if="category === 'Wishlist'"
            id="card-price"
            v-model="price"
            v-bind="priceAttrs"
            label="Стоимость, ₽"
            type="number"
            placeholder="0"
            :min="0"
            flush
        />

        <UiButton
            type="submit"
            variant="primary"
            size="md"
            block
            :loading="isPending"
            :disabled="isPending"
        >
          {{ isPending ? 'Сохранение...' : 'Добавить' }}
        </UiButton>
      </form>
    </Transition>
  </div>
</template>

<style scoped lang="sass">
.create-card
  margin-bottom: var(--spacing-3)

.create-card__trigger
  display: flex
  align-items: center
  justify-content: center
  gap: var(--spacing-2)
  width: 100%
  padding: 7px var(--spacing-3)
  background: none
  border: 1.5px dashed var(--color-border)
  border-radius: var(--radius-md)
  color: var(--color-text-muted)
  font-size: var(--font-size-xs)
  font-weight: 600
  cursor: pointer
  transition: all var(--transition-normal) ease

  &:hover
    border-color: var(--color-primary)
    color: var(--color-primary)
    background-color: var(--color-primary-light)

.create-card__form
  background-color: var(--color-card-bg)
  border: var(--border-width) solid var(--color-border)
  border-radius: var(--radius-lg)
  padding: var(--spacing-4)
  display: flex
  flex-direction: column
  gap: var(--spacing-2)
  box-shadow: var(--shadow-md)

.create-card__header
  display: flex
  align-items: center
  justify-content: space-between

.create-card__title
  font-size: var(--font-size-sm)
  font-weight: 700
  color: var(--color-text)

.create-card__close
  width: 26px
  height: 26px
  display: flex
  align-items: center
  justify-content: center
  background: none
  border: var(--border-width) solid var(--color-border)
  border-radius: var(--radius-sm)
  color: var(--color-text-muted)
  cursor: pointer

  &:hover
    background-color: var(--color-bg-secondary)
    color: var(--color-text)

.create-card__error
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

.form-expand-enter-active,
.form-expand-leave-active
  transition: all var(--transition-slow) var(--transition-ease)
  overflow: hidden

.form-expand-enter-from,
.form-expand-leave-to
  opacity: 0
  transform: translateY(-8px)
  max-height: 0

.form-expand-enter-to,
.form-expand-leave-from
  opacity: 1
  transform: translateY(0)
  max-height: 700px
</style>
