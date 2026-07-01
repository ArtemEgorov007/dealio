import {useCrmEmployeeStore} from '~~/store/crm-employee.store'

export default defineNuxtPlugin(() => {
    useCrmEmployeeStore().init()
})
