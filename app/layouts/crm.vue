<template>
  <div class="crm-layout">
    <slot/>
  </div>
</template>

<style scoped lang="sass">
.crm-layout
  min-height: 100dvh
  display: flex
  flex-direction: column
  background-color: var(--color-bg)
  color: var(--color-text)
</style>
