<script setup lang="ts">
import {ref} from 'vue'
import {useMutation, useQueryClient} from '@tanstack/vue-query'
import {v4 as uuid} from 'uuid'
import {useForm} from 'vee-validate'

import type {ICardRecord} from '~~/types/cards.types'
import {isGuestSession} from '~~/store/auth.store'
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
}

const props = defineProps({
  status: {type: String, default: 'todo'}
})

const emit = defineEmits<{
  (e: 'card-created'): void
}>()

const isOpenForm = ref(false)
const toggleForm = () => (isOpenForm.value = !isOpenForm.value)

const queryClient = useQueryClient()

const {handleSubmit, defineField, handleReset, errors} = useForm<ICardFormState>({
  initialValues: {
    status: props.status,
    name: '',
    price: 3,
    customer: {name: 'Идеи', email: ''}
  }
})

const [name, nameAttrs] = defineField('name')
const [price, priceAttrs] = defineField('price')
const [category, categoryAttrs] = defineField('customer.name')

const {mutate, isPending, isError, error} = useMutation({
  mutationKey: ['create-card'],
  mutationFn: async (data: ICardFormState) => {
    if (!data.name.trim()) {
      throw new Error('Название обязательно')
    }

    if (data.price < 1 || data.price > 5) {
      throw new Error('Приоритет от 1 до 5')
    }

    if (!data.customer.name.trim()) {
      throw new Error('Выберите категорию')
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
      const newCard: ICardRecord = {
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
        comments: []
      }
      return newCard
    }

    return createCard(documentId, payload)
  },
  onSuccess: (result) => {
    if (import.meta.client && isGuestSession() && result) {
      const newCard = result as ICardRecord
      queryClient.setQueryData([CARDS_STATS_QUERY_KEY], (old: ICardRecord[] | undefined) =>
          old ? [...old, newCard] : [newCard]
      )
      queryClient.setQueryData([CARDS_QUERY_KEY], (old: { documents: ICardRecord[]; total: number } | undefined) => {
        if (!old) return {documents: [newCard], total: 1}
        return {...old, documents: [...old.documents, newCard], total: old.total + 1}
      })
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
          <span class="create-card__title">Новая карточка</span>
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
            label="Название"
            placeholder="Идея, задача или желание"
            type="text"
            :error="errors.name"
            required
        />

        <div class="form-field">
          <label class="form-field__label" for="card-category">Категория</label>
          <select
              id="card-category"
              v-model="category"
              v-bind="categoryAttrs"
              class="form-field__select"
          >
            <option v-for="option in CATEGORY_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <div class="form-field">
          <label class="form-field__label" for="card-priority">Приоритет</label>
          <div class="priority-picker">
            <button
                v-for="n in 5"
                :key="n"
                type="button"
                class="priority-picker__dot"
                :class="{ 'priority-picker__dot--active': price >= n }"
                :aria-label="`Приоритет ${n}`"
                @click="price = n"
            />
          </div>
          <input id="card-priority" v-model.number="price" v-bind="priceAttrs" type="hidden"/>
        </div>

        <UiButton
            type="submit"
            variant="primary"
            size="md"
            block
            :loading="isPending"
            :disabled="isPending"
        >
          {{ isPending ? 'Сохранение...' : 'Добавить на доску' }}
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
  gap: var(--spacing-3)
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

.form-field
  display: flex
  flex-direction: column
  gap: var(--spacing-2)

.form-field__label
  font-size: var(--font-size-sm)
  font-weight: 600
  color: var(--color-text)

.form-field__select
  width: 100%
  padding: var(--spacing-2) var(--spacing-3)
  border: var(--border-width) solid var(--color-input-border)
  border-radius: var(--radius-md)
  background-color: var(--color-input-bg)
  color: var(--color-input-text)
  font-size: var(--font-size-sm)
  font-family: inherit
  cursor: pointer

  &:focus
    outline: none
    border-color: var(--color-input-border-focus)

.priority-picker
  display: flex
  gap: 6px

.priority-picker__dot
  width: 12px
  height: 12px
  border-radius: 50%
  border: none
  background-color: var(--color-border)
  cursor: pointer
  padding: 0
  transition: background-color var(--transition-fast) ease, transform var(--transition-fast) ease

  &--active
    background-color: var(--color-accent)

  &:hover
    transform: scale(1.15)

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
  max-height: 600px
</style>
