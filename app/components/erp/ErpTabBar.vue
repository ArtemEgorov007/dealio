<script setup lang="ts">
import {useErpEmployeeStore} from '~~/store/erp-employee.store'

const route = useRoute()
const router = useRouter()
const employeeStore = useErpEmployeeStore()

const isPackingSection = computed(() => route.path === '/scan-qr')

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
const isWarehouseSection = computed(() => route.path.startsWith('/warehouse'))
const isPersonnelSection = computed(() => route.path === '/personnel')

const access = computed(() => employeeStore.access)

// Fade по краю — только со стороны, где реально есть скрытые вкладки. В
// начале скролла (слева) фейда слева быть не должно — там нечего скрывать,
// первая вкладка обрезана не будет. Пересчитываем на scroll/resize/смену
// набора вкладок (доступы поменялись).
const tabbarEl = ref<HTMLElement | null>(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)

const SCROLL_EDGE_THRESHOLD = 4

const updateScrollState = () => {
  const el = tabbarEl.value
  if (!el) return
  const maxScroll = el.scrollWidth - el.clientWidth
  canScrollLeft.value = el.scrollLeft > SCROLL_EDGE_THRESHOLD
  canScrollRight.value = el.scrollLeft < maxScroll - SCROLL_EDGE_THRESHOLD
}

// Активная вкладка может оказаться за пределами видимой области бара
// (например, «Согласования»/«Склад» при прямом переходе по ссылке —
// прокрутка тогда остаётся в начале) — снаружи выглядит так, будто ничего
// не выбрано. Подтягиваем активный пункт во вьюпорт бара при каждом
// маунте и смене раздела.
const scrollActiveIntoView = (smooth: boolean) => {
  const active = tabbarEl.value?.querySelector('.erp-tabbar__item--active')
  active?.scrollIntoView({inline: 'center', block: 'nearest', behavior: smooth ? 'smooth' : 'instant'})
}

onMounted(() => {
  updateScrollState()
  scrollActiveIntoView(false)
  tabbarEl.value?.addEventListener('scroll', updateScrollState, {passive: true})
  window.addEventListener('resize', updateScrollState)
})

onBeforeUnmount(() => {
  tabbarEl.value?.removeEventListener('scroll', updateScrollState)
  window.removeEventListener('resize', updateScrollState)
})

watch(access, () => nextTick(updateScrollState), {deep: true})
watch(() => route.fullPath, () => nextTick(() => scrollActiveIntoView(true)))

// Сворачивание рельса до одних иконок — только десктоп (см. медиа-запрос
// в стилях, класс применяется независимо от ширины экрана, но эффекта
// на мобильном баре не даёт). Состояние переживает перезагрузку страницы.
const RAIL_COLLAPSE_KEY = 'erp-rail-collapsed'
const isRailCollapsed = ref(false)

onMounted(() => {
  isRailCollapsed.value = localStorage.getItem(RAIL_COLLAPSE_KEY) === '1'
})

const toggleRailCollapse = () => {
  isRailCollapsed.value = !isRailCollapsed.value
  localStorage.setItem(RAIL_COLLAPSE_KEY, isRailCollapsed.value ? '1' : '0')
}

const FADE_SIZE = '14px'

const tabbarMaskStyle = computed(() => {
  let image = 'none'
  if (canScrollLeft.value && canScrollRight.value) {
    image = `linear-gradient(to right, transparent, black ${FADE_SIZE}, black calc(100% - ${FADE_SIZE}), transparent)`
  } else if (canScrollLeft.value) {
    image = `linear-gradient(to right, transparent, black ${FADE_SIZE})`
  } else if (canScrollRight.value) {
    image = `linear-gradient(to right, black calc(100% - ${FADE_SIZE}), transparent)`
  }
  return {maskImage: image, WebkitMaskImage: image}
})

const goProfile = () => router.push('/register')
const goBadges = () => router.push('/workshop')
const goMeasurements = () => router.push('/scan-measurement')
const goPacking = () => router.push('/scan-qr')
const goHandover = () => router.push('/scan-handover')
const goReports = () => router.push('/reports')
const goApprovals = () => router.push('/approvals')
const goSupply = () => router.push('/supply')
const goOrders = () => router.push('/orders')
const goWarehouse = () => router.push('/warehouse')
const goPersonnel = () => router.push('/personnel')

