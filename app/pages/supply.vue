<script setup lang="ts">
import {createSupplyRequest, fetchSupplyCatalog} from '~/utils/erp-supply'
import type {ErpSupplyCatalogItem} from '~/utils/erp-supply'
import {rankByQuery, resolveSingleMatch} from '~/utils/text-search'
import {useAppToast} from '~/composables/useAppToast'

definePageMeta({layout: 'erp'})
useSeoMeta({title: 'Снабжение | ERP'})

const {showSuccess, showError} = useAppToast()
const router = useRouter()

const catalog = ref<ErpSupplyCatalogItem[]>([])
const isLoading = ref(true)
const loadError = ref('')

interface FormRow {
    id: number
    name: string
    // v-model на <input type="number"> отдаёт число, а на пустом поле —
    // пустую строку, поэтому тип честно допускает оба варианта.
    quantity: string | number
}

/** Количество из поля ввода. Запятая — потому что её ставит русская раскладка. */
const parseQuantity = (value: string | number): number =>
    typeof value === 'number' ? value : Number(String(value).replace(',', '.'))

let nextRowId = 1
const rows = ref<FormRow[]>([{id: nextRowId++, name: '', quantity: ''}])

// Подсказка открыта максимум у одной строки: иначе на телефоне списки
// наезжают друг на друга и непонятно, к какой позиции они относятся.
const activeSuggestRow = ref<number | null>(null)
const isSubmitting = ref(false)

// Ссылки на обёртку поля и на поле количества — по id строки. Нужны, чтобы
// померить место под список и перевести фокус после выбора позиции.
// fieldEls — только само поле: по его нижней границе считается место под
// список. rowEls — вся область строки вместе со списком: список отрисован
// соседом поля, а не внутри него, поэтому проверять «касание вне» по полю
// нельзя — тап по позиции считался бы касанием снаружи и закрывал список
// раньше, чем выбор успевал сработать.
const fieldEls = new Map<number, HTMLElement>()
const rowEls = new Map<number, HTMLElement>()
const quantityEls = new Map<number, HTMLInputElement>()

const setFieldEl = (id: number, el: unknown) => {
    if (el instanceof HTMLElement) fieldEls.set(id, el)
    else fieldEls.delete(id)
}

const setRowEl = (id: number, el: unknown) => {
    if (el instanceof HTMLElement) rowEls.set(id, el)
    else rowEls.delete(id)
}

const setQuantityEl = (id: number, el: unknown) => {
    if (el instanceof HTMLInputElement) quantityEls.set(id, el)
    else quantityEls.delete(id)
}

/**
 * Высота списка подсказок.
 *
 * Экранная клавиатура не уменьшает обычный viewport, поэтому список,
 * отрисованный под полем, оказывался за клавиатурой: сотрудник видел
 * подсказки только после того, как её убирал. Меряем реально видимую часть
 * экрана (visualViewport) и отдаём списку ровно её.
 */
const suggestMaxHeight = ref(260)

const measureSuggestSpace = () => {
    const id = activeSuggestRow.value
    if (id === null) return
    const field = fieldEls.get(id)
    const viewport = window.visualViewport
    if (!field || !viewport) return

    const rect = field.getBoundingClientRect()
    const visibleBottom = viewport.offsetTop + viewport.height
    const available = visibleBottom - rect.bottom - 12

    // Ниже 140px список превращается в щель; тогда он всё равно
    // прокручивается, зато остаётся читаемым.
    suggestMaxHeight.value = Math.max(140, Math.min(320, Math.round(available)))
}

const load = async () => {
    isLoading.value = true
    loadError.value = ''
    try {
        catalog.value = await fetchSupplyCatalog()
    } catch (error) {
        loadError.value = errorMessage(error, 'Не удалось загрузить номенклатуру')
    } finally {
        isLoading.value = false
    }
}

