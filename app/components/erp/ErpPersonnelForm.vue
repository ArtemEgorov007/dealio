<script setup lang="ts">
import type {ErpPersonnelDraft, ErpPersonnelEmployee, ErpPersonnelRight} from '~~/types/erp.types'

const props = defineProps<{
  employee?: ErpPersonnelEmployee | null
  platforms: string[]
  busy: boolean
  create?: boolean
  inSheet?: boolean
}>()

const emit = defineEmits<{ submit: [draft: ErpPersonnelDraft]; cancel: [] }>()

const roleOptions = [{value: 'Исполнитель', label: 'Исполнитель'}, {value: 'Менеджер', label: 'Менеджер'}]
const platformOptions = computed(() => props.platforms.map((platform) => ({value: platform, label: platform})))
const employeeSubtitle = computed(() => [props.employee?.department, props.employee?.position].filter(Boolean).join(' • '))
const draft = reactive<ErpPersonnelDraft>({fio: '', department: '', position: '', platform: '', role: 'Исполнитель', login: '', password: '', rights: []})
const initialPassword = ref('')

const reset = () => {
  const employee = props.employee
  draft.fio = employee?.fio ?? ''
  draft.department = employee?.department ?? ''
  draft.position = employee?.position ?? ''
  draft.platform = employee?.platform ?? ''
  draft.role = employee?.role ?? 'Исполнитель'
  draft.login = employee?.login ?? ''
  draft.password = employee?.password ?? ''
  initialPassword.value = employee?.password ?? ''
  draft.rights = (employee?.rights ?? []).map((right): ErpPersonnelRight => ({...right}))
}

watch(() => [props.employee, props.create], reset, {immediate: true})

const isPasswordChanged = computed(() => {
  if (props.create) return false
  const next = draft.password.trim()
  if (next === '') return false
  return next !== initialPassword.value
})
const isPasswordValid = computed(() => !isPasswordChanged.value || (/^[A-Za-z0-9]{10}$/.test(draft.password) && /[a-z]/.test(draft.password) && /[A-Z]/.test(draft.password) && /[0-9]/.test(draft.password)))
const passwordError = computed(() => isPasswordChanged.value && !isPasswordValid.value ? '10 символов: A–Z, a–z и цифры' : undefined)
const canSubmit = computed(() => Boolean(
  draft.login.trim() && draft.platform && draft.role && isPasswordValid.value && (!props.create || (draft.fio.trim() && draft.department.trim() && draft.position.trim())),
))

const submit = () => {
  if (!canSubmit.value || props.busy) return
  emit('submit', {...draft, password: isPasswordChanged.value ? draft.password : '', rights: draft.rights.map((right) => ({...right}))})
}
</script>

<template>
  <form class="personnel-form" @submit.prevent="submit">
    <template v-if="!create">
      <header class="personnel-card-head">
        <h2 class="personnel-card-head__title">{{ employee?.fio }}</h2>
        <p v-if="employeeSubtitle" class="personnel-card-head__subtitle">{{ employeeSubtitle }}</p>
      </header>
    </template>
    <template v-else>
      <UiInput v-model="draft.fio" label="ФИО" required flush/>
      <UiInput v-model="draft.department" label="Отдел" required flush/>
      <UiInput v-model="draft.position" label="Должность" required flush/>
    </template>

    <div class="personnel-form__field">
      <ErpSectionLabel>Площадка</ErpSectionLabel>
      <UiSelect v-model="draft.platform" :options="platformOptions" required flush/>
    </div>

    <div class="personnel-form__field">
      <ErpSectionLabel>Роль</ErpSectionLabel>
      <UiSegmentedControl v-model="draft.role" :options="roleOptions"/>
    </div>

    <div class="personnel-form__field">
      <ErpSectionLabel>Логин</ErpSectionLabel>
      <UiInput v-model="draft.login" required flush/>
    </div>
    <div v-if="!create" class="personnel-form__field">
      <ErpSectionLabel>Пароль</ErpSectionLabel>
      <UiInput
          v-model="draft.password"
          type="password"
          hint="Оставьте пустым, чтобы не менять"
          :error="passwordError"
          show-password-toggle
          flush
      />
    </div>

    <section v-if="draft.rights.length" class="personnel-form__rights">
      <ErpSectionLabel>Права и доступы</ErpSectionLabel>
      <div v-for="right in draft.rights" :key="right.name" class="personnel-form__right">
        <span>{{ right.name }}</span>
        <UiSegmentedControl v-model="right.value" :options="[{value: 'Да'}, {value: 'Нет'}]"/>
      </div>
    </section>

    <div class="personnel-form__actions" :class="{ 'personnel-form__actions--sheet': inSheet }">
      <UiButton block :loading="busy" :disabled="!canSubmit" type="submit">{{ create ? 'Добавить' : 'Сохранить' }}</UiButton>
      <UiButton block variant="outline" :disabled="busy" type="button" @click="$emit('cancel')">Отмена</UiButton>
      <slot name="dismiss"/>
    </div>
  </form>
</template>

<style scoped lang="sass">
.personnel-form
  display: flex
  flex-direction: column
  gap: 12px

.personnel-card-head
  padding: 18px 16px
  border-radius: 18px
  background: #016ED7
  box-shadow: 0 12px 28px -18px rgba(1, 110, 215, 0.9)

.personnel-card-head__title
  margin: 0
  color: #fff
  font-size: 20px
  font-weight: 800
  letter-spacing: -0.3px
  line-height: 1.2

.personnel-card-head__subtitle
  margin: 4px 0 0
  color: rgba(255, 255, 255, 0.82)
  font-size: 15px
  line-height: 1.4

.personnel-form__field
  display: flex
  flex-direction: column
  gap: 6px

.personnel-form__actions
  display: flex
  flex-direction: column
  gap: 8px
  position: sticky
  bottom: -16px
  margin: 4px -16px -16px
  padding: 12px 16px calc(16px + env(safe-area-inset-bottom))
  background: #F2F2F7
  box-shadow: 0 -10px 18px -18px rgba(0, 0, 0, 0.45)

  &--sheet
    position: static
    bottom: auto
    margin: 8px 0 0
    padding: 0
    background: transparent
    box-shadow: none

.personnel-form__rights
  display: flex
  flex-direction: column
  gap: 8px

.personnel-form__right
  display: grid
  grid-template-columns: minmax(0, 1fr) minmax(96px, 112px)
  gap: 8px
  align-items: center
  padding: 10px 12px
  border-radius: 10px
  background: var(--color-card-bg)
  font-size: 13px

  > span
    min-width: 0
    overflow-wrap: anywhere
</style>
