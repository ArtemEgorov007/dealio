<script setup lang="ts">
const query = defineModel<string>({default: ''})

withDefaults(defineProps<{
  placeholder?: string
  countLabel?: string
  onLight?: boolean
}>(), {
  placeholder: 'Поиск',
  countLabel: '',
  onLight: false,
})

const emit = defineEmits<{
  clear: []
}>()

const clear = () => {
  query.value = ''
  emit('clear')
}
</script>

<template>
  <div class="erp-search">
    <div class="erp-search__field-wrap">
      <Icon name="heroicons:magnifying-glass" size="17" class="erp-search__icon"/>
      <input
          v-model="query"
          type="search"
          inputmode="search"
          enterkeyhint="search"
          class="erp-search__field"
          :placeholder="placeholder"
      >
      <button
          v-if="query"
          type="button"
          class="erp-search__clear"
          aria-label="Очистить строку поиска"
          @click="clear"
      >
        <Icon name="heroicons:x-circle" size="18"/>
      </button>
    </div>
    <p v-if="countLabel" class="erp-search__meta" :class="{ 'erp-search__meta--on-light': onLight }">{{ countLabel }}</p>
  </div>
</template>

<style scoped lang="sass">
.erp-search__field-wrap
  position: relative
  display: flex
  align-items: center

.erp-search__icon
  position: absolute
  left: 10px
  color: rgba(60, 60, 67, 0.45)
  pointer-events: none

.erp-search__field
  width: 100%
  height: 40px
  padding: 0 36px 0 36px
  border: none
  border-radius: 12px
  /* Белая пилюля — чётко читается на синей градиент-шапке */
  background-color: #fff
  color: #16202e
  font-size: 16px
  appearance: none
  box-shadow: 0 2px 8px -2px rgba(1, 74, 156, 0.25)

  &::-webkit-search-cancel-button
    display: none

  &::placeholder
    color: rgba(60, 60, 67, 0.5)

  &:focus-visible
    outline: none
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.45)

.erp-search__clear
  position: absolute
  right: 6px
  display: flex
  align-items: center
  justify-content: center
  width: 28px
  height: 28px
  border: none
  border-radius: 50%
  background: none
  color: rgba(60, 60, 67, 0.45)
  cursor: pointer

.erp-search__meta
  margin: 8px 0 0
  padding: 0 4px
  font-size: 13px
  font-weight: 500
  color: rgba(255, 255, 255, 0.9)

  /* Компонент по умолчанию расчитан на слот #search в синей шапке (см.
     badges.vue) — на светлом фоне тела экрана белый текст нечитаем */
  &--on-light
    color: var(--color-text-secondary)
</style>