// Список открыт кнопкой «показать всю номенклатуру», а не набором текста.
// Тогда фильтр не применяем: иначе у строки с уже выбранной позицией список
// показывал ровно её одну, и сменить позицию можно было только очистив поле.
const isBrowsingAll = ref(false)

/**
 * Что показать в списке под строкой.
 *
 * Пустой ввод даёт всю номенклатуру: сотрудник не обязан угадывать
 * формулировку, чтобы вообще увидеть, что бывает на складе. Список
 * прокручивается, поэтому обрезать его не нужно.
 */
const suggestionsFor = (row: FormRow): ErpSupplyCatalogItem[] =>
    isBrowsingAll.value
        ? rankByQuery(catalog.value, '', item => item.name)
        : rankByQuery(catalog.value, row.name, item => item.name)

const isFromCatalog = (name: string): boolean =>
    catalog.value.some(item => item.name === name.trim())

const categoryFor = (name: string): string =>
    catalog.value.find(item => item.name === name.trim())?.category ?? ''

/**
 * Подставляет позицию номенклатуры по тому, что набрал сотрудник.
 *
 * Заявка принимается только с позицией из справочника, поэтому набранное
 * «каска» нужно превратить в «Каска защитная» самим, а не отбивать ошибкой.
 * Если подходящих несколько — оставляем как есть и показываем список:
 * «Круг отрезной 125» и «Круг отрезной 230» — разные вещи.
 */
const resolveRow = (row: FormRow) => {
    if (!row.name.trim() || isFromCatalog(row.name)) return
    const match = resolveSingleMatch(catalog.value, row.name, item => item.name)
    if (match) row.name = match.name
}

const closeSuggestions = (row: FormRow) => {
    resolveRow(row)
    if (activeSuggestRow.value === row.id) activeSuggestRow.value = null
}

const openSuggestions = async (row: FormRow, browseAll = false) => {
    isBrowsingAll.value = browseAll
    activeSuggestRow.value = row.id
    await nextTick()
    // Поле подтягиваем вверх видимой области, иначе список открывается там,
    // где его закрывает клавиатура.
    fieldEls.get(row.id)?.scrollIntoView({block: 'nearest', behavior: 'smooth'})
    measureSuggestSpace()
}

const toggleSuggestions = (row: FormRow) => {
    if (activeSuggestRow.value === row.id && isBrowsingAll.value) {
        activeSuggestRow.value = null
        return
    }
    void openSuggestions(row, true)
}

/**
 * Закрытие по касанию вне поля.
 *
 * Одного @blur мало: список можно открыть кнопкой, не ставя фокус в поле
 * (тогда клавиатура не лезет поверх списка), и blur в этом случае не придёт.
 */
const onDocumentPointerDown = (event: PointerEvent) => {
    const id = activeSuggestRow.value
    if (id === null) return
    const area = rowEls.get(id)
    if (area && event.target instanceof Node && area.contains(event.target)) return
    activeSuggestRow.value = null
}

onMounted(() => {
    document.addEventListener('pointerdown', onDocumentPointerDown, true)
    window.visualViewport?.addEventListener('resize', measureSuggestSpace)
    window.visualViewport?.addEventListener('scroll', measureSuggestSpace)
})

onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', onDocumentPointerDown, true)
    window.visualViewport?.removeEventListener('resize', measureSuggestSpace)
    window.visualViewport?.removeEventListener('scroll', measureSuggestSpace)
})

/** Строки, где набрано что-то не из номенклатуры: заявку с ними не примут. */
const unresolvedRows = computed(() =>
    rows.value.filter(row => row.name.trim() && !isFromCatalog(row.name)),
)

const addRow = () => {
    rows.value.push({id: nextRowId++, name: '', quantity: ''})
}

const removeRow = (id: number) => {
    // Последнюю строку не убираем: форма осталась бы без единого поля ввода.
    if (rows.value.length <= 1) return
    rows.value = rows.value.filter(row => row.id !== id)
}

