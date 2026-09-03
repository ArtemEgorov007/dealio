import {useErpEmployeeStore} from '~~/store/erp-employee.store'
import {
  startErpSupplyQueueWatcher,
  stopErpSupplyQueueWatcher,
} from '~/composables/useErpSupplyQueueWatcher'

export default defineNuxtPlugin(() => {
  const employeeStore = useErpEmployeeStore()

  watch(
    () => employeeStore.hasFio && employeeStore.access.supply,
    (active) => {
      if (active) startErpSupplyQueueWatcher()
      else stopErpSupplyQueueWatcher()
    },
    {immediate: true},
  )
})
