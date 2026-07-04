<script setup lang="ts">
const props = withDefaults(defineProps<{
  tag?: 'button' | 'div' | 'article'
  chevron?: boolean
  selected?: boolean
  multiline?: boolean
  disabled?: boolean
}>(), {
  tag: 'button',
  chevron: false,
  selected: false,
  multiline: false,
  disabled: false,
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const onClick = (event: MouseEvent) => {
  if (props.disabled) return
  emit('click', event)
}
</script>

<template>
  <component
      :is="tag"
      class="erp-list-row"
      :class="{
        'erp-list-row--button': tag === 'button',
        'erp-list-row--selected': selected,
        'erp-list-row--multiline': multiline,
        'erp-list-row--disabled': disabled,
      }"
      :type="tag === 'button' ? 'button' : undefined"
      :disabled="tag === 'button' ? disabled : undefined"
      @click="onClick"
  >
    <span v-if="$slots.leading" class="erp-list-row__leading">
      <slot name="leading"/>
    </span>

    <span class="erp-list-row__body">
      <slot/>
    </span>

    <span v-if="$slots.trailing || chevron || selected" class="erp-list-row__trailing">
      <slot name="trailing"/>
      <Icon
          v-if="selected && !$slots.trailing"
          name="heroicons:check"
          size="20"
          class="erp-list-row__check"
      />
      <Icon
          v-else-if="chevron && !$slots.trailing"
          name="heroicons:chevron-right"
          size="16"
          class="erp-list-row__chevron"
      />
    </span>
  </component>
</template>

<style scoped lang="sass">
.erp-list-row
  display: flex
  flex-shrink: 0
  align-items: center
  gap: 12px
  width: 100%
  min-height: 44px
  padding: 11px 16px
  margin: 0
  border: none
  border-bottom: 0.5px solid rgba(60, 60, 67, 0.15)
  background: none
  color: var(--color-text)
  text-align: left
  box-sizing: border-box

  &:last-child
    border-bottom: none

  &--button
    cursor: pointer
    transition: background-color 0.12s ease

    &:active:not(.erp-list-row--disabled)
      background-color: rgba(60, 60, 67, 0.08)

  &--multiline
    align-items: flex-start
    padding-top: 12px
    padding-bottom: 12px

  &--disabled
    opacity: 0.45
    cursor: default

.erp-list-row__leading
  flex-shrink: 0
  display: flex
  align-items: center

.erp-list-row__body
  flex: 1
  min-width: 0
  font-size: 15px
  font-weight: 400
  line-height: 1.35

.erp-list-row--multiline .erp-list-row__body
  white-space: pre-line

.erp-list-row__trailing
  flex-shrink: 0
  display: flex
  align-items: center
  gap: 8px

.erp-list-row__chevron
  color: rgba(60, 60, 67, 0.30)

.erp-list-row__check
  color: var(--color-primary)
</style>
