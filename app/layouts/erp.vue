<script setup lang="ts">
import {useErpEmployeeStore} from '~~/store/erp-employee.store'

const route = useRoute()
const employeeStore = useErpEmployeeStore()

// Таб-бар прячем на входе и на главной-хабе (/register): там навигация —
// это плитки. В разделах он плавно появляется для переключения.
const routeAllowsTabBar = computed(() => {
    const path = route.path.length > 1 ? route.path.replace(/\/$/, '') : route.path
    return path !== '/register' && path !== '/'
})

// На телефоне открытая клавиатура сжимает 100dvh-контейнер, и таб-бар
// вклинивается прямо над клавиатурой (баг с реального устройства). Прячем
// его на время ввода той же transition, что и на /register — как только
// фокус уходит с поля, бар выезжает обратно. На десктопе (см. брейкпоинт
// в ErpTabBar.vue) бар — вертикальный рельс сбоку, виртуальной клавиатуры
// нет и сжимать нечего, так что там это не должно прятать рельс.
const isInputFocused = ref(false)
const isDesktop = ref(false)

const isTextInput = (target: EventTarget | null): boolean =>
    target instanceof HTMLElement
    && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

const onFocusIn = (event: FocusEvent) => {
    if (isTextInput(event.target)) isInputFocused.value = true
}
const onFocusOut = (event: FocusEvent) => {
    if (isTextInput(event.target)) isInputFocused.value = false
}

// Совпадает с брейкпоинтом $(min-width: 900px) в ErpTabBar.vue.
const desktopMedia = import.meta.client ? window.matchMedia('(min-width: 900px)') : null
const updateIsDesktop = () => {
    if (desktopMedia) isDesktop.value = desktopMedia.matches
}

onMounted(() => {
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    updateIsDesktop()
    desktopMedia?.addEventListener('change', updateIsDesktop)
})

onBeforeUnmount(() => {
    document.removeEventListener('focusin', onFocusIn)
    document.removeEventListener('focusout', onFocusOut)
    desktopMedia?.removeEventListener('change', updateIsDesktop)
})

const showTabBar = computed(() => routeAllowsTabBar.value && (isDesktop.value || !isInputFocused.value))

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
