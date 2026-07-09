<script setup lang="ts">
import {useErpEmployeeStore} from '~~/store/erp-employee.store'
import {useTabBarHidden} from '~/composables/useTabBarHidden'

const route = useRoute()
const employeeStore = useErpEmployeeStore()
const isTabBarHidden = useTabBarHidden()

// Таб-бар прячем на входе и на главной-хабе (/register): там навигация —
// это плитки. В разделах он плавно появляется для переключения.
const routeAllowsTabBar = computed(() => {
    const path = route.path.length > 1 ? route.path.replace(/\/$/, '') : route.path
    return path !== '/register' && path !== '/'
})

// isTabBarHidden — явный опт-ин конкретной страницы (см. badges.vue: фокус
// на поиске), а не глобальный слушатель фокуса на весь document. Сбрасываем
// на каждую навигацию — иначе экран, который поставил true и ушёл без
// blur, оставил бы бар спрятанным навсегда на всех следующих страницах.
watch(() => route.fullPath, () => {
    isTabBarHidden.value = false
})

// На десктопе (рельс сбоку, см. брейкпоинт в ErpTabBar.vue) прятать по
// фокусу не нужно — актуально только для мобильного нижнего бара.
const isDesktop = ref(false)
const desktopMedia = import.meta.client ? window.matchMedia('(min-width: 900px)') : null
const updateIsDesktop = () => {
    if (desktopMedia) isDesktop.value = desktopMedia.matches
}

onMounted(() => {
    updateIsDesktop()
    desktopMedia?.addEventListener('change', updateIsDesktop)
})

onBeforeUnmount(() => desktopMedia?.removeEventListener('change', updateIsDesktop))

const showTabBar = computed(() => routeAllowsTabBar.value && (isDesktop.value || !isTabBarHidden.value))

// Динамика прав: обновляем доступы при открытии приложения и каждый раз,
// когда пользователь возвращается в приложение (фокус вкладки/PWA). Так
// изменение прав в таблице видно без перелогина.
const refreshAccess = () => {
    if (document.visibilityState === 'visible') employeeStore.refreshProfile()
}

onMounted(() => {
    employeeStore.refreshProfile()
    document.addEventListener('visibilitychange', refreshAccess)
})

onBeforeUnmount(() => document.removeEventListener('visibilitychange', refreshAccess))
</script>

<template>
  <div class="erp-layout">
    <div class="erp-layout__content">
      <slot/>
    </div>
    <Transition name="erp-tabbar">
      <ErpTabBar v-if="showTabBar"/>
    </Transition>
  </div>
</template>

<style scoped lang="sass">
.erp-layout
  height: 100vh
  height: 100dvh
  display: flex
  flex-direction: column
  background-color: var(--color-bg)
  color: var(--color-text)

  // Тот же брейкпоинт, что в ErpTabBar.vue — там снизу-вверх бар
  // становится вертикальным рельсом, здесь раскладка меняется на строку.
  @media (min-width: 900px)
    flex-direction: row

.erp-layout__content
  flex: 1
  min-height: 0
  display: flex
  flex-direction: column

.erp-tabbar-enter-active,
.erp-tabbar-leave-active
  transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.28s ease

.erp-tabbar-enter-from,
.erp-tabbar-leave-to
  transform: translateY(100%)
  opacity: 0

  // Рельс слева уезжает влево, а не вниз.
  @media (min-width: 900px)
    transform: translateX(-100%)
</style>
