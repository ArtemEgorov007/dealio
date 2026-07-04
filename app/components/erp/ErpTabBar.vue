<script setup lang="ts">
import {useErpEmployeeStore} from '~~/store/erp-employee.store'

const route = useRoute()
const router = useRouter()
const employeeStore = useErpEmployeeStore()

const isPackingSection = computed(() =>
    route.path === '/scan-qr' || (route.path === '/workshop' && route.query.flow === 'packing'),
)

const isHandoverSection = computed(() =>
    ['/scan-handover', '/handover-shift'].includes(route.path),
)

const isMeasurementSection = computed(() =>
    ['/scan-measurement', '/measurement'].includes(route.path),
)

const isBadgesSection = computed(() =>
    !isPackingSection.value && !isHandoverSection.value && !isMeasurementSection.value
    && ['/workshop', '/badges', '/receipt', '/shift'].includes(route.path),
)

const isProfileSection = computed(() => route.path === '/register')

const isReportsSection = computed(() => route.path === '/reports')
const isApprovalsSection = computed(() => route.path === '/approvals')
const isSupplySection = computed(() => route.path === '/supply')
const isOrdersSection = computed(() => route.path === '/orders')
const isWarehouseSection = computed(() => route.path === '/warehouse')

const access = computed(() => employeeStore.access)

const goProfile = () => router.push('/register')
const goBadges = () => router.push('/workshop')
const goMeasurements = () => router.push('/scan-measurement')
const goPacking = () => router.push('/workshop?flow=packing')
const goHandover = () => router.push('/scan-handover')
const goReports = () => router.push('/reports')
const goApprovals = () => router.push('/approvals')
const goSupply = () => router.push('/supply')
const goOrders = () => router.push('/orders')
const goWarehouse = () => router.push('/warehouse')
</script>

<template>
  <nav class="erp-tabbar" aria-label="Разделы ERP">
    <button
        type="button"
        class="erp-tabbar__item"
        :class="{ 'erp-tabbar__item--active': isProfileSection }"
        @click="goProfile"
    >
      <Icon name="heroicons:user-circle" size="22"/>
      <span>Профиль</span>
    </button>

    <button
        v-if="!employeeStore.hasFio || access.badges"
        type="button"
        class="erp-tabbar__item"
        :class="{ 'erp-tabbar__item--active': isBadgesSection }"
        @click="goBadges"
    >
      <Icon name="heroicons:tag" size="22"/>
      <span>Бирки</span>
    </button>

    <button
        v-if="!employeeStore.hasFio || access.measurements"
        type="button"
        class="erp-tabbar__item"
        :class="{ 'erp-tabbar__item--active': isMeasurementSection }"
        @click="goMeasurements"
    >
      <Icon name="heroicons:beaker" size="22"/>
      <span>Промеры</span>
    </button>

    <button
        v-if="!employeeStore.hasFio || access.packing"
        type="button"
        class="erp-tabbar__item"
        :class="{ 'erp-tabbar__item--active': isPackingSection }"
        @click="goPacking"
    >
      <Icon name="heroicons:qr-code" size="22"/>
      <span>Упаковка</span>
    </button>

    <button
        v-if="!employeeStore.hasFio || access.handover"
        type="button"
        class="erp-tabbar__item"
        :class="{ 'erp-tabbar__item--active': isHandoverSection }"
        @click="goHandover"
    >
      <Icon name="heroicons:check-badge" size="22"/>
      <span>Сдача</span>
    </button>

    <button
        v-if="!employeeStore.hasFio || access.reports"
        type="button"
        class="erp-tabbar__item"
        :class="{ 'erp-tabbar__item--active': isReportsSection }"
        @click="goReports"
    >
      <Icon name="heroicons:chart-bar" size="22"/>
      <span>Отчеты</span>
    </button>

    <button
        v-if="!employeeStore.hasFio || access.approvals"
        type="button"
        class="erp-tabbar__item"
        :class="{ 'erp-tabbar__item--active': isApprovalsSection }"
        @click="goApprovals"
    >
      <Icon name="heroicons:check-circle" size="22"/>
      <span>Согласования</span>
    </button>

    <button
        v-if="!employeeStore.hasFio || access.supply"
        type="button"
        class="erp-tabbar__item"
        :class="{ 'erp-tabbar__item--active': isSupplySection }"
        @click="goSupply"
    >
      <Icon name="heroicons:truck" size="22"/>
      <span>Снабжение</span>
    </button>

    <button
        v-if="!employeeStore.hasFio || access.orders"
        type="button"
        class="erp-tabbar__item"
        :class="{ 'erp-tabbar__item--active': isOrdersSection }"
        @click="goOrders"
    >
      <Icon name="heroicons:shopping-bag" size="22"/>
      <span>Заказы</span>
    </button>

    <button
        v-if="!employeeStore.hasFio || access.warehouse"
        type="button"
        class="erp-tabbar__item"
        :class="{ 'erp-tabbar__item--active': isWarehouseSection }"
        @click="goWarehouse"
    >
      <Icon name="heroicons:archive-box" size="22"/>
      <span>Склад</span>
    </button>
  </nav>
</template>

<style scoped lang="sass">
.erp-tabbar
  flex-shrink: 0
  display: flex
  overflow-x: auto
  scrollbar-width: none
  gap: 2px
  margin: 4px 12px calc(env(safe-area-inset-bottom, 0px) + 16px)
  padding: 6px
  border-radius: 20px
  background: #fff
  box-shadow: 0 8px 26px -10px rgba(1, 110, 215, 0.32), 0 1px 3px rgba(1, 110, 215, 0.08)

  &::-webkit-scrollbar
    display: none

.erp-tabbar__item
  /* Растягиваются на всю ширину бара — иконки стоят по центру,
     при переполнении бар по-прежнему скроллится */
  flex: 1 0 auto
  min-width: 60px
  display: flex
  flex-direction: column
  align-items: center
  gap: 3px
  padding: 7px 8px
  border: none
  border-radius: 14px
  background: none
  color: #8a97a8
  font-size: 10px
  font-weight: 600
  cursor: pointer
  white-space: nowrap
  transition: color 0.15s ease, background-color 0.15s ease

  &:active
    background-color: rgba(1, 110, 215, 0.06)

  &--active
    color: var(--color-primary)
    background-color: var(--color-primary-light)
</style>
