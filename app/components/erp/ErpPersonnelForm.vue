<script setup lang="ts">
import type {ErpPersonnelDraft, ErpPersonnelEmployee, ErpPersonnelRight} from '~~/types/erp.types'

const props = defineProps<{
  employee?: ErpPersonnelEmployee | null
  platforms: string[]
  busy: boolean
  create?: boolean
}>()

const emit = defineEmits<{ submit: [draft: ErpPersonnelDraft]; cancel: [] }>()

const roleOptions = [{value: 'Исполнитель', label: 'Исполнитель'}, {value: 'Менеджер', label: 'Менеджер'}]
const platformOptions = computed(() => props.platforms.map((platform) => ({value: platform, label: platform})))
const draft = reactive<ErpPersonnelDraft>({fio: '', department: '', position: '', platform: '', role: 'Исполнитель', login: '', password: '', rights: []})

const reset = () => {
  const employee = props.employee
  draft.fio = employee?.fio ?? ''
  draft.department = employee?.department ?? ''
  draft.position = employee?.position ?? ''
  draft.platform = employee?.platform ?? ''
  draft.role = employee?.role ?? 'Исполнитель'
  draft.login = employee?.login ?? ''
  draft.password = employee?.password ?? ''
  draft.rights = (employee?.rights ?? []).map((right): ErpPersonnelRight => ({...right}))
}

watch(() => [props.employee, props.create], reset, {immediate: true})

const canSubmit = computed(() => Boolean(
  draft.login.trim() && draft.platform && draft.role && (!props.create || (draft.fio.trim() && draft.department.trim() && draft.position.trim())),
))

const submit = () => {
  if (!canSubmit.value || props.busy) return
  emit('submit', {...draft, rights: draft.rights.map((right) => ({...right}))})
}
</script>

<template>
  <form class="personnel-form" @submit.prevent="submit">
    <template v-if="!create">
      <div class="personnel-form__readonly"><span>Отдел</span><strong>{{ employee?.department }}</strong></div>
      <div class="personnel-form__readonly"><span>Должность</span><strong>{{ employee?.position }}</strong></div>
      <div class="personnel-form__readonly"><span>ФИО</span><strong>{{ employee?.fio }}</strong></div>
    </template>
    <template v-else>
      <UiInput v-model="draft.fio" label="ФИО" required flush/>
      <UiInput v-model="draft.department" label="Отдел" required flush/>
      <UiInput v-model="draft.position" label="Должность" required flush/>
    </template>

    <UiSelect v-model="draft.platform" label="Площадка" :options="platformOptions" required flush/>
    <UiSegmentedControl v-model="draft.role" :options="roleOptions" align="start"/>
    <UiInput v-model="draft.login" label="Логин" required flush/>
    <UiInput v-if="!create" v-model="draft.password" label="Пароль" type="password" show-password-toggle flush/>

    <section v-if="draft.rights.length" class="personnel-form__rights">
      <p>Права и доступы</p>
      <div v-for="right in draft.rights" :key="right.name" class="personnel-form__right">
        <span>{{ right.name }}</span>
        <UiSegmentedControl v-model="right.value" :options="[{value: 'Да'}, {value: 'Нет'}]"/>
      </div>
    </section>

    <UiButton block :loading="busy" :disabled="!canSubmit" type="submit">{{ create ? 'Добавить' : 'Сохранить' }}</UiButton>
    <UiButton block variant="outline" :disabled="busy" type="button" @click="$emit('cancel')">Отмена</UiButton>
  </form>
</template>

<style scoped lang="sass">
.personnel-form
  display: flex
  flex-direction: column
  gap: 14px

.personnel-form__readonly
  display: flex
  flex-direction: column
  gap: 2px
  padding: 10px 12px
  border-radius: 10px
  background: var(--color-card-bg)

  span
    color: var(--color-text-secondary)
    font-size: 11px
    text-transform: uppercase

  strong
    font-size: 14px

.personnel-form__rights
  display: flex
  flex-direction: column
  gap: 8px

  > p
    margin: 0
    color: var(--color-text-secondary)
    font-size: 12px
    font-weight: 700
    text-transform: uppercase

.personnel-form__right
  display: grid
  grid-template-columns: minmax(0, 1fr) 132px
  gap: 10px
  align-items: center
  padding: 10px 12px
  border-radius: 10px
  background: var(--color-card-bg)
  font-size: 13px
</style>
