<script setup lang="ts">
const route = useRoute()

// Таб-бар прячем на входе и на главной-хабе (/register): там навигация —
// это плитки. В разделах он плавно появляется для переключения.
const showTabBar = computed(() => {
    const path = route.path.length > 1 ? route.path.replace(/\/$/, '') : route.path
    return path !== '/register' && path !== '/'
})
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
</style>
