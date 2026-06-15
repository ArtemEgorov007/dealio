<script setup lang="ts">
import {ref} from 'vue'
import {useMutation, useQueryClient} from '@tanstack/vue-query'
import {v4 as uuid} from 'uuid'
import {useForm} from 'vee-validate'

import {COLLECTION_DEALS, DB_ID} from '~~/app.constants'
import type {IDeal} from '~~/types/deals.types'
import {isGuestSession} from '~~/store/auth.store'

interface IDealFormState {
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
  (e: 'deal-created'): void
}>()

const isOpenForm = ref(false)
const toggleForm = () => (isOpenForm.value = !isOpenForm.value)

const queryClient = useQueryClient()

const {handleSubmit, defineField, handleReset, errors} = useForm<IDealFormState>({
  initialValues: {
    status: props.status,
    name: '',
    price: 0,
    customer: {name: '', email: ''}
  }
})

const [name, nameAttrs] = defineField('name')
const [price, priceAttrs] = defineField('price')
const [customerEmail, customerEmailAttrs] = defineField('customer.email')
const [customerName, customerNameAttrs] = defineField('customer.name')

const {mutate, isPending, isError, error} = useMutation({
  mutationKey: ['create-deal'],
  mutationFn: async (data: IDealFormState) => {
    if (!data.name.trim()) {
      throw new Error('Название сделки обязательно');
    }

    if (data.price <= 0) {
      throw new Error('Сумма должна быть больше нуля');
    }

    if (!data.customer.name.trim()) {
      throw new Error('Имя компании обязательно');
    }

    if (!data.customer.email.trim()) {
      throw new Error('Email клиента обязателен');
    }

    const dealData: Partial<IDeal> = {
      name: data.name.trim(),
      price: data.price,
      status: data.status as any,
      customer: {
        name: data.customer.name.trim(),
        email: data.customer.email.trim()
      },
      $id: uuid(),
      $createdAt: new Date().toISOString()
    }

    if (import.meta.client && isGuestSession()) {
      const newDeal: IDeal = {
        $id: dealData.$id!,
        $createdAt: dealData.$createdAt!,
        name: dealData.name!,
        price: dealData.price!,
        status: dealData.status as any,
        customer: {
          $id: uuid(),
          $createdAt: new Date().toISOString(),
          name: data.customer.name.trim(),
          email: data.customer.email.trim(),
          avatar_url: '',
        },
        comments: []
      }
      return Promise.resolve(newDeal)
    }

    return DB.createDocument(DB_ID, COLLECTION_DEALS, dealData.$id!, dealData)
  },
  onSuccess: (result) => {
    if (import.meta.client && isGuestSession() && result) {
      const newDeal = result as IDeal
      queryClient.setQueryData(['deals-stats'], (old: IDeal[] | undefined) => {
        return old ? [...old, newDeal] : [newDeal]
      })
      queryClient.setQueryData(['deals'], (old: { documents: IDeal[]; total: number } | undefined) => {
        if (!old) return { documents: [newDeal], total: 1 }
        return { ...old, documents: [...old.documents, newDeal], total: old.total + 1 }
      })
      handleReset()
      isOpenForm.value = false
      emit('deal-created')
      return
    }
    queryClient.invalidateQueries({queryKey: ['deals']})
    handleReset()
    isOpenForm.value = false
    emit('deal-created')
  },
  onError: (error) => {
    console.error('Ошибка при создании сделки:', error)
  }
})

const onSubmit = handleSubmit(values => mutate(values))
</script>

<template>
  <div class="create-deal">
    <button
        v-if="!isOpenForm"
        class="add-deal-btn"
        @click="toggleForm"
        aria-label="Добавить сделку"
    >
      <Icon name="heroicons:plus" size="14"/>
      <span>Добавить</span>
    </button>

    <Transition name="form-expand">
      <form
          v-if="isOpenForm"
          class="deal-form"
          @submit.prevent="onSubmit"
          novalidate
      >
        <div class="deal-form__header">
          <span class="deal-form__title">Новая сделка</span>
          <button
              type="button"
              class="deal-form__close"
              @click="toggleForm"
              aria-label="Закрыть форму"
          >
            <Icon name="heroicons:x-mark" size="16"/>
          </button>
        </div>

        <div v-if="isError" class="deal-form__error">
          <Icon name="heroicons:exclamation-circle" size="14"/>
          {{ (error as Error).message }}
        </div>

        <UiInput
            id="deal-name"
            v-model="name"
            v-bind="nameAttrs"
            label="Название"
            placeholder="Название сделки"
            type="text"
            :error="errors.name"
            required
        />

        <UiInput
            id="deal-price"
            v-model.number="price"
            v-bind="priceAttrs"
            label="Сумма (₽)"
            placeholder="0"
            type="number"
            :error="errors.price"
            required
        />

        <UiInput
            id="customer-name"
            v-model="customerName"
            v-bind="customerNameAttrs"
            label="Компания"
            placeholder="Название компании"
            type="text"
            :error="errors.customer?.name"
            required
        />

        <UiInput
            id="customer-email"
            v-model="customerEmail"
            v-bind="customerEmailAttrs"
            label="Email клиента"
            placeholder="email@company.com"
            type="email"
            :error="errors.customer?.email"
            required
        />

        <UiButton
            type="submit"
            variant="primary"
            size="md"
            block
            :loading="isPending"
            :disabled="isPending"
        >
          {{ isPending ? 'Сохранение...' : 'Добавить сделку' }}
        </UiButton>
      </form>
    </Transition>
  </div>
</template>

<style scoped lang="sass">
.create-deal
  margin-bottom: var(--spacing-3)

.add-deal-btn
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

  &:focus-visible
    outline: 2px solid var(--color-primary)
    outline-offset: 2px

.deal-form
  background-color: var(--color-card-bg)
  border: var(--border-width) solid var(--color-border)
  border-radius: var(--radius-lg)
  padding: var(--spacing-4)
  display: flex
  flex-direction: column
  gap: var(--spacing-1)
  box-shadow: var(--shadow-md)

.deal-form__header
  display: flex
  align-items: center
  justify-content: space-between
  margin-bottom: var(--spacing-3)

.deal-form__title
  font-size: var(--font-size-sm)
  font-weight: 700
  color: var(--color-text)

.deal-form__close
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
  transition: all var(--transition-fast) ease

  &:hover
    background-color: var(--color-bg-secondary)
    color: var(--color-text)

.deal-form__error
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
  margin-bottom: var(--spacing-2)

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