const goLogout = () => {
  employeeStore.logout()
  router.push('/register')
}
</script>

<template>
  <nav
      ref="tabbarEl"
      class="erp-tabbar"
      :class="{ 'erp-tabbar--collapsed': isRailCollapsed }"
      :style="tabbarMaskStyle"
      aria-label="Разделы ERP"
  >
    <button
        type="button"
        class="erp-tabbar__collapse"
        :aria-label="isRailCollapsed ? 'Развернуть меню' : 'Свернуть меню'"
        @click="toggleRailCollapse"
    >
      <Icon name="heroicons:chevron-double-left" size="16" class="erp-tabbar__collapse-icon"/>
    </button>

    <button
        type="button"
        class="erp-tabbar__item"
        :class="{ 'erp-tabbar__item--active': isProfileSection }"
        :title="isRailCollapsed ? 'Профиль' : undefined"
        @click="goProfile"
    >
      <Icon name="heroicons:user-circle" size="22"/>
      <span class="erp-tabbar__label">Профиль</span>
    </button>

    <button
        v-if="!employeeStore.hasFio || access.badges"
        type="button"
        class="erp-tabbar__item"
        :class="{ 'erp-tabbar__item--active': isBadgesSection }"
        :title="isRailCollapsed ? 'Бирки' : undefined"
        @click="goBadges"
    >
      <Icon name="heroicons:tag" size="22"/>
      <span class="erp-tabbar__label">Бирки</span>
    </button>

    <button
        v-if="!employeeStore.hasFio || access.measurements"
        type="button"
        class="erp-tabbar__item"
        :class="{ 'erp-tabbar__item--active': isMeasurementSection }"
        :title="isRailCollapsed ? 'Промеры' : undefined"
        @click="goMeasurements"
    >
      <Icon name="heroicons:beaker" size="22"/>
      <span class="erp-tabbar__label">Промеры</span>
    </button>

    <button
        v-if="!employeeStore.hasFio || access.packing"
        type="button"
        class="erp-tabbar__item"
        :class="{ 'erp-tabbar__item--active': isPackingSection }"
        :title="isRailCollapsed ? 'Упаковка' : undefined"
        @click="goPacking"
    >
      <Icon name="heroicons:qr-code" size="22"/>
      <span class="erp-tabbar__label">Упаковка</span>
    </button>

    <button
        v-if="!employeeStore.hasFio || access.handover"
        type="button"
        class="erp-tabbar__item"
        :class="{ 'erp-tabbar__item--active': isHandoverSection }"
        :title="isRailCollapsed ? 'Сдача' : undefined"
        @click="goHandover"
    >
      <Icon name="heroicons:check-badge" size="22"/>
      <span class="erp-tabbar__label">Сдача</span>
    </button>

    <button
        v-if="!employeeStore.hasFio || access.reports"
        type="button"
        class="erp-tabbar__item"
        :class="{ 'erp-tabbar__item--active': isReportsSection }"
        :title="isRailCollapsed ? 'Отчеты' : undefined"
        @click="goReports"
    >
      <Icon name="heroicons:chart-bar" size="22"/>
      <span class="erp-tabbar__label">Отчеты</span>
    </button>

    <button
        v-if="!employeeStore.hasFio || access.approvals"
        type="button"
        class="erp-tabbar__item"
        :class="{ 'erp-tabbar__item--active': isApprovalsSection }"
        :title="isRailCollapsed ? 'Согласования' : undefined"
        @click="goApprovals"
    >
      <Icon name="heroicons:check-circle" size="22"/>
      <span class="erp-tabbar__label">Согласования</span>
    </button>

    <button
        v-if="!employeeStore.hasFio || access.supply"
        type="button"
        class="erp-tabbar__item"
        :class="{ 'erp-tabbar__item--active': isSupplySection }"
        :title="isRailCollapsed ? 'Снабжение' : undefined"
        @click="goSupply"
    >
      <Icon name="heroicons:truck" size="22"/>
      <span class="erp-tabbar__label">Снабжение</span>
    </button>

    <button
        v-if="!employeeStore.hasFio || access.orders"
        type="button"
        class="erp-tabbar__item"
        :class="{ 'erp-tabbar__item--active': isOrdersSection }"
        :title="isRailCollapsed ? 'Заказы' : undefined"
        @click="goOrders"
    >
      <Icon name="heroicons:shopping-bag" size="22"/>
      <span class="erp-tabbar__label">Заказы</span>
    </button>

    <button
        v-if="!employeeStore.hasFio || access.warehouse"
        type="button"
        class="erp-tabbar__item"
        :class="{ 'erp-tabbar__item--active': isWarehouseSection }"
        :title="isRailCollapsed ? 'Склад' : undefined"
        @click="goWarehouse"
    >
      <Icon name="heroicons:archive-box" size="22"/>
      <span class="erp-tabbar__label">Склад</span>
    </button>

    <button
        v-if="!employeeStore.hasFio || access.personnel"
        type="button"
        class="erp-tabbar__item"
        :class="{ 'erp-tabbar__item--active': isPersonnelSection }"
        :title="isRailCollapsed ? 'Кадры' : undefined"
        @click="goPersonnel"
    >
      <Icon name="heroicons:user-group" size="22"/>
      <span class="erp-tabbar__label">Кадры</span>
    </button>

    <button
        v-if="employeeStore.hasFio"
        type="button"
        class="erp-tabbar__item erp-tabbar__item--logout"
        :title="isRailCollapsed ? 'Выйти' : undefined"
        @click="goLogout"
    >
      <Icon name="heroicons:arrow-right-on-rectangle" size="22"/>
      <span class="erp-tabbar__label">Выйти</span>
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

  &:hover
    background-color: rgba(1, 110, 215, 0.06)

  &:active
    background-color: rgba(1, 110, 215, 0.10)

  &--active
    color: var(--color-primary)
    background-color: var(--color-primary-light)

  &--logout
    display: none

