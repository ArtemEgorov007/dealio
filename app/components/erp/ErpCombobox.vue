<script setup lang="ts">
import {rankByQuery, resolveSingleMatch} from '~/utils/text-search'

/**
 * Поле с выбором из справочника.
 *
 * Собрано из разбора четырёх багов на телефоне — поэтому здесь не самая
 * очевидная реализация, и каждое отличие от «просто input + список» объяснено
 * ниже по месту. Один компонент на все справочники ERP: копии такого поля
 * разъезжаются, а вместе с ними возвращаются уже починенные баги.
 */
export interface ErpComboboxOption {
    /** Значение, попадающее в поле. */
    value: string
    /** Правая подпись в строке списка: категория, статус, отдел. */
    hint?: string
}

const props = withDefaults(defineProps<{
    modelValue: string
    options: ErpComboboxOption[]
    placeholder?: string
    /** Текст под полем, когда значение не из справочника. */
    unresolvedHint?: string
    /** Разрешить значение, которого нет в справочнике (например, новый договор). */
    allowFreeText?: boolean
    disabled?: boolean
}>(), {
    placeholder: '',
    unresolvedHint: 'Выберите значение из списка',
    allowFreeText: false,
    disabled: false,
})

const emit = defineEmits<{
    'update:modelValue': [value: string]
    /** Выбрана позиция справочника — родителю может понадобиться её hint. */
    picked: [option: ErpComboboxOption]
}>()

const isOpen = ref(false)
// Список открыт кнопкой, а не набором: тогда фильтр не применяем, иначе у
// заполненного поля список показывал ровно одно уже выбранное значение и
// сменить его можно было только очистив поле.
const isBrowsingAll = ref(false)
const rootEl = ref<HTMLElement | null>(null)
const fieldEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)

const isFromOptions = (value: string): boolean =>
    props.options.some(option => option.value === value.trim())

const suggestions = computed<ErpComboboxOption[]>(() =>
    isBrowsingAll.value
        ? rankByQuery(props.options, '', option => option.value)
        : rankByQuery(props.options, props.modelValue, option => option.value),
)

const isUnresolved = computed(() =>
    !props.allowFreeText && props.modelValue.trim() !== '' && !isFromOptions(props.modelValue),
)

/**
 * Высота списка.
 *
 * Экранная клавиатура не уменьшает обычный viewport, поэтому список,
 * отрисованный под полем, оказывался за ней: подсказки было видно только
 * после того, как её убирали. Меряем реально видимую часть экрана.
 */
const maxHeight = ref(260)

const measure = () => {
    const field = fieldEl.value
    const viewport = window.visualViewport
    if (!field || !viewport) return
    const available = viewport.offsetTop + viewport.height - field.getBoundingClientRect().bottom - 12
    maxHeight.value = Math.max(140, Math.min(320, Math.round(available)))
}

const open = async (browseAll = false) => {
    if (props.disabled) return
    isBrowsingAll.value = browseAll
    isOpen.value = true
    await nextTick()
    fieldEl.value?.scrollIntoView({block: 'nearest', behavior: 'smooth'})
    measure()
}

const toggle = () => {
    if (isOpen.value && isBrowsingAll.value) {
        isOpen.value = false
        return
    }
    void open(true)
}

/**
 * Ввод читаем напрямую, без v-model.
 *
 * Клавиатура iOS с автоподсказками держит ввод в состоянии композиции, пока
 * пользователь не уберёт её или не тапнет мимо, а v-model по замыслу
 * игнорирует input во время композиции: список не фильтровался при открытой
 * клавиатуре, а при завершении композиции перерисовывался ровно в момент тапа.
 */
const onInput = (event: Event) => {
    if (event.target instanceof HTMLInputElement) {
        emit('update:modelValue', event.target.value)
    }
    isBrowsingAll.value = false
}

const onFocus = (event: FocusEvent) => {
    // В заполненном поле лежит полное значение. Тап ставил курсор в середину,
    // и набор дописывался внутрь названия — совпадений не находилось.
    const filled = isFromOptions(props.modelValue)
    if (filled && event.target instanceof HTMLInputElement) {
        event.target.select()
    }
    void open(filled)
}

/**
 * Уход из поля: подставляем единственное подходящее значение.
 *
 * Между двумя похожими не угадываем — «Круг отрезной 125» и «Круг отрезной
 * 230» разные вещи, лучше попросить выбрать.
 */
const onBlur = () => {
    if (props.allowFreeText) return
    const value = props.modelValue.trim()
    if (value === '' || isFromOptions(value)) return
    const match = resolveSingleMatch(props.options, value, option => option.value)
    if (match) emit('update:modelValue', match.value)
}

const pick = (option: ErpComboboxOption) => {
    emit('update:modelValue', option.value)
    emit('picked', option)
    isOpen.value = false
}

/**
 * Тап по позиции против прокрутки списка.
 *
 * preventDefault на pointerdown отменяет жест прокрутки, а click приходит уже
 * после blur, когда списка нет. Поэтому решаем по самому касанию: палец не
 * сдвинулся — выбор, сдвинулся — прокрутка, и мы не вмешиваемся.
 */
const TAP_TOLERANCE_PX = 10
let touchStartY = 0

const onItemTouchStart = (event: TouchEvent) => {
    touchStartY = event.touches[0]?.clientY ?? 0
}

