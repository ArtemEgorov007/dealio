<script setup lang="ts">
import {useErpEmployeeStore} from '~~/store/erp-employee.store'
import {useErpApprovalsStore} from '~~/store/erp-approvals.store'

const route = useRoute()
const router = useRouter()
const employeeStore = useErpEmployeeStore()
const approvalsStore = useErpApprovalsStore()

// Разделы и их пути — из общего реестра: список жил в двух местах и разошёлся,
// «Договоры» появились на плитках, но не в таб-баре.
const sections = computed(() =>
    // До входа показываем все вкладки: иначе бар пуст и выглядит сломанным.
    employeeStore.hasFio ? erpSectionsFor(employeeStore.access) : ERP_SECTIONS,
)

const activeSectionKey = computed(() => erpSectionForRoute(route.path)?.key ?? null)

const isProfileSection = computed(() => route.path === '/register')

// Счётчик пока только у согласований: это единственный раздел, где число
// ждущих решения нужно видеть, не заходя внутрь.
const sectionCount = (key: string): number | null =>
    key === 'approvals' && employeeStore.access.approvals && approvalsStore.pendingCount > 0
        ? approvalsStore.pendingCount
        : null

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
        v-for="section in sections"
        :key="section.key"
        type="button"
        class="erp-tabbar__item"
        :class="{ 'erp-tabbar__item--active': activeSectionKey === section.key }"
        :title="isRailCollapsed ? section.label : undefined"
        @click="router.push(section.to)"
    >
      <Icon :name="section.icon" size="22"/>
      <span class="erp-tabbar__label">{{ section.tabLabel }}</span>
      <span v-if="sectionCount(section.key)" class="erp-tabbar__badge">
        {{ sectionCount(section.key) }}
      </span>
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
  position: relative
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

.erp-tabbar__badge
  position: absolute
  top: 5px
  right: 7px
  min-width: 17px
  height: 17px
  padding: 0 4px
  display: flex
  align-items: center
  justify-content: center
  border-radius: var(--radius-full)
  background: #0f766e
  color: #fff
  font-size: 10px
  font-weight: 700
  font-variant-numeric: tabular-nums

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

  .erp-tabbar__badge
    top: 7px
    right: 10px

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
