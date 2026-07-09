<script setup lang="ts">
import {useErpEmployeeStore} from '~~/store/erp-employee.store'

const route = useRoute()
const employeeStore = useErpEmployeeStore()

// Таб-бар прячем на входе и на главной-хабе (/register): там навигация —
// это плитки. В разделах он плавно появляется для переключения. Скрытие
// при вводе (клавиатура сжимает layout) решается per-page через footerHidden
// у ErpScreen (см. /measurement, /badges) — не здесь, таб-бар сам не прячется.
const showTabBar = computed(() => {
    const path = route.path.length > 1 ? route.path.replace(/\/$/, '') : route.path
    return path !== '/register' && path !== '/'
})

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
