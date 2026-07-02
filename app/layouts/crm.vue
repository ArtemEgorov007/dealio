<template>
  <div class="crm-layout">
    <div class="crm-layout__content">
      <slot/>
    </div>
    <CrmTabBar/>
  </div>
</template>

<style scoped lang="sass">
.crm-layout
  height: 100vh
  height: 100dvh
  display: flex
  flex-direction: column
  background-color: var(--color-bg)
  color: var(--color-text)

.crm-layout__content
  flex: 1
  min-height: 0
  display: flex
  flex-direction: column
</style>