/**
 * Тап по позиции против прокрутки списка.
 *
 * Раньше выбор висел на @pointerdown.prevent. preventDefault на pointerdown
 * отменяет жест прокрутки — список нельзя было пролистать пальцем. Убрать
 * .prevent и вернуться к click тоже нельзя: click приходит после blur.
 *
 * Поэтому решаем по самому касанию: палец не сдвинулся — это выбор, сдвинулся —
 * это прокрутка, и мы не вмешиваемся. touchend приходит на тот же элемент, где
 * началось касание, поэтому сдвиг вёрстки от закрывшейся клавиатуры не мешает.
 */
const TAP_TOLERANCE_PX = 10
let touchStartY = 0

const onItemTouchStart = (event: TouchEvent) => {
    touchStartY = event.touches[0]?.clientY ?? 0
}

const onItemTouchEnd = (event: TouchEvent, row: FormRow, item: ErpSupplyCatalogItem) => {
    const endY = event.changedTouches[0]?.clientY ?? 0
    if (Math.abs(endY - touchStartY) > TAP_TOLERANCE_PX) return

    // Гасим синтетический click, иначе позиция выберется дважды.
    event.preventDefault()
    pickSuggestion(row, item)
}

/**
 * Ввод в поле номенклатуры.
 *
 * Здесь намеренно не v-model. Клавиатура iOS с автоподсказками держит ввод в
 * состоянии композиции, пока пользователь не уберёт её или не тапнет мимо, а
 * v-model по замыслу игнорирует input во время композиции. Из-за этого список
 * не фильтровался, пока клавиатура открыта, — а при завершении композиции
 * список перерисовывался ровно в момент тапа, и позиция не подставлялась.
 *
 * Читаем значение поля напрямую: для строки поиска композиция ничего не
 * добавляет, а живая фильтрация здесь и есть смысл экрана.
 */
const onNameInput = (row: FormRow, event: Event) => {
    if (event.target instanceof HTMLInputElement) {
        row.name = event.target.value
    }
    isBrowsingAll.value = false
}

/**
 * Фокус в поле номенклатуры.
 *
 * Если позиция уже выбрана, поле содержит полное название. Тап ставил курсор
 * в середину текста, и набор давал «Перчатки х/бкруг» — совпадений ноль, а
 * выглядело как «подсказки не работают». Выделяем текст, чтобы первый символ
 * заменил его, и сразу показываем весь справочник: пользователь всё равно
 * собирается менять позицию.
 */
const onNameFocus = (row: FormRow, event: FocusEvent) => {
    const filled = isFromCatalog(row.name)
    if (filled && event.target instanceof HTMLInputElement) {
        event.target.select()
    }
    void openSuggestions(row, filled)
}

const pickSuggestion = (row: FormRow, item: ErpSupplyCatalogItem) => {
    row.name = item.name
    activeSuggestRow.value = null
    // Следующий шаг всегда один — количество. Переводим фокус сами, чтобы
    // клавиатура не закрывалась и не приходилось целиться в узкое поле.
    nextTick(() => quantityEls.get(row.id)?.focus())
}

const filledRows = computed(() =>
    rows.value.filter(row => row.name.trim() && parseQuantity(row.quantity) > 0),
)

// Кнопку не блокируем из-за неразобранной строки: сотрудник должен видеть
// подсказку под конкретной строкой, а не гадать, почему «Заказать» не жмётся.
const canSubmit = computed(() =>
    filledRows.value.length > 0 && unresolvedRows.value.length === 0 && !isSubmitting.value,
)

const submit = async () => {
    if (!canSubmit.value) return
    isSubmitting.value = true
    try {
        const result = await createSupplyRequest(
            filledRows.value.map(row => ({
                name: row.name.trim(),
                quantity: parseQuantity(row.quantity),
            })),
        )
        showSuccess(`Заявка ${result.requestCode} создана`, `Позиций: ${result.positions}`)
        rows.value = [{id: nextRowId++, name: '', quantity: ''}]
    } catch (error) {
        showError(error, 'Не удалось создать заявку')
    } finally {
        isSubmitting.value = false
    }
}

