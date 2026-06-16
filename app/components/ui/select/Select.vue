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
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void
  (e: 'change', value: string | number): void
}>()

const generatedId = ref('')

onMounted(() => {
  if (!props.id) {
    generatedId.value = `select-${crypto.randomUUID()}`
  }
})

const selectId = computed(() => props.id || generatedId.value)

const selectValue = computed({
  get: () => props.modelValue,
  set: (value: string | number) => {
    emit('update:modelValue', value)
    emit('change', value)
  },
})

const handleChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  const option = props.options.find(item => String(item.value) === target.value)
  if (option) {
    selectValue.value = option.value
  }
}
</script>

<template>
  <div
      class="ui-select"
      :class="[
        `ui-select--${size}`,
        { 'ui-select--disabled': disabled, 'ui-select--flush': flush }
      ]"
  >
    <label
        v-if="label"
        :for="selectId"
        class="ui-select__label"
        :class="{ 'ui-select__label--required': required }"
    >
      {{ label }}
    </label>

    <div class="ui-select__wrap">
      <select
          :id="selectId"
          :value="String(modelValue)"
          :disabled="disabled"
          :required="required"
          :aria-invalid="!!error"
          :aria-describedby="error ? `${selectId}-error` : undefined"
          class="ui-select__field"
          :class="[
            { 'ui-select__field--error': !!error },
            `ui-select__field--tone-${tone}`
          ]"
          @change="handleChange"
      >
        <option v-if="placeholder" value="" disabled hidden>{{ placeholder }}</option>
        <option
            v-for="option in options"
            :key="String(option.value)"
            :value="String(option.value)"
        >
          {{ option.label }}
        </option>
      </select>
      <span class="ui-select__chevron" aria-hidden="true">
        <Icon name="heroicons:chevron-down" size="14"/>
      </span>
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

  &--sm
    margin-bottom: 0

    .ui-select__label
      margin-bottom: 4px
      font-size: 10px

    .ui-select__field
      height: 32px
      padding: 0 28px 0 var(--spacing-3)
      font-size: var(--font-size-xs)

    .ui-select__chevron
      right: 8px

  &--disabled
    opacity: 0.6

  &--flush
    margin-bottom: 0

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
    display: flex
    align-items: center

  &__field
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
    appearance: none
    -webkit-appearance: none
    -moz-appearance: none
    transition: border-color var(--transition-normal) ease, box-shadow var(--transition-normal) ease

    &:focus-visible
      outline: none
      border-color: var(--color-input-border-focus)
      box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.12)

    &:hover:not(:disabled):not(:focus-visible)
      border-color: var(--color-input-border-hover)

    &:disabled
      background-color: var(--color-input-disabled-bg)
      color: var(--color-input-disabled-text)
      cursor: not-allowed

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

  &__wrap:focus-within .ui-select__chevron
    color: var(--color-primary)
    transform: translateY(-50%) rotate(180deg)

  &__error
    margin-top: 5px
    color: var(--color-danger)
    font-size: var(--font-size-xs)
    font-weight: 500

@media (max-width: 768px)
  .ui-select:not(.ui-select--sm)
    margin-bottom: var(--spacing-3)
</style>
