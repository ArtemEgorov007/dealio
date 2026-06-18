<script setup lang="ts">
import type {NuxtError} from '#app'

const props = defineProps<{ error: NuxtError }>()

const statusCode = computed(() => props.error.statusCode ?? 500)
const isNotFound = computed(() => statusCode.value === 404)

const handleHome = () => clearError({redirect: '/'})
</script>

<template>
  <div class="error-page">
    <div class="error-card">
      <p class="error-code">{{ statusCode }}</p>
      <h1 class="error-title">
        {{ isNotFound ? 'Страница не найдена' : 'Что-то пошло не так' }}
      </h1>
      <p class="error-message">
        {{
          isNotFound
              ? 'Такого маршрута нет — вернитесь на доску.'
              : (error.message || 'Попробуйте обновить страницу или вернуться на главную.')
        }}
      </p>
      <button class="error-action" type="button" @click="handleHome">
        На доску
      </button>
    </div>
  </div>
</template>

<style scoped lang="sass">
.error-page
  min-height: 100vh
  display: flex
  align-items: center
  justify-content: center
  padding: var(--spacing-6)
  background-color: var(--color-bg)

.error-card
  width: 100%
  max-width: 420px
  text-align: center
  display: flex
  flex-direction: column
  align-items: center
  gap: var(--spacing-3)

.error-code
  font-size: var(--font-size-5xl)
  font-weight: 800
  color: var(--color-text-muted)
  font-family: var(--font-numeric)
  line-height: 1

.error-title
  font-size: var(--font-size-2xl)
  font-weight: 700
  color: var(--color-text)

.error-message
  font-size: var(--font-size-sm)
  color: var(--color-text-muted)
  line-height: 1.5
  margin: 0

.error-action
  margin-top: var(--spacing-2)
  padding: 10px var(--spacing-5)
  border-radius: var(--radius-md)
  background-color: var(--color-button-primary-bg)
  color: var(--color-button-primary-text)
  font-size: var(--font-size-sm)
  font-weight: 600
  cursor: pointer
  border: none
  transition: background-color var(--transition-fast) ease

  &:hover
    background-color: var(--color-button-primary-bg-hover)
</style>