onMounted(load)
</script>

<template>
  <ErpScreen
      title="Снабжение"
      subtitle="Заявка на материалы"
      icon="heroicons:truck"
      :shift-link="{label: 'Ваши заявки', icon: 'heroicons:clipboard-document-list', onClick: () => router.push('/supply-requests')}"
  >
    <ErpEmptyState v-if="isLoading" loading>
      <span>Загрузка номенклатуры…</span>
    </ErpEmptyState>

    <ErpEmptyState v-else-if="loadError" error>
      <p>{{ loadError }}</p>
      <UiButton variant="outline" @click="load">Повторить</UiButton>
    </ErpEmptyState>

    <template v-else>
      <ErpSectionLabel>Позиции заявки</ErpSectionLabel>

      <div class="supply-rows">
        <div v-for="row in rows" :key="row.id" class="supply-row">
          <div class="supply-row__fields">
            <div :ref="el => setRowEl(row.id, el)" class="supply-row__name">
              <div :ref="el => setFieldEl(row.id, el)" class="supply-field">
                <input
                    :value="row.name"
                    type="text"
                    class="supply-input"
                    placeholder="Номенклатура"
                    autocomplete="off"
                    autocapitalize="off"
                    autocorrect="off"
                    spellcheck="false"
                    enterkeyhint="done"
                    @focus="onNameFocus(row, $event)"
                    @input="onNameInput(row, $event)"
                    @blur="resolveRow(row)"
                    @keydown.enter.prevent="closeSuggestions(row)"
                >
                <button
                    type="button"
                    class="supply-field__toggle"
                    :aria-label="activeSuggestRow === row.id ? 'Скрыть номенклатуру' : 'Показать всю номенклатуру'"
                    @pointerdown.prevent="toggleSuggestions(row)"
                >
                  <Icon
                      name="heroicons:chevron-down"
                      size="16"
                      :class="{'supply-field__toggle-icon--open': activeSuggestRow === row.id}"
                  />
                </button>
              </div>

              <span v-if="categoryFor(row.name)" class="supply-row__category">
                {{ categoryFor(row.name) }}
              </span>
              <span
                  v-else-if="row.name.trim() && activeSuggestRow !== row.id"
                  class="supply-row__hint"
              >
                Выберите позицию из номенклатуры
              </span>

              <div
                  v-if="activeSuggestRow === row.id && suggestionsFor(row).length > 0"
                  class="supply-suggest"
                  :style="{maxHeight: suggestMaxHeight + 'px'}"
              >
                <button
                    v-for="item in suggestionsFor(row)"
                    :key="item.name"
                    type="button"
                    class="supply-suggest__item"
                    @touchstart.passive="onItemTouchStart"
                    @touchend="onItemTouchEnd($event, row, item)"
                    @click="pickSuggestion(row, item)"
                >
                  <span class="supply-suggest__name">{{ item.name }}</span>
                  <span class="supply-suggest__category">{{ item.category }}</span>
                </button>
              </div>
              <p
                  v-else-if="activeSuggestRow === row.id && row.name.trim()"
                  class="supply-suggest supply-suggest--empty"
              >
                Ничего не нашлось. Очистите поле, чтобы увидеть всю номенклатуру.
              </p>
            </div>

            <input
                :ref="el => setQuantityEl(row.id, el)"
                v-model="row.quantity"
                type="number"
                inputmode="decimal"
                min="0"
                step="any"
                class="supply-input supply-input--qty"
                placeholder="Кол-во"
                @focus="activeSuggestRow = null"
            >
          </div>

          <button
              v-if="rows.length > 1"
              type="button"
              class="supply-row__remove"
              aria-label="Убрать позицию"
              @click="removeRow(row.id)"
          >
            <Icon name="heroicons:x-mark" size="15"/>
          </button>
        </div>
      </div>

      <button type="button" class="supply-add" aria-label="Добавить позицию" @click="addRow">
        <Icon name="heroicons:plus" size="18"/>
      </button>
    </template>

    <template #footer>
      <UiButton block :disabled="!canSubmit" :loading="isSubmitting" @click="submit">
        Заказать
      </UiButton>
    </template>
  </ErpScreen>
