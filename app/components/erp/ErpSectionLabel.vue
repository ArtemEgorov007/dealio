<template>
  <p class="erp-section-label">
    <slot/>
  </p>
</template>

<style scoped lang="sass">
.erp-section-label
  // Больше отступа ДО заголовка (отделяет от предыдущего блока), меньше ПОСЛЕ
  // (плотно с собственным контентом) — иначе оба зазора равны gap контейнера
  // и группировка блоков визуально не читается.
  margin: 8px 0 0
  padding: 0 4px
  font-size: 13px
  font-weight: 600
  letter-spacing: -0.1px
  line-height: 1.3
  color: var(--color-text-secondary)
  text-transform: none
</style>
