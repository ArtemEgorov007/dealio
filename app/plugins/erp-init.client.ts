import {useErpEmployeeStore} from '~~/store/erp-employee.store'

export default defineNuxtPlugin(() => {
    useErpEmployeeStore().init()
})
