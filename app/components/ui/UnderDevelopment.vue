<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  description?: string
}>(), {
  description: 'Этот раздел находится в активной разработке и скоро будет доступен'
})
</script>

<template>
  <div class="ud-wrapper">
    <div class="ud-backdrop" aria-hidden="true">
      <div class="mock-header">
        <div class="mock-bar mock-bar--wide"></div>
        <div class="mock-bar mock-bar--short"></div>
        <div class="mock-bar mock-bar--short"></div>
      </div>

      <div class="mock-stats">
        <div v-for="n in 4" :key="n" class="mock-stat-card">
          <div class="mock-bar mock-bar--icon"></div>
          <div class="mock-stat-lines">
            <div class="mock-bar mock-bar--medium"></div>
            <div class="mock-bar mock-bar--num"></div>
          </div>
        </div>
      </div>

      <div class="mock-body">
        <div class="mock-table">
          <div class="mock-table-header">
            <div v-for="n in 5" :key="n" class="mock-bar mock-bar--th"></div>
          </div>
          <div v-for="row in 10" :key="row" class="mock-row">
            <div class="mock-bar mock-bar--avatar"></div>
            <div class="mock-bar mock-bar--cell-wide"></div>
            <div class="mock-bar mock-bar--cell"></div>
            <div class="mock-bar mock-bar--cell-short"></div>
            <div class="mock-bar mock-bar--cell-short"></div>
          </div>
        </div>

        <div class="mock-chart">
          <div class="mock-chart-bars">
            <div
                v-for="(h, i) in [55, 80, 45, 90, 65, 75, 40, 85, 60, 70, 50, 88]"
                :key="i"
                class="mock-chart-bar"
                :style="{ height: h + '%' }"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <div class="ud-card">
      <div class="ud-icon-wrap">
        <Icon name="heroicons:wrench-screwdriver" class="ud-icon"/>
      </div>

      <span class="ud-badge">Скоро</span>

      <h2 class="ud-title">{{ title }}</h2>
      <p class="ud-description">{{ description }}</p>
    </div>
  </div>
</template>

<style scoped lang="sass">
.ud-wrapper
  position: relative
  flex: 1
  display: flex
  align-items: center
  justify-content: center
  min-height: 0
  width: 100%
  overflow: hidden
  background-color: var(--color-bg-secondary)
  border-top: var(--border-width) solid var(--color-border)

.ud-backdrop
  position: absolute
  inset: 0
  padding: var(--spacing-6) var(--spacing-8)
  display: flex
  flex-direction: column
  gap: var(--spacing-5)
  filter: blur(8px)
  pointer-events: none
  user-select: none
  opacity: 0.9

.mock-bar
  background-color: var(--color-border)
  border-radius: var(--radius-sm)
  height: 12px
  flex-shrink: 0

  &--wide
    width: min(280px, 40vw)

  &--medium
    width: min(160px, 28vw)

  &--short
    width: min(96px, 18vw)
    height: 10px

  &--num
    width: 72px
    height: 22px
    border-radius: var(--radius-xs)

  &--icon
    width: 40px
    height: 40px
    border-radius: var(--radius-md)
    background-color: var(--color-primary-muted)

  &--th
    flex: 1
    height: 10px

  &--avatar
    width: 32px
    height: 32px
    border-radius: var(--radius-full)
    flex-shrink: 0
    background-color: var(--color-primary-muted)

  &--cell-wide
    flex: 2
    height: 10px

  &--cell
    flex: 1
    height: 10px

  &--cell-short
    flex: 0 0 88px
    height: 10px

.mock-header
  display: flex
  align-items: center
  gap: var(--spacing-4)
  padding-bottom: var(--spacing-4)
  border-bottom: 1px solid var(--color-border)
  flex-shrink: 0

.mock-stats
  display: grid
  grid-template-columns: repeat(4, minmax(0, 1fr))
  gap: var(--spacing-4)
  flex-shrink: 0

.mock-stat-card
  display: flex
  align-items: center
  gap: var(--spacing-3)
  padding: var(--spacing-4)
  background-color: var(--color-card-bg)
  border: 1px solid var(--color-card-border)
  border-radius: var(--radius-lg)

.mock-stat-lines
  display: flex
  flex-direction: column
  gap: var(--spacing-2)
  min-width: 0

