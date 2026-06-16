<script setup lang="ts">
type InputType =
    | 'text' | 'email' | 'password' | 'number'
    | 'url' | 'tel' | 'search' | 'date' | 'datetime-local' | 'file'

interface Props {
  modelValue?: string | number | FileList
  label?: string
  placeholder?: string
  type?: InputType
  disabled?: boolean
  readonly?: boolean
  error?: string
  success?: boolean
  required?: boolean
  autocomplete?: string
  name?: string
  id?: string
  showPasswordToggle?: boolean
  hint?: string
  flush?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  type: 'text',
  disabled: false,
  readonly: false,
  success: false,
  required: false,
  autocomplete: 'off',
  showPasswordToggle: false,
  flush: false,
})

defineOptions({ inheritAttrs: false })

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number | FileList): void
}>()

const inputValue = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const generatedId = ref<string>('')

onMounted(() => {
  if (!props.id) {
    generatedId.value = `input-${crypto.randomUUID()}`
  }
})

const inputId = computed(() => props.id || generatedId.value)

const describedBy = computed(() => {
  const ids: string[] = []
  if (props.error) ids.push(`${inputId.value}-error`)
  if (props.hint && !props.error) ids.push(`${inputId.value}-hint`)
  return ids.length ? ids.join(' ') : undefined
})

const inputClasses = computed(() => ({
  'ui-input__field--error': !!props.error,
  'ui-input__field--success': props.success,
  'ui-input__field--disabled': props.disabled,
  'ui-input__field--with-toggle': props.showPasswordToggle && props.type === 'password',
}))

const isPasswordVisible = ref(false)

const resolvedType = computed(() => {
  if (props.type === 'password' && props.showPasswordToggle && isPasswordVisible.value) {
    return 'text'
  }
  return props.type
})

const togglePasswordVisibility = () => {
  isPasswordVisible.value = !isPasswordVisible.value
}

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files) {
    emit('update:modelValue', target.files)
  }
}
</script>

<template>
  <div class="ui-input" :class="{ 'ui-input--flush': flush }">
    <label
        v-if="label"
        :for="inputId"
        class="ui-input__label"
        :class="{ 'ui-input__label--required': required }"
    >
      {{ label }}
    </label>

    <div class="ui-input__control">
      <input
          :id="inputId"
          v-model="inputValue"
          v-bind="$attrs"
          :type="resolvedType"
          :placeholder="placeholder"
          :disabled="disabled"
          :readonly="readonly"
          :autocomplete="autocomplete"
          :name="name"
          :required="required"
          :aria-invalid="!!error"
          :aria-required="required"
          :aria-describedby="describedBy"
          class="ui-input__field"
          :class="inputClasses"
          @change="type === 'file' ? handleFileChange($event) : undefined"
      />
      <button
          v-if="showPasswordToggle && type === 'password'"
          type="button"
          class="ui-input__toggle"
          :aria-label="isPasswordVisible ? 'Скрыть пароль' : 'Показать пароль'"
          :aria-pressed="isPasswordVisible"
          tabindex="-1"
          @click="togglePasswordVisibility"
      >
        <Icon :name="isPasswordVisible ? 'heroicons:eye-slash' : 'heroicons:eye'" size="16"/>
      </button>
    </div>

    <p v-if="hint && !error" :id="`${inputId}-hint`" class="ui-input__hint">{{ hint }}</p>

    <p v-if="error" :id="`${inputId}-error`" class="ui-input__error">
      {{ error }}
    </p>
  </div>
</template>

<style scoped lang="sass">
.ui-input
  display: flex
  flex-direction: column
  width: 100%
  font-family: 'Manrope', sans-serif
  margin-bottom: var(--spacing-4)

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

  &__control
    position: relative
    display: flex
    align-items: center

  &__field
    width: 100%
    padding: 9px var(--spacing-4)
    border: var(--border-width) solid var(--color-input-border)
    border-radius: var(--radius-md)
    background-color: var(--color-input-bg)
    color: var(--color-input-text)
    font-size: var(--font-size-sm)
    line-height: 1.5
    height: 38px
    transition: border-color var(--transition-normal) ease, box-shadow var(--transition-normal) ease

    &::placeholder
      color: var(--color-input-placeholder)

    &:focus-visible
      outline: none
      border-color: var(--color-input-border-focus)
      box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.12)

    &:hover:not(:disabled):not(:focus)
      border-color: var(--color-input-border-hover)

    &--error
      border-color: var(--color-danger)

      &:focus-visible
        box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1)

    &--success
      border-color: var(--color-success)

      &:focus-visible
        box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1)

    &--disabled
      background-color: var(--color-input-disabled-bg)
      color: var(--color-input-disabled-text)
      cursor: not-allowed

      &::placeholder
        color: var(--color-input-disabled-text)

    &--with-toggle
      padding-right: 40px

  &__toggle
    position: absolute
    right: 10px
    top: 50%
    transform: translateY(-50%)
    display: flex
    align-items: center
    justify-content: center
    width: 28px
    height: 28px
    border: none
    border-radius: var(--radius-sm)
    background: none
    color: var(--color-text-muted)
    cursor: pointer
    transition: color var(--transition-normal) ease, background-color var(--transition-normal) ease

    &:hover
      color: var(--color-text)
      background-color: var(--color-bg-secondary)

    &:focus-visible
      outline: 2px solid var(--color-primary)
      outline-offset: 1px

  &__hint
    margin-top: 5px
    color: var(--color-text-muted)
    font-size: var(--font-size-xs)
    font-weight: 500
    line-height: 1.4

  &__error
    margin-top: 5px
    color: var(--color-danger)
    font-size: var(--font-size-xs)
    font-weight: 500

@media (max-width: 768px)
  .ui-input
    margin-bottom: var(--spacing-3)
</style>
