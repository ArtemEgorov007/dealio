<script setup lang="ts">
export interface SelectOption {
  value: string | number
  label: string
}

interface Props {
  modelValue?: string | number
  label?: string
  options: SelectOption[]
  error?: string
  disabled?: boolean
  required?: boolean
  id?: string
  placeholder?: string
  size?: 'sm' | 'md'
  tone?: 'default' | 'high' | 'medium' | 'low'
  flush?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  disabled: false,
  required: false,
  size: 'md',
  tone: 'default',
  flush: false,
  placeholder: 'Выберите',
})

const emit = defineEmits<{
  (e: 'update:modelValue' | 'change', value: string | number): void
}>()

const rootRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const generatedId = ref('')

onMounted(() => {
  if (!props.id) {
    generatedId.value = `select-${crypto.randomUUID()}`
  }
})

const selectId = computed(() => props.id || generatedId.value)

const selectedOption = computed(() =>
    props.options.find(option => String(option.value) === String(props.modelValue)),
)

const displayLabel = computed(() => selectedOption.value?.label ?? props.placeholder)

const listboxId = computed(() => `${selectId.value}-listbox`)

const selectOption = (option: SelectOption) => {
  if (props.disabled) return
  emit('update:modelValue', option.value)
  emit('change', option.value)
  isOpen.value = false
}

const toggleDropdown = () => {
  if (props.disabled) return
  isOpen.value = !isOpen.value
}

const closeDropdown = () => {
  isOpen.value = false
}

const onTriggerKeydown = (event: KeyboardEvent) => {
  if (props.disabled) return

  if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    isOpen.value = true
  }

  if (event.key === 'Escape') {
    isOpen.value = false
  }
}

const onListKeydown = (event: KeyboardEvent) => {
  const index = props.options.findIndex(option => String(option.value) === String(props.modelValue))
  let nextIndex = index

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    nextIndex = index < props.options.length - 1 ? index + 1 : 0
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    nextIndex = index > 0 ? index - 1 : props.options.length - 1
  }

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    const current = props.options[index]
    if (current) selectOption(current)
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    isOpen.value = false
    return
  }

  const next = props.options[nextIndex]
  if (nextIndex !== index && next) {
    selectOption(next)
  }
}

onClickOutside(rootRef, closeDropdown)
</script>

<template>
  <div
      ref="rootRef"
      class="ui-select"
      :class="[
        `ui-select--${size}`,
        {
          'ui-select--disabled': disabled,
          'ui-select--flush': flush,
          'ui-select--open': isOpen,
        }
      ]"
  >
    <label
        v-if="label"
        :id="`${selectId}-label`"
        class="ui-select__label"
        :class="{ 'ui-select__label--required': required }"
    >
      {{ label }}
    </label>

    <div class="ui-select__wrap">
      <button
          :id="selectId"
          type="button"
          class="ui-select__trigger"
          :class="[
            { 'ui-select__trigger--error': !!error, 'ui-select__trigger--placeholder': !selectedOption },
            `ui-select__trigger--tone-${tone}`
          ]"
          :disabled="disabled"
          :aria-expanded="isOpen"
          :aria-haspopup="'listbox'"
          :aria-controls="listboxId"
          :aria-labelledby="label ? `${selectId}-label` : undefined"
          :aria-invalid="!!error"
          :aria-describedby="error ? `${selectId}-error` : undefined"
          @click="toggleDropdown"
          @keydown="onTriggerKeydown"
      >
        <span class="ui-select__value">{{ displayLabel }}</span>
        <span class="ui-select__chevron" aria-hidden="true">
          <Icon name="heroicons:chevron-down" size="14"/>
        </span>
      </button>

      <Transition name="ui-select-drop">
        <ul
            v-if="isOpen"
            :id="listboxId"
            class="ui-select__menu"
            role="listbox"
            :aria-labelledby="label ? `${selectId}-label` : selectId"
            tabindex="-1"
            @keydown="onListKeydown"
        >
          <li
              v-for="option in options"
              :key="String(option.value)"
              role="option"
              class="ui-select__option"
              :class="{
                'ui-select__option--active': String(option.value) === String(modelValue),
              }"
              :aria-selected="String(option.value) === String(modelValue)"
              @click="selectOption(option)"
          >
            {{ option.label }}
          </li>
        </ul>
      </Transition>
    </div>

    <p v-if="error" :id="`${selectId}-error`" class="ui-select__error">
      {{ error }}
    </p>
  </div>
