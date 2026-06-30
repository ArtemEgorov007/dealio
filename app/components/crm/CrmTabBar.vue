<script setup lang="ts">
const route = useRoute()
const router = useRouter()

const isPackingSection = computed(() =>
    route.path === '/scan-qr' || (route.path === '/workshop' && route.query.flow === 'packing'),
)

const isHandoverSection = computed(() =>
    ['/scan-handover', '/handover-shift'].includes(route.path),
)

const isBadgesSection = computed(() =>
    !isPackingSection.value && !isHandoverSection.value
    && ['/workshop', '/badges', '/receipt', '/shift'].includes(route.path),
)

const isProfileSection = computed(() => route.path === '/register')

const goProfile = () => router.push('/register')
const goBadges = () => router.push('/workshop')
const goPacking = () => router.push('/workshop?flow=packing')
const goHandover = () => router.push('/scan-handover')
</script>

<template>
  <nav class="crm-tabbar" aria-label="Разделы CRM">
    <button
        type="button"
        class="crm-tabbar__item"
        :class="{ 'crm-tabbar__item--active': isProfileSection }"
        @click="goProfile"
    >
      <Icon name="heroicons:user-circle" size="22"/>
      <span>Профиль</span>
    </button>
    <button
        type="button"
        class="crm-tabbar__item"
        :class="{ 'crm-tabbar__item--active': isBadgesSection }"
        @click="goBadges"
    >
      <Icon name="heroicons:tag" size="22"/>
      <span>Бирки</span>
    </button>
    <button
        type="button"
        class="crm-tabbar__item"
        :class="{ 'crm-tabbar__item--active': isPackingSection }"
        @click="goPacking"
    >
      <Icon name="heroicons:qr-code" size="22"/>
      <span>Упаковка</span>
    </button>
    <button
        type="button"
        class="crm-tabbar__item"
        :class="{ 'crm-tabbar__item--active': isHandoverSection }"
        @click="goHandover"
    >
      <Icon name="heroicons:check-badge" size="22"/>
      <span>Сдача</span>
    </button>
  </nav>
</template>

<style scoped lang="sass">
.crm-tabbar
  flex-shrink: 0
  display: flex
  border-top: var(--border-width) solid var(--color-border)
  background-color: var(--color-bg)
  padding-bottom: env(safe-area-inset-bottom)

.crm-tabbar__item
  flex: 1
  display: flex
  flex-direction: column
  align-items: center
  gap: 2px
  padding: 8px 4px 6px
  border: none
  background: none
  color: var(--color-text-muted)
  font-size: var(--font-size-xs)
  font-weight: 600
  cursor: pointer

  &--active
    color: var(--color-primary)
</style>