.mock-body
  flex: 1
  min-height: 0
  display: grid
  grid-template-columns: minmax(0, 2fr) minmax(220px, 1fr)
  gap: var(--spacing-5)

.mock-table
  background-color: var(--color-card-bg)
  border: 1px solid var(--color-card-border)
  border-radius: var(--radius-lg)
  overflow: hidden
  min-height: 0
  display: flex
  flex-direction: column

.mock-table-header
  display: flex
  gap: var(--spacing-4)
  padding: var(--spacing-3) var(--spacing-4)
  background-color: var(--color-bg-secondary)
  border-bottom: 1px solid var(--color-border)
  flex-shrink: 0

.mock-row
  display: flex
  align-items: center
  gap: var(--spacing-4)
  padding: var(--spacing-3) var(--spacing-4)
  border-bottom: 1px solid var(--color-border)

  &:last-child
    border-bottom: none

.mock-chart
  background-color: var(--color-card-bg)
  border: 1px solid var(--color-card-border)
  border-radius: var(--radius-lg)
  padding: var(--spacing-5)
  min-height: 100%
  display: flex
  align-items: flex-end

.mock-chart-bars
  display: flex
  align-items: flex-end
  gap: 8px
  width: 100%
  height: 100%
  min-height: 160px

.mock-chart-bar
  flex: 1
  background-color: var(--color-primary-muted)
  border-radius: var(--radius-xs) var(--radius-xs) 0 0
  min-width: 0

.ud-card
  position: relative
  z-index: 2
  display: flex
  flex-direction: column
  align-items: center
  gap: var(--spacing-4)
  padding: var(--spacing-8) var(--spacing-10)
  border-radius: var(--radius-2xl)
  background-color: rgba(255, 255, 255, 0.78)
  backdrop-filter: blur(20px) saturate(1.4)
  -webkit-backdrop-filter: blur(20px) saturate(1.4)
  border: 1px solid rgba(255, 255, 255, 0.65)
  box-shadow: var(--shadow-xl), 0 0 0 1px var(--color-border)
  text-align: center
  max-width: min(480px, calc(100% - var(--spacing-8)))
  width: 100%
  margin: var(--spacing-6)
  animation: ud-card-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both

[data-theme="dark"] .ud-card
  background-color: rgba(22, 27, 34, 0.85)
  border-color: rgba(255, 255, 255, 0.08)
  box-shadow: var(--shadow-xl), 0 0 0 1px rgba(255, 255, 255, 0.06)

.ud-icon-wrap
  display: flex
  align-items: center
  justify-content: center
  width: 64px
  height: 64px
  border-radius: var(--radius-xl)
  background-color: var(--color-primary-muted)
  color: var(--color-primary)

.ud-icon
  width: 32px
  height: 32px

.ud-badge
  display: inline-flex
  align-items: center
  padding: var(--spacing-1) var(--spacing-4)
  border-radius: var(--radius-full)
  font-size: var(--font-size-xs)
  font-weight: var(--font-weight-semibold)
  letter-spacing: 0.04em
  text-transform: uppercase
  background-color: var(--color-primary-light)
  color: var(--color-primary)
  border: 1px solid var(--color-primary-muted)

.ud-title
  font-size: var(--font-size-2xl)
  font-weight: var(--font-weight-bold)
  color: var(--color-text)
  margin: 0
  line-height: var(--line-height-tight)

.ud-description
  font-size: var(--font-size-base)
  color: var(--color-text-secondary)
  margin: 0
  line-height: var(--line-height-relaxed)
  max-width: 36ch

@keyframes ud-card-in
  from
    opacity: 0
    transform: translateY(12px) scale(0.98)
  to
    opacity: 1
    transform: translateY(0) scale(1)

@media (max-width: 992px)
  .mock-body
    grid-template-columns: 1fr

  .mock-stats
    grid-template-columns: repeat(2, minmax(0, 1fr))

@media (max-width: 576px)
  .ud-backdrop
    padding: var(--spacing-4)

  .ud-card
    padding: var(--spacing-6)
    margin: var(--spacing-4)

  .mock-stats
    grid-template-columns: 1fr 1fr

  .mock-stat-card:nth-child(n+3)
    display: none
</style>
