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
    <!-- Blur background: decorative mock UI -->
    <div class="ud-backdrop" aria-hidden="true">
      <!-- Mock header bar -->
      <div class="mock-header">
        <div class="mock-bar mock-bar--wide"></div>
        <div class="mock-bar mock-bar--short"></div>
        <div class="mock-bar mock-bar--short"></div>
      </div>

      <!-- Mock stats row -->
      <div class="mock-stats">
        <div class="mock-stat-card" v-for="n in 3" :key="n">
          <div class="mock-bar mock-bar--icon"></div>
          <div class="mock-stat-lines">
            <div class="mock-bar mock-bar--medium"></div>
            <div class="mock-bar mock-bar--num"></div>
          </div>
        </div>
      </div>

      <!-- Mock table / list -->
      <div class="mock-table">
        <div class="mock-table-header">
          <div class="mock-bar mock-bar--th" v-for="n in 5" :key="n"></div>
        </div>
        <div class="mock-row" v-for="row in 6" :key="row">
          <div class="mock-bar mock-bar--avatar"></div>
          <div class="mock-bar mock-bar--cell-wide"></div>
          <div class="mock-bar mock-bar--cell"></div>
          <div class="mock-bar mock-bar--cell-short"></div>
          <div class="mock-bar mock-bar--cell-short"></div>
        </div>
      </div>

      <!-- Mock chart area -->
      <div class="mock-chart">
        <div class="mock-chart-bars">
          <div
            v-for="(h, i) in [55, 80, 45, 90, 65, 75, 40, 85, 60, 70]"
            :key="i"
            class="mock-chart-bar"
            :style="{ height: h + '%' }"
          ></div>
        </div>
      </div>
    </div>

    <!-- Frosted glass overlay card -->
    <div class="ud-card">
      <div class="ud-icon-wrap">
        <Icon name="heroicons:wrench-screwdriver" class="ud-icon" />
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
  min-height: 480px
  width: 100%
  display: flex
  align-items: center
  justify-content: center
  overflow: hidden
  border-radius: var(--radius-xl)

// ── Blurred decorative backdrop ─────────────────────────────────────────────
.ud-backdrop
  position: absolute
  inset: 0
  padding: var(--spacing-6)
  display: flex
  flex-direction: column
  gap: var(--spacing-4)
  filter: blur(7px)
  pointer-events: none
  user-select: none
  transform: scale(1.04)

// Shared mock bar base
.mock-bar
  background-color: var(--color-border)
  border-radius: var(--radius-sm)
  height: 12px
  flex-shrink: 0

  &--wide
    width: 200px

  &--medium
    width: 120px

  &--short
    width: 72px
    height: 10px

  &--num
    width: 60px
    height: 20px
    border-radius: var(--radius-xs)

  &--icon
    width: 36px
    height: 36px
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
    flex: 0 0 72px
    height: 10px

// Header mock
.mock-header
  display: flex
  align-items: center
  gap: var(--spacing-4)
  padding-bottom: var(--spacing-4)
  border-bottom: 1px solid var(--color-border)

// Stats row
.mock-stats
  display: grid
  grid-template-columns: repeat(3, 1fr)
  gap: var(--spacing-4)

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

// Table mock
.mock-table
  background-color: var(--color-card-bg)
  border: 1px solid var(--color-card-border)
  border-radius: var(--radius-lg)
  overflow: hidden
  flex: 1

.mock-table-header
  display: flex
  gap: var(--spacing-4)
  padding: var(--spacing-3) var(--spacing-4)
  background-color: var(--color-bg-secondary)
  border-bottom: 1px solid var(--color-border)

.mock-row
  display: flex
  align-items: center
  gap: var(--spacing-4)
  padding: var(--spacing-3) var(--spacing-4)
  border-bottom: 1px solid var(--color-border)

  &:last-child
    border-bottom: none

// Chart mock
.mock-chart
  background-color: var(--color-card-bg)
  border: 1px solid var(--color-card-border)
  border-radius: var(--radius-lg)
  padding: var(--spacing-4)
  height: 80px
  display: flex
  align-items: flex-end

.mock-chart-bars
  display: flex
  align-items: flex-end
  gap: 6px
  width: 100%
  height: 100%

.mock-chart-bar
  flex: 1
  background-color: var(--color-primary-muted)
  border-radius: var(--radius-xs) var(--radius-xs) 0 0
  min-width: 0

// ── Frosted glass overlay card ───────────────────────────────────────────────
.ud-card
  position: relative
  z-index: 2
  display: flex
  flex-direction: column
  align-items: center
  gap: var(--spacing-4)
  padding: var(--spacing-10) var(--spacing-12)
  border-radius: var(--radius-2xl)
  background-color: rgba(255, 255, 255, 0.72)
  backdrop-filter: blur(20px) saturate(1.4)
  -webkit-backdrop-filter: blur(20px) saturate(1.4)
  border: 1px solid rgba(255, 255, 255, 0.6)
  box-shadow: var(--shadow-xl), 0 0 0 1px var(--color-border)
  text-align: center
  max-width: 420px
  width: 100%

// Dark theme override for frosted card
[data-theme="dark"] .ud-card
  background-color: rgba(22, 27, 34, 0.82)
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
  margin-bottom: var(--spacing-2)

.ud-icon
  width: 32px
  height: 32px

.ud-badge
  display: inline-flex
  align-items: center
  padding: var(--spacing-1) var(--spacing-4)
  border-radius: var(--radius-full)
  font-family: var(--font-family-base)
  font-size: var(--font-size-xs)
  font-weight: var(--font-weight-semibold)
  letter-spacing: 0.04em
  text-transform: uppercase
  background-color: var(--color-primary-light)
  color: var(--color-primary)
  border: 1px solid var(--color-primary-muted)

.ud-title
  font-family: var(--font-family-base)
  font-size: var(--font-size-2xl)
  font-weight: var(--font-weight-bold)
  color: var(--color-text)
  margin: 0
  line-height: var(--line-height-tight)

.ud-description
  font-family: var(--font-family-base)
  font-size: var(--font-size-base)
  color: var(--color-text-secondary)
  margin: 0
  line-height: var(--line-height-relaxed)
  max-width: 300px

// Responsive
@media (max-width: 576px)
  .ud-wrapper
    min-height: 360px

  .ud-card
    padding: var(--spacing-8) var(--spacing-6)
    max-width: calc(100% - var(--spacing-8))

  .mock-stats
    grid-template-columns: repeat(2, 1fr)

    .mock-stat-card:last-child
      display: none
</style>
