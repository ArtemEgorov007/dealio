import {useErpEmployeeStore} from '~~/store/erp-employee.store'
import {
  startErpApprovalsNotifications,
  stopErpApprovalsNotifications,
} from '~/composables/useErpApprovalsNotifications'

export default defineNuxtPlugin(() => {
  const employeeStore = useErpEmployeeStore()

  watch(
    () => employeeStore.hasFio && employeeStore.access.approvals,
    (active) => {
      if (active) startErpApprovalsNotifications()
      else stopErpApprovalsNotifications()
    },
    {immediate: true},
  )
})
