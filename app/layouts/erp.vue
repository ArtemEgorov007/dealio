<template>
  <div class="erp-layout">
    <div class="erp-layout__content">
      <slot/>
    </div>
    <ErpTabBar/>
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
</style>
