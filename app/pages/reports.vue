<script setup lang="ts">
import {fetchCurrentReports} from '~/utils/erp-sheets'
import type {ErpCurrentReport} from '~/utils/erp-api'

definePageMeta({layout: 'erp'})
useSeoMeta({title: 'Отчеты | ERP'})

const report = ref<ErpCurrentReport | null>(null)
const loading = ref(true)
const error = ref('')

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    report.value = await fetchCurrentReports()
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Не удалось загрузить отчёт'
  } finally {
    loading.value = false
  }
}

const pageSubtitle = computed(() => {
  if (!report.value) return 'Оперативный срез производства'
  const [yearText, monthText] = report.value.period.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return 'Оперативный срез производства'
  }
  const period = new Intl.DateTimeFormat('ru-RU', {month: 'long', year: 'numeric'}).format(new Date(year, month - 1, 1))
  return `Срез за ${period}`
})

onMounted(load)
</script>

<template>
  <ErpScreen
      title="Отчёты"
      icon="heroicons:chart-bar"
      :subtitle="pageSubtitle"
  >
    <template #actions>
      <UiButton
          v-if="report || error"
          size="sm"
          variant="inverse"
          :loading="loading"
          @click="load"
      >
        Обновить
      </UiButton>
    </template>

    <div class="erp-reports">
      <ErpEmptyState v-if="loading && !report" loading>
        Загружаем отчёт…
      </ErpEmptyState>

      <ErpEmptyState v-else-if="error" error>
        <p>{{ error }}</p>
        <UiButton variant="outline" @click="load">Повторить</UiButton>
      </ErpEmptyState>

      <template v-else-if="report">
        <ErpReportsSummary :report="report"/>

        <ErpEmptyState v-if="report.rows.length === 0">
          <p>В отчёте пока нет заполненных строк</p>
          <UiButton variant="outline" @click="load">Обновить</UiButton>
        </ErpEmptyState>

        <ErpReportsTable v-else :rows="report.rows"/>
      </template>
    </div>
  </ErpScreen>
</template>

<style scoped lang="sass">
.erp-reports
  display: grid
  align-content: start
  gap: 22px
</style>