</template>

<style scoped lang="sass">
.supply-rows
  display: flex
  flex-direction: column
  gap: 8px

.supply-row
  display: flex
  align-items: flex-start
  gap: 6px

.supply-row__fields
  flex: 1
  display: grid
  // Номенклатура занимает основную ширину, количество — узкая колонка справа,
  // как в бумажной заявке.
  grid-template-columns: 1fr 92px
  gap: 6px
  min-width: 0
  // Колонки выравниваем по верху. По умолчанию сетка растягивает ячейки на
  // всю высоту строки, и после выбора позиции — когда под номенклатурой
  // появляется подпись категории — поле количества вытягивалось с 46 до 65px.
  align-items: start

.supply-row__name
  position: relative
  min-width: 0

.supply-input
  width: 100%
  padding: 11px 12px
  border: none
  border-radius: 12px
  background: var(--color-card-bg)
  box-shadow: var(--erp-shadow-card, 0 1px 0 rgba(0, 0, 0, 0.04))
  color: var(--color-text)
  // Размер шрифта здесь намеренно не задан: erp-theme.css держит все поля
  // ввода на 16px через !important, иначе iOS Safari зумирует страницу при
  // фокусе. Строчка «font-size: 15px» тут стояла и не работала.

  &::placeholder
    color: var(--color-text-secondary)
    // На плейсхолдер запрет не распространяется — зум зависит от размера
    // самого поля. Уменьшаем до размера заголовка «Позиции заявки».
    font-size: 13px

  &:focus
    outline: 2px solid var(--color-primary)
    outline-offset: -1px

.supply-field .supply-input
  // Место под кнопку раскрытия списка, иначе длинное название заезжает под неё.
  padding-right: 36px

.supply-input--qty
  text-align: right
  font-variant-numeric: tabular-nums

.supply-field
  position: relative

.supply-field__toggle
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

.supply-field__toggle-icon--open
  transform: rotate(180deg)

.supply-row__category
  display: block
  margin: 3px 0 0 12px
  font-size: 11px
  color: var(--color-text-secondary)

.supply-row__hint
  display: block
  margin: 3px 0 0 12px
  font-size: 11px
  color: var(--erp-warn, #E7920B)

.supply-row__remove
  flex-shrink: 0
  width: 32px
  height: 40px
  border: none
  background: none
  color: var(--color-text-secondary)
  cursor: pointer

.supply-suggest
  position: absolute
  top: calc(100% + 4px)
  left: 0
  right: 0
  z-index: 20
  // Высоту задаёт скрипт по реально видимой части экрана (см.
  // measureSuggestSpace): под клавиатурой места меньше, чем в вёрстке.
  overflow-y: auto
  overscroll-behavior: contain
  -webkit-overflow-scrolling: touch
  background: var(--color-card-bg)
  border-radius: 12px
  box-shadow: 0 8px 24px -8px rgba(1, 110, 215, 0.35)

.supply-suggest--empty
  margin: 0
  padding: 10px 12px
  font-size: 12.5px
  color: var(--color-text-secondary)

.supply-suggest__item
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

.supply-suggest__name
  font-size: 14px
  color: var(--color-text)

.supply-suggest__category
  font-size: 11px
  color: var(--color-text-secondary)

.supply-add
  align-self: center
  display: flex
  align-items: center
  justify-content: center
  width: 40px
  height: 40px
  margin-top: 10px
  border: none
  border-radius: 50%
  background: var(--color-primary-light)
  color: var(--color-primary)
  cursor: pointer
</style>