.erp-tabbar__collapse
  display: none

/* На широком экране бар снизу превращается в вертикальный рельс слева —
   контент выше уже сам центрируется в оставшейся ширине (ErpScreen
   max-width:480 + margin:auto), правка нужна только самому бару. */
@media (min-width: 900px)
  .erp-tabbar
    flex-direction: column
    align-items: stretch
    overflow: visible
    width: 220px
    height: 100%
    margin: 0
    padding: 16px 10px
    gap: 8px
    border-radius: 0
    box-shadow: none
    background: var(--color-card-bg, #fff)
    border-right: 1px solid rgba(60, 60, 67, 0.16)
    order: -1
    mask-image: none !important
    -webkit-mask-image: none !important
    transition: width 0.2s ease

  .erp-tabbar__item
    // Базовое flex: 1 0 auto растягивает каждый пункт на равную долю
    // всей высоты рельса (height:100% + column) — отсюда и «огромные»
    // кнопки. В рельсе пункты должны занимать только свою естественную
    // высоту, а лишнее место — просто пустота внизу.
    flex: 0 0 auto
    flex-direction: row
    justify-content: flex-start
    width: 100%
    min-width: 0
    padding: 9px 12px
    gap: 10px
    font-size: 13px

    &--logout
      display: flex
      margin-top: auto
      color: #e5484d

      &:hover
        background-color: rgba(229, 72, 77, 0.06)

      &:active
        background-color: rgba(229, 72, 77, 0.10)

  .erp-tabbar__collapse
    display: flex
    align-items: center
    justify-content: center
    align-self: flex-end
    width: 28px
    height: 28px
    margin-bottom: 4px
    border: none
    border-radius: 8px
    background: none
    color: #8a97a8
    cursor: pointer

    &:hover
      background-color: rgba(60, 60, 67, 0.06)

  .erp-tabbar__collapse-icon
    transition: transform 0.2s ease

  // Свёрнутый рельс — одни иконки, по центру, без подписей и без
  // кнопки «Выйти» с текстом (иконка остаётся, title вместо подписи).
  .erp-tabbar--collapsed
    width: 76px

    .erp-tabbar__collapse
      align-self: center

    .erp-tabbar__collapse-icon
      transform: rotate(180deg)

    .erp-tabbar__item
      justify-content: center
      padding: 9px
      gap: 0

      .erp-tabbar__label
        display: none
</style>
