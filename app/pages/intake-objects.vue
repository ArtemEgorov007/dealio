<script setup lang="ts">
import {completeIntakeMatched, fetchIntakeObjects} from '~/utils/erp-intake'
import type {ErpIntakeObjectOption} from '~/utils/erp-intake'
import {useAppToast} from '~/composables/useAppToast'
import type {ErpComboboxOption} from '~/components/erp/ErpCombobox.vue'

definePageMeta({layout: 'erp'})
useSeoMeta({title: 'Приход: объекты | ERP'})

const route = useRoute()
const router = useRouter()
const {showSuccess, showError} = useAppToast()

const deliveryId = computed(() => Number(route.query.id))
const title = computed(() => String(route.query.title ?? ''))

const catalog = ref<ErpIntakeObjectOption[]>([])
const isLoading = ref(true)
const loadError = ref('')

const load = async () => {
    if (!deliveryId.value || !title.value) {
        await router.replace('/intake')
        return
    }
    isLoading.value = true
    loadError.value = ''
    try {
        catalog.value = await fetchIntakeObjects(title.value)
    } catch (error) {
        loadError.value = errorMessage(error, 'Не удалось загрузить объекты')
    } finally {
        isLoading.value = false
    }
}
onMounted(load)

interface FormRow {
    id: number
    workObject: string
}

let nextRowId = 1
const rows = ref<FormRow[]>([{id: nextRowId++, workObject: ''}])
const isSubmitting = ref(false)

const options = computed<ErpComboboxOption[]>(() =>
    catalog.value.map(item => ({value: item.workObject, hint: item.contractInternalNumber})),
)

const isFromCatalog = (workObject: string): boolean =>
    catalog.value.some(item => item.workObject === workObject.trim())

const addRow = () => {
    rows.value.push({id: nextRowId++, workObject: ''})
}

const removeRow = (id: number) => {
    if (rows.value.length <= 1) return
    rows.value = rows.value.filter(row => row.id !== id)
}

const filledRows = computed(() => rows.value.filter(row => row.workObject.trim()))

const unresolvedRows = computed(() =>
    rows.value.filter(row => row.workObject.trim() && !isFromCatalog(row.workObject)),
)

const canSubmit = computed(() =>
    filledRows.value.length > 0 && unresolvedRows.value.length === 0 && !isSubmitting.value,
)

const submit = async () => {
    if (!canSubmit.value) return
    const ids = filledRows.value
        .map(row => catalog.value.find(item => item.workObject === row.workObject.trim())?.id)
        .filter((id): id is number => id !== undefined)

    isSubmitting.value = true
    try {
        const result = await completeIntakeMatched(deliveryId.value, ids)
        if (result.skippedIds.length > 0) {
            // Поставка закрывается при первой же принятой марке — оставшиеся
            // не вошедшие сюда марки этой же накладной уже не принять, нужна
            // новая поставка (новое фото). Задерживаемся на экране, чтобы
            // пользователь успел прочитать, какие именно не вошли, а не
            // только увидел мигнувший тост.
            const names = result.skippedIds
                .map(id => catalog.value.find(item => item.id === id)?.workObject ?? `#${id}`)
                .join(', ')
            showError(new Error(`Не вошли в приход (уже приняты кем-то другим): ${names}`))
        } else {
            showSuccess(`Принято марок: ${result.matched}`, title.value)
        }
        await router.push('/intake')
    } catch (error) {
        showError(error, 'Не удалось внести на приход')
    } finally {
        isSubmitting.value = false
    }
}
</script>

<template>
  <ErpScreen
      title="Приход"
      :subtitle="title"
      icon="heroicons:truck"
      :shift-link="{to: '/intake', label: 'Назад', icon: 'heroicons:chevron-left', iconSize: 13}"
  >
    <ErpEmptyState v-if="isLoading" loading>
      <span>Загрузка…</span>
    </ErpEmptyState>

    <ErpEmptyState v-else-if="loadError" error>
      <p>{{ loadError }}</p>
      <UiButton variant="outline" @click="load">Повторить</UiButton>
    </ErpEmptyState>

    <ErpEmptyState v-else-if="catalog.length === 0">
      <p>По этому титулу все марки уже приняты</p>
      <UiButton variant="outline" @click="router.push('/intake')">Назад</UiButton>
    </ErpEmptyState>

    <template v-else>
      <ErpSectionLabel>Объекты выполнения работ</ErpSectionLabel>

      <div class="intake-rows">
        <div v-for="row in rows" :key="row.id" class="intake-row">
          <ErpCombobox
              v-model="row.workObject"
              :options="options"
              placeholder="Марка"
              unresolved-hint="Выберите марку из списка"
          />

          <button
              v-if="rows.length > 1"
              type="button"
              class="intake-row__remove"
              aria-label="Убрать строку"
              @click="removeRow(row.id)"
          >
            <Icon name="heroicons:x-mark" size="15"/>
          </button>
        </div>
      </div>

      <button type="button" class="intake-add" aria-label="Добавить строку" @click="addRow">
        <Icon name="heroicons:plus" size="18"/>
      </button>
    </template>

    <template #footer>
      <UiButton block :disabled="!canSubmit" :loading="isSubmitting" @click="submit">
        Внести на приход
      </UiButton>
    </template>
  </ErpScreen>
</template>

<style scoped lang="sass">
.intake-rows
  display: flex
  flex-direction: column
  gap: 8px

.intake-row
  display: flex
  align-items: flex-start
  gap: 6px

  > :first-child
    flex: 1
    min-width: 0

.intake-row__remove
  flex-shrink: 0
  width: 32px
  height: 40px
  border: none
  background: none
  color: var(--color-text-secondary)
  cursor: pointer

.intake-add
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
