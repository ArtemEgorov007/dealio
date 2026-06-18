<script setup lang="ts">
import {useQueryClient} from '@tanstack/vue-query'
import {useBoardStore} from '~~/store/board.store'
import {useAuthStore} from '~~/store/auth.store'
import {CARDS_QUERY_KEY, CARDS_STATS_QUERY_KEY} from '~/components/kanban/kanban.types'

useSeoMeta({ title: 'Настройки | Dealio' })

const RETENTION_OPTIONS = [10, 20, 30]

const boardStore = useBoardStore()
const authStore = useAuthStore()
const queryClient = useQueryClient()

const retentionDays = computed(() => boardStore.retentionDays)
const appMode = computed(() => {
  if (authStore.isGuest) return 'Демо (localStorage)'
  return 'Аккаунт (Appwrite)'
})

const saveRetention = (days: number) => {
  boardStore.setRetentionDays(days)
  queryClient.invalidateQueries({queryKey: [CARDS_QUERY_KEY]})
  queryClient.invalidateQueries({queryKey: [CARDS_STATS_QUERY_KEY]})
}
</script>

<template>
  <div class="settings-page">
    <header class="settings-header">
      <h1 class="settings-title">Настройки</h1>
      <p class="settings-subtitle">Управляйте поведением трекера</p>
    </header>

    <div class="settings-sections">
      <section class="settings-section">
        <div class="section-header">
          <div class="section-icon">
            <Icon name="heroicons:archive-box" size="18"/>
          </div>
          <div class="section-meta">
            <h2 class="section-title">Архив</h2>
            <p class="section-desc">Как долго хранить удалённые карточки перед автоматическим удалением</p>
          </div>
        </div>

        <div class="retention-options">
          <label
              v-for="days in RETENTION_OPTIONS"
              :key="days"
              class="retention-option"
              :class="{ 'retention-option--active': retentionDays === days }"
          >
            <input
                type="radio"
                name="retention"
                :value="days"
                :checked="retentionDays === days"
                @change="saveRetention(days)"
                class="retention-radio"
            />
            <span class="retention-label">
              <span class="retention-days">{{ days }}</span>
              <span class="retention-unit">дней</span>
            </span>
            <span v-if="retentionDays === days" class="retention-check">
              <Icon name="heroicons:check" size="14"/>
            </span>
          </label>
        </div>

        <p class="section-hint">
          <Icon name="heroicons:information-circle" size="14"/>
          Карточки в архиве автоматически удаляются через {{ retentionDays }} {{ retentionDays === 10 ? 'дней' : 'дней' }} после отправки в архив.
        </p>
      </section>

      <section class="settings-section">
        <div class="section-header">
          <div class="section-icon section-icon--slate">
            <Icon name="heroicons:information-circle" size="18"/>
          </div>
          <div class="section-meta">
            <h2 class="section-title">О приложении</h2>
            <p class="section-desc">Dealio — персональный трекер идей, задач и желаний</p>
          </div>
        </div>
        <div class="app-info">
          <div class="info-row">
            <span class="info-label">Версия</span>
            <span class="info-value">1.0.0</span>
          </div>
          <div class="info-row">
            <span class="info-label">Режим</span>
            <span class="info-value">{{ appMode }}</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped lang="sass">
.settings-page
  width: 100%
  padding: var(--spacing-6)
  max-width: 680px
  margin: 0 auto

.settings-header
  margin-bottom: var(--spacing-8)

.settings-title
  font-size: var(--font-size-3xl)
  font-weight: 800
  color: var(--color-text)
  letter-spacing: -0.5px
  line-height: 1.1
  margin-bottom: var(--spacing-1)

.settings-subtitle
  font-size: var(--font-size-sm)
  color: var(--color-text-muted)
  font-weight: 500

.settings-sections
  display: flex
  flex-direction: column
  gap: var(--spacing-5)

.settings-section
  background-color: var(--color-card-bg)
  border: var(--border-width) solid var(--color-card-border)
  border-radius: var(--radius-xl)
  padding: var(--spacing-6)
  display: flex
  flex-direction: column
  gap: var(--spacing-5)
  box-shadow: var(--shadow-xs)

.section-header
  display: flex
  align-items: flex-start
  gap: var(--spacing-4)

.section-icon
  width: 40px
  height: 40px
  border-radius: var(--radius-md)
  background-color: var(--color-primary-light)
  color: var(--color-primary)
  display: flex
  align-items: center
  justify-content: center
  flex-shrink: 0

  &--slate
    background-color: rgba(100, 116, 139, 0.1)
    color: var(--color-text-muted)

.section-meta
  flex: 1

.section-title
  font-size: var(--font-size-base)
  font-weight: 700
  color: var(--color-text)
  margin-bottom: var(--spacing-1)

.section-desc
  font-size: var(--font-size-sm)
  color: var(--color-text-muted)
  font-weight: 500
  line-height: 1.5

.retention-options
  display: flex
  gap: var(--spacing-3)

.retention-option
  flex: 1
  display: flex
  flex-direction: column
  align-items: center
  justify-content: center
  gap: var(--spacing-1)
  padding: var(--spacing-4) var(--spacing-3)
  border: 1.5px solid var(--color-border)
  border-radius: var(--radius-lg)
  cursor: pointer
  transition: all var(--transition-normal) ease
  position: relative
  text-align: center

  &:hover
    border-color: var(--color-primary)
    background-color: var(--color-primary-light)

  &--active
    border-color: var(--color-primary)
    background-color: var(--color-primary-light)

.retention-radio
  position: absolute
  opacity: 0
  width: 0
  height: 0

.retention-label
  display: flex
  flex-direction: column
  align-items: center
  gap: 2px

.retention-days
  font-size: var(--font-size-2xl)
  font-weight: 800
  color: var(--color-text)
  letter-spacing: -0.5px

  .retention-option--active &
    color: var(--color-primary)

.retention-unit
  font-size: var(--font-size-xs)
  font-weight: 600
  color: var(--color-text-muted)
  text-transform: uppercase
  letter-spacing: 0.3px

.retention-check
  position: absolute
  top: var(--spacing-2)
  right: var(--spacing-2)
  width: 18px
  height: 18px
  background-color: var(--color-primary)
  color: white
  border-radius: 50%
  display: flex
  align-items: center
  justify-content: center

.section-hint
  display: flex
  align-items: center
  gap: var(--spacing-2)
  font-size: var(--font-size-xs)
  color: var(--color-text-muted)
  font-weight: 500
  line-height: 1.5

.app-info
  display: flex
  flex-direction: column
  gap: 0

.info-row
  display: flex
  align-items: center
  justify-content: space-between
  padding: var(--spacing-3) 0
  border-bottom: var(--border-width) solid var(--color-border)

  &:last-child
    border-bottom: none

.info-label
  font-size: var(--font-size-xs)
  font-weight: 700
  color: var(--color-text-muted)
  text-transform: uppercase
  letter-spacing: 0.5px

.info-value
  font-size: var(--font-size-sm)
  font-weight: 600
  color: var(--color-text)
</style>
