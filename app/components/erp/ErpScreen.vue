<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
  overline?: string
  shiftLink?: { to: string; label: string; icon?: string; iconSize?: number }
  icon?: string
  centerBrand?: boolean
  footerHidden?: boolean
}>()

const baseURL = useRuntimeConfig().app.baseURL
const logoSrc = baseURL + 'logo-mt.svg'
const markSrc = baseURL + 'logo-mt-mark.svg'

useSeoMeta({themeColor: '#016ED7'})
useHead({meta: [{name: 'color-scheme', content: 'light'}]})
</script>

<template>
  <section class="erp-screen">
    <header class="erp-screen__head" :class="{ 'erp-screen__head--center': centerBrand }">
      <div class="erp-screen__head-inner">
        <template v-if="centerBrand">
          <img :src="markSrc" alt="" class="erp-screen__brand-hero">
          <h1 class="erp-screen__title erp-screen__title--center">{{ title }}</h1>
          <p v-if="subtitle" class="erp-screen__subtitle erp-screen__subtitle--center">{{ subtitle }}</p>
        </template>
        <template v-else>
          <div class="erp-screen__head-row">
            <div class="erp-screen__brand">
              <img :src="logoSrc" alt="Морфлот Технология" class="erp-screen__brand-mark">
            </div>
            <div class="erp-screen__head-actions">
              <NuxtLink v-if="shiftLink" :to="shiftLink.to" class="erp-screen__shift-link">
                <Icon :name="shiftLink.icon || 'heroicons:clipboard-document-list'" :size="shiftLink.iconSize || 16"/>
                {{ shiftLink.label }}
              </NuxtLink>
              <slot name="actions"/>
            </div>
          </div>
          <p v-if="overline" class="erp-screen__overline">{{ overline }}</p>
          <h1 class="erp-screen__title">
            <Icon v-if="icon" :name="icon" size="22" class="erp-screen__title-icon"/>
            {{ title }}
          </h1>
          <p v-if="subtitle" class="erp-screen__subtitle">{{ subtitle }}</p>
        </template>
        <div v-if="$slots.hero" class="erp-screen__hero">
          <slot name="hero"/>
        </div>
        <div v-if="$slots.search" class="erp-screen__search">
          <slot name="search"/>
        </div>
      </div>
    </header>

    <div class="erp-screen__body">
      <slot/>
    </div>

    <footer
        v-if="$slots.footer"
        class="erp-screen__footer"
        :class="{ 'erp-screen__footer--hidden': footerHidden }"
        :inert="footerHidden || undefined"
    >
      <div class="erp-screen__footer-inner">
        <slot name="footer"/>
      </div>
    </footer>
  </section>
</template>

<style scoped lang="sass">
.erp-screen
  width: 100%
  max-width: 480px
  margin: 0 auto
  flex: 1
  min-height: 0
  display: flex
  flex-direction: column
  box-sizing: border-box

  // На десктопе (рельс слева, см. ErpTabBar.vue) 480px в центре широкого
  // окна оставляет огромные пустые поля по бокам — расширяем колонку,
  // остаётся по-прежнему по центру, просто менее вопиюще узкая.
  @media (min-width: 900px)
    max-width: 720px

.erp-screen__head
  flex-shrink: 0
  background: var(--erp-grad-header)
  color: #fff
  padding-top: calc(env(safe-area-inset-top, 0px) + 18px)
  border-radius: 0 0 24px 24px
  box-shadow: 0 6px 20px -10px rgba(1, 110, 215, 0.5)

.erp-screen__head-inner
  padding: 0 var(--spacing-4) 22px

.erp-screen__head-row
  display: flex
  align-items: center
  justify-content: space-between
  gap: var(--spacing-3)
  min-height: 34px
  margin-bottom: 18px

.erp-screen__brand
  display: flex
  align-items: center

.erp-screen__brand-mark
  height: 30px
  width: auto
  display: block
  /* Лого не меняем — только рендерим белым для контраста на синей шапке */
  filter: brightness(0) invert(1)

.erp-screen__head-actions
  display: flex
  align-items: center
  gap: var(--spacing-2)

/* Центрированная брендовая шапка (экран входа) */
.erp-screen__head--center .erp-screen__head-inner
  padding-top: 10px
  padding-bottom: 30px
  text-align: center

.erp-screen__brand-hero
  width: 52px
  height: 52px
  display: block
  margin: 0 auto 12px
  filter: brightness(0) invert(1)

.erp-screen__title--center
  justify-content: center
  font-size: 21px
  margin-bottom: 2px

.erp-screen__subtitle--center
  color: #d5e6fb

.erp-screen__overline
  font-size: 12px
  font-weight: 500
  color: rgba(255, 255, 255, 0.85)
  margin-bottom: 2px

.erp-screen__shift-link
  flex-shrink: 0
  display: flex
  align-items: center
  gap: 5px
  padding: 6px 12px
  border-radius: var(--radius-full)
  background-color: rgba(255, 255, 255, 0.18)
  color: #fff
  font-size: var(--font-size-xs)
  font-weight: 600
  white-space: nowrap
  text-decoration: none
  border: none

.erp-screen__title
  display: flex
  align-items: center
  gap: var(--spacing-2)
  font-size: 26px
  font-weight: 800
  letter-spacing: -0.4px
  line-height: 1.1
  margin-bottom: var(--spacing-1)
  color: #fff

.erp-screen__title-icon
  flex-shrink: 0
  color: #fff
  opacity: 0.92

.erp-screen__subtitle
  font-size: var(--font-size-base)
  color: rgba(255, 255, 255, 0.85)
  line-height: 1.4

.erp-screen__hero
  margin-top: var(--spacing-4)

.erp-screen__stats
  display: flex
  gap: var(--spacing-3)

.erp-screen__stat
  flex: 1
  display: flex
  flex-direction: column
  gap: 1px
  padding: 10px 12px
  border-radius: 13px
  background: rgba(255, 255, 255, 0.16)

.erp-screen__stat-num
  font-size: 22px
  font-weight: 800
  line-height: 1.1
  color: #fff
  font-variant-numeric: tabular-nums

.erp-screen__stat-label
  font-size: 11px
  color: rgba(255, 255, 255, 0.85)

.erp-screen__search
  margin-top: var(--spacing-4)

.erp-screen__body
  flex: 1
  min-height: 0
  overflow-y: auto
  scrollbar-gutter: stable
  -webkit-overflow-scrolling: touch
  display: flex
  flex-direction: column
  align-items: stretch
  gap: var(--spacing-3)
  padding: 18px var(--spacing-4) var(--spacing-4)

  > *
    flex-shrink: 0

.erp-screen__footer
  flex-shrink: 0
  display: grid
  grid-template-rows: 1fr
  padding: var(--spacing-3) var(--spacing-4) calc(var(--spacing-4) + env(safe-area-inset-bottom))
  border-top: 0.5px solid var(--color-border)
  background-color: var(--color-bg)
  transition: grid-template-rows 0.3s ease, padding 0.3s ease, opacity 0.25s ease, transform 0.3s ease

  /* Плавно уезжает вниз (ввод в поиске) и выезжает обратно */
  &--hidden
    grid-template-rows: 0fr
    padding-top: 0
    padding-bottom: 0
    opacity: 0
    transform: translateY(12px)
    border-top-color: transparent
    pointer-events: none

.erp-screen__footer-inner
  min-height: 0
  overflow: hidden
  display: flex
  flex-direction: column
  gap: var(--spacing-2)
</style>
