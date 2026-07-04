<script setup lang="ts">
const query = defineModel<string>({default: ''})

defineProps<{
  placeholder?: string
  countLabel?: string
}>()

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
          :placeholder="placeholder ?? 'Поиск'"
      >
      <button
          v-if="query"
          type="button"
          class="erp-search__clear"
          aria-label="Очистить поиск"
          @click="clear"
      >
        <Icon name="heroicons:x-circle" size="18"/>
      </button>
    </div>
    <p v-if="countLabel" class="erp-search__meta">{{ countLabel }}</p>
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
  height: 36px
  padding: 0 34px 0 34px
  border: none
  border-radius: 10px
  background-color: rgba(118, 118, 128, 0.12)
  color: var(--color-text)
  font-size: 16px
  appearance: none

  &::-webkit-search-cancel-button
    display: none

  &::placeholder
    color: rgba(60, 60, 67, 0.45)

  &:focus-visible
    outline: none
    box-shadow: 0 0 0 3px rgba(1, 110, 215, 0.15)

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
  margin: 6px 0 0
  padding: 0 4px
  font-size: 13px
  color: var(--color-text-secondary)
</style>
