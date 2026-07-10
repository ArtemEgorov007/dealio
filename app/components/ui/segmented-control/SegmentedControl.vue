<script setup lang="ts">
interface SegmentedOption {
  value: string
  label?: string
  icon?: string
}

interface Props {
  modelValue: string
  options: SegmentedOption[]
  align?: 'center' | 'start'
}

withDefaults(defineProps<Props>(), {
  align: 'center',
})

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div class="ui-segmented" :class="{ 'ui-segmented--align-start': align === 'start' }">
    <button
        v-for="opt in options"
        :key="opt.value"
        type="button"
        class="ui-segmented__opt"
        :class="{ 'ui-segmented__opt--active': modelValue === opt.value }"
        @click="$emit('update:modelValue', opt.value)"
    >
      <Icon v-if="opt.icon" :name="opt.icon" size="15" class="ui-segmented__icon"/>
      {{ opt.label ?? opt.value }}
    </button>
  </div>
</template>

<style scoped lang="sass">
.ui-segmented
  display: flex
  flex-wrap: nowrap
  gap: 2px
  background: var(--color-bg)
  border-radius: 9px
  padding: 2px

.ui-segmented__opt
  flex: 1 1 0
  min-width: 0
  display: flex
  align-items: center
  justify-content: center
  gap: 6px
  padding: 7px 8px
  border: none
  border-radius: 7px
  background: transparent
  color: var(--color-text)
  font-size: var(--font-size-sm)
  font-weight: 500
  font-family: inherit
  cursor: pointer

  &--active
    background: var(--color-card-bg)
    color: var(--color-text)
    font-weight: 600
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12), 0 0.5px 1px rgba(0, 0, 0, 0.06)

.ui-segmented--align-start .ui-segmented__opt
  align-items: start

.ui-segmented__icon
  flex-shrink: 0
</style>
