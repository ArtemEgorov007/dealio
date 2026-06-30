<script setup lang="ts">
import {useCrmEmployeeStore} from '~~/store/crm-employee.store'
import {isValidFio} from '~~/types/crm.types'

definePageMeta({layout: 'crm'})

useSeoMeta({title: 'Регистрация | CRM'})

const employeeStore = useCrmEmployeeStore()
const router = useRouter()

const fio = ref(employeeStore.fio)
const error = ref('')

// Валидирует и сохраняет ФИО в стор. Не вызываем это на каждый ввод —
// иначе недописанное имя ("Ива" вместо "Иванов") навсегда уходит в стор,
// если уйти со страницы до того, как допечатать (например, по нижнему
// tab bar). Коммитим только в момент реального перехода — см. ниже.
const validateAndCommit = (): boolean => {
    const value = fio.value.trim()

    if (!isValidFio(value)) {
        error.value = 'Введите ФИО полностью (минимум 3 символа)'
        return false
    }

    error.value = ''
    employeeStore.setFio(value)
    return true
}

const proceed = (path: string) => {
    if (validateAndCommit()) router.push(path)
}

const goToBadges = () => proceed('/workshop')
const goToPacking = () => proceed('/workshop?flow=packing')

// Переход через нижний tab bar (Бирки/Упаковка/любой другой раздел) не
// проходит через goToBadges/goToPacking — это та же навигация, что и
// клик по кнопкам, поэтому валидируем и сохраняем здесь же. Если ФИО
// не набрано, блокируем переход и показываем ту же ошибку.
onBeforeRouteLeave(() => validateAndCommit())
</script>

<template>
  <CrmScreen
      title="Регистрация"
      subtitle="Укажите ФИО — оно будет подставляться в журнал выдачи бирок"
  >
    <UiInput
        id="crm-fio"
        v-model="fio"
        label="ФИО"
        placeholder="Иванов Иван Иванович"
        autocomplete="name"
        required
        :error="error"
        @keyup.enter="goToBadges"
    />

    <div class="register-actions">
      <UiButton block @click="goToBadges">
        Бирки
      </UiButton>
      <UiButton block variant="outline" @click="goToPacking">
        Упаковки
      </UiButton>
    </div>
  </CrmScreen>
</template>

<style scoped lang="sass">
.register-actions
  display: flex
  flex-direction: column
  gap: var(--spacing-3)
</style>
