<script setup lang="ts">
import {useCrmEmployeeStore} from '~~/store/crm-employee.store'

defineProps<{
  title: string
  subtitle?: string
}>()

const logoSrc = useRuntimeConfig().app.baseURL + 'logo-mt.svg'
const employeeStore = useCrmEmployeeStore()
const route = useRoute()

const showShiftLink = computed(() =>
    employeeStore.hasFio && route.path !== '/shift' && route.path !== '/register',
)

useSeoMeta({themeColor: '#FBFBFB'})
useHead({meta: [{name: 'color-scheme', content: 'light'}]})
</script>

<template>
  <section class="crm-screen">
    <header class="crm-screen__head">
      <div class="crm-screen__head-row">
        <div class="crm-screen__brand">
          <img :src="logoSrc" alt="Морфлот Технология" class="crm-screen__brand-mark">
        </div>
        <NuxtLink v-if="showShiftLink" to="/shift" class="crm-screen__shift-link">
          <Icon name="heroicons:clipboard-document-list" size="16"/>
          Бирки за смену
        </NuxtLink>
      </div>
      <h1 class="crm-screen__title">{{ title }}</h1>
      <p v-if="subtitle" class="crm-screen__subtitle">{{ subtitle }}</p>
      <div v-if="$slots.search" class="crm-screen__search">
        <slot name="search"/>
      </div>
    </header>

    <div class="crm-screen__body">
      <slot/>
    </div>

    <footer v-if="$slots.footer" class="crm-screen__footer">
      <slot name="footer"/>
    </footer>
  </section>
</template>

<style scoped lang="sass">
.crm-screen
  width: 100%
  max-width: 480px
  margin: 0 auto
  padding: var(--spacing-6) var(--spacing-4) 0
  height: 100dvh
  display: flex
  flex-direction: column
  box-sizing: border-box

  @media (max-width: 768px)
    padding: var(--spacing-5) var(--spacing-4) 0

.crm-screen__head
  flex-shrink: 0
  margin-bottom: var(--spacing-4)

.crm-screen__head-row
  display: flex
  align-items: center
  justify-content: space-between
  gap: var(--spacing-3)
  margin-bottom: var(--spacing-4)

.crm-screen__brand
  display: flex

.crm-screen__brand-mark
  height: 28px
  width: auto
  display: block

.crm-screen__shift-link
  flex-shrink: 0
  display: flex
  align-items: center
  gap: 6px
  padding: 6px 10px
  border: var(--border-width) solid var(--color-border)
  border-radius: var(--radius-full)
  background-color: var(--color-card-bg)
  color: var(--color-text-secondary)
  font-size: var(--font-size-xs)
  font-weight: 600
  white-space: nowrap
  text-decoration: none

.crm-screen__title
  font-size: var(--font-size-3xl)
  font-weight: 800
  letter-spacing: -0.4px
  line-height: 1.15
  margin-bottom: var(--spacing-2)

.crm-screen__subtitle
  font-size: var(--font-size-sm)
  color: var(--color-text-muted)
  line-height: var(--line-height-relaxed)

.crm-screen__search
  margin-top: var(--spacing-4)

.crm-screen__body
  flex: 1
  min-height: 0
  overflow-y: auto
  -webkit-overflow-scrolling: touch
  display: flex
  flex-direction: column
  gap: var(--spacing-4)
  padding-bottom: var(--spacing-4)

.crm-screen__footer
  flex-shrink: 0
  display: flex
  flex-direction: column
  gap: var(--spacing-3)
  padding: var(--spacing-4) 0 calc(var(--spacing-4) + env(safe-area-inset-bottom))
  border-top: var(--border-width) solid var(--color-border)
  background-color: var(--color-bg)
</style>