const onItemTouchEnd = (event: TouchEvent, option: ErpComboboxOption) => {
    if (Math.abs((event.changedTouches[0]?.clientY ?? 0) - touchStartY) > TAP_TOLERANCE_PX) return
    // Гасим синтетический click, иначе позиция выберется дважды.
    event.preventDefault()
    pick(option)
}

/**
 * Закрытие по касанию вне поля.
 *
 * Одного blur мало: список открывается кнопкой без фокуса в поле. Проверяем по
 * всей области компонента — список отрисован соседом поля, и проверка по полю
 * считала бы тап по позиции касанием снаружи.
 */
const onDocumentPointerDown = (event: PointerEvent) => {
    if (!isOpen.value) return
    const root = rootEl.value
    if (root && event.target instanceof Node && root.contains(event.target)) return
    isOpen.value = false
}

onMounted(() => {
    document.addEventListener('pointerdown', onDocumentPointerDown, true)
    window.visualViewport?.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('scroll', measure)
})

onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', onDocumentPointerDown, true)
    window.visualViewport?.removeEventListener('resize', measure)
    window.visualViewport?.removeEventListener('scroll', measure)
})

defineExpose({focus: () => inputEl.value?.focus()})
</script>

<template>
  <div ref="rootEl" class="erp-combobox">
    <div ref="fieldEl" class="erp-combobox__field">
      <input
          ref="inputEl"
          :value="modelValue"
          type="text"
          class="erp-combobox__input"
          :placeholder="placeholder"
          :disabled="disabled"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          enterkeyhint="done"
          @focus="onFocus"
          @input="onInput"
          @blur="onBlur"
          @keydown.enter.prevent="isOpen = false"
      >
      <button
          type="button"
          class="erp-combobox__toggle"
          :disabled="disabled"
          :aria-label="isOpen ? 'Скрыть список' : 'Показать весь список'"
          @pointerdown.prevent="toggle"
      >
        <Icon name="heroicons:chevron-down" size="16" :class="{'erp-combobox__chevron--open': isOpen}"/>
      </button>
    </div>

    <span v-if="isUnresolved && !isOpen" class="erp-combobox__hint">{{ unresolvedHint }}</span>

    <div v-if="isOpen && suggestions.length > 0" class="erp-combobox__list" :style="{maxHeight: maxHeight + 'px'}">
      <button
          v-for="option in suggestions"
          :key="option.value"
          type="button"
          class="erp-combobox__option"
          @touchstart.passive="onItemTouchStart"
          @touchend="onItemTouchEnd($event, option)"
          @click="pick(option)"
      >
        <span class="erp-combobox__value">{{ option.value }}</span>
        <span v-if="option.hint" class="erp-combobox__option-hint">{{ option.hint }}</span>
      </button>
    </div>
    <p v-else-if="isOpen && modelValue.trim()" class="erp-combobox__list erp-combobox__empty">
      Ничего не нашлось. Очистите поле, чтобы увидеть весь список.
    </p>
  </div>
</template>

<style scoped lang="sass">
.erp-combobox
  position: relative
  min-width: 0

.erp-combobox__field
  position: relative

.erp-combobox__input
  width: 100%
  padding: 11px 36px 11px 12px
  border: none
  border-radius: 12px
  background: var(--color-card-bg)
  box-shadow: var(--erp-shadow-card, 0 1px 0 rgba(0, 0, 0, 0.04))
  color: var(--color-text)
  // Размер шрифта здесь не задаём: erp-theme.css держит поля на 16px против
  // зума iOS, и своё значение всё равно не применится.

  &::placeholder
    color: var(--color-text-secondary)
    font-size: 13px

  &:focus
    outline: 2px solid var(--color-primary)
    outline-offset: -1px

  &:disabled
    opacity: 0.6

.erp-combobox__toggle
  position: absolute
  top: 0
  right: 0
  display: flex
  align-items: center
  justify-content: center
  width: 34px
  height: 100%
  border: none
  background: none
  color: var(--color-text-secondary)
  cursor: pointer

  svg
    transition: transform 0.15s ease

.erp-combobox__chevron--open
  transform: rotate(180deg)

.erp-combobox__hint
  display: block
  margin: 3px 0 0 12px
  font-size: 11px
  color: var(--erp-warn, #E7920B)

.erp-combobox__list
  position: absolute
  top: calc(100% + 4px)
  left: 0
  right: 0
  z-index: 20
  overflow-y: auto
  overscroll-behavior: contain
  -webkit-overflow-scrolling: touch
  background: var(--color-card-bg)
  border-radius: 12px
  box-shadow: 0 8px 24px -8px rgba(1, 110, 215, 0.35)

.erp-combobox__empty
  margin: 0
  padding: 10px 12px
  font-size: 12.5px
  color: var(--color-text-secondary)

.erp-combobox__option
  display: flex
  flex-direction: column
  gap: 1px
  width: 100%
  padding: 9px 12px
  border: none
  background: none
  text-align: left
  cursor: pointer
  border-bottom: 0.5px solid rgba(60, 60, 67, 0.12)

  &:last-child
    border-bottom: none

  &:hover
    background: var(--color-primary-light)

.erp-combobox__value
  font-size: 14px
  color: var(--color-text)

.erp-combobox__option-hint
  font-size: 11px
  color: var(--color-text-secondary)
</style>