</template>

<style scoped lang="sass">
.ui-select
  display: flex
  flex-direction: column
  width: 100%
  font-family: var(--font-family-base)
  margin-bottom: var(--spacing-4)
  position: relative

  &--sm
    margin-bottom: 0

    .ui-select__label
      margin-bottom: 4px
      font-size: 10px

    .ui-select__trigger
      height: 32px
      padding: 0 28px 0 var(--spacing-3)
      font-size: var(--font-size-xs)

    .ui-select__chevron
      right: 8px

    .ui-select__menu
      font-size: var(--font-size-xs)
      padding: var(--spacing-1) var(--spacing-2)
      gap: 2px

    .ui-select__option
      padding: 6px var(--spacing-2)

  &--disabled
    opacity: 0.6

  &--flush
    margin-bottom: 0

  &--open
    z-index: calc(var(--z-index-dropdown) + 1)

    .ui-select__chevron
      color: var(--color-primary)
      transform: translateY(-50%) rotate(180deg)

  &__label
    margin-bottom: 6px
    font-weight: 600
    color: var(--color-text)
    font-size: var(--font-size-xs)
    letter-spacing: 0.2px
    text-transform: uppercase

    &--required::after
      content: " *"
      color: var(--color-danger)

  &__wrap
    position: relative

  &__trigger
    width: 100%
    height: 38px
    padding: 0 36px 0 var(--spacing-4)
    border: var(--border-width) solid var(--color-input-border)
    border-radius: var(--radius-md)
    background-color: var(--color-input-bg)
    color: var(--color-input-text)
    font-size: var(--font-size-sm)
    line-height: 1.5
    cursor: pointer
    display: flex
    align-items: center
    text-align: left
    font-family: inherit
    transition: border-color var(--transition-normal) ease, box-shadow var(--transition-normal) ease

    &:focus-visible
      outline: none
      border-color: var(--color-input-border-focus)
      box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.12)

    &:hover:not(:disabled)
      border-color: var(--color-input-border-hover)

    &:disabled
      background-color: var(--color-input-disabled-bg)
      color: var(--color-input-disabled-text)
      cursor: not-allowed

    &--placeholder .ui-select__value
      color: var(--color-input-placeholder)

    &--error
      border-color: var(--color-danger)

      &:focus-visible
        box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1)

    &--tone-high
      color: var(--color-danger)

    &--tone-medium
      color: var(--color-accent)

    &--tone-low
      color: var(--color-text-muted)

  &__value
    flex: 1
    min-width: 0
    overflow: hidden
    text-overflow: ellipsis
    white-space: nowrap

  &__chevron
    position: absolute
    right: 12px
    top: 50%
    transform: translateY(-50%)
    display: flex
    align-items: center
    justify-content: center
    color: var(--color-text-muted)
    pointer-events: none
    transition: color var(--transition-normal) ease, transform var(--transition-normal) ease

  &__menu
    position: absolute
    top: calc(100% + var(--spacing-2))
    left: 0
    right: 0
    margin: 0
    padding: var(--spacing-2)
    list-style: none
    display: flex
    flex-direction: column
    gap: var(--spacing-1)
    background-color: var(--color-card-bg)
    border: var(--border-width) solid var(--color-border)
    border-radius: var(--radius-md)
    box-shadow: var(--shadow-lg)
    max-height: 220px
    overflow-y: auto
    z-index: var(--z-index-dropdown)

  &__option
    padding: var(--spacing-2) var(--spacing-3)
    border-radius: var(--radius-sm)
    font-size: var(--font-size-sm)
    font-weight: 500
    color: var(--color-text)
    cursor: pointer
    transition: background-color var(--transition-fast) ease, color var(--transition-fast) ease

    &:hover
      background-color: var(--color-primary-light)
      color: var(--color-primary)

    &--active
      background-color: var(--color-primary-light)
      color: var(--color-primary)
      font-weight: 600

  &__error
    margin-top: 5px
    color: var(--color-danger)
    font-size: var(--font-size-xs)
    font-weight: 500

.ui-select-drop-enter-active,
.ui-select-drop-leave-active
  transition: opacity 0.14s ease, transform 0.14s ease

.ui-select-drop-enter-from,
.ui-select-drop-leave-to
  opacity: 0
  transform: translateY(-4px)

@media (max-width: 768px)
  .ui-select:not(.ui-select--sm)
    margin-bottom: var(--spacing-3)
</style>
