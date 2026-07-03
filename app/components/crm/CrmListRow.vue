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
      class="crm-list-row"
      :class="{
        'crm-list-row--button': tag === 'button',
        'crm-list-row--selected': selected,
        'crm-list-row--multiline': multiline,
        'crm-list-row--disabled': disabled,
      }"
      :type="tag === 'button' ? 'button' : undefined"
      :disabled="tag === 'button' ? disabled : undefined"
      @click="onClick"
  >
    <span v-if="$slots.leading" class="crm-list-row__leading">
      <slot name="leading"/>
    </span>

    <span class="crm-list-row__body">
      <slot/>
    </span>

    <span v-if="$slots.trailing || chevron || selected" class="crm-list-row__trailing">
      <slot name="trailing"/>
      <Icon
          v-if="selected && !$slots.trailing"
          name="heroicons:check"
          size="20"
          class="crm-list-row__check"
      />
      <Icon
          v-else-if="chevron && !$slots.trailing"
          name="heroicons:chevron-right"
          size="16"
          class="crm-list-row__chevron"
      />
    </span>
  </component>
</template>

<style scoped lang="sass">
.crm-list-row
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

    &:active:not(.crm-list-row--disabled)
      background-color: rgba(60, 60, 67, 0.08)

  &--multiline
    align-items: flex-start
    padding-top: 12px
    padding-bottom: 12px

  &--disabled
    opacity: 0.45
    cursor: default

.crm-list-row__leading
  flex-shrink: 0
  display: flex
  align-items: center

.crm-list-row__body
  flex: 1
  min-width: 0
  font-size: 15px
  font-weight: 400
  line-height: 1.35

.crm-list-row--multiline .crm-list-row__body
  white-space: pre-line

.crm-list-row__trailing
  flex-shrink: 0
  display: flex
  align-items: center
  gap: 8px

.crm-list-row__chevron
  color: rgba(60, 60, 67, 0.30)

.crm-list-row__check
  color: var(--color-primary)
</style>
