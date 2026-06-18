<script setup lang="ts">
import {MENU_DATA} from "~/components/layout/menu.data"
import {useLogout} from '~/composables/useLogout'

const mobileMenuItems = computed(() => {
  return MENU_DATA.filter(item =>
      ['Доска', 'Идеи', 'Задачи', 'Желания', 'Настройки'].includes(item.name)
  )
})

const {logout} = useLogout()

const isLogoutVisible = ref(false)

const toggleLogout = () => {
  isLogoutVisible.value = !isLogoutVisible.value
}
</script>

<template>
  <div class="mobile-bottom-nav">
    <div class="nav-items">
      <NuxtLink
          v-for="item in mobileMenuItems"
          :key="item.name"
          :to="item.url"
          class="nav-item"
          active-class="nav-item--active"
      >
        <Icon :name="item.icon" class="nav-item__icon"/>
        <span class="nav-item__label">{{ item.name }}</span>
      </NuxtLink>

      <button
          class="nav-item nav-item--more"
          :class="{ 'nav-item--active': isLogoutVisible }"
          @click="toggleLogout"
      >
        <Icon name="heroicons:ellipsis-horizontal" class="nav-item__icon"/>
        <span class="nav-item__label">Ещё</span>
      </button>
    </div>

    <Transition name="dropdown">
      <div v-if="isLogoutVisible" class="additional-menu">
        <div class="additional-menu__content">
          <NuxtLink
              v-for="item in MENU_DATA.filter(item => !mobileMenuItems.some(mobile => mobile.name === item.name))"
              :key="item.name"
              :to="item.url"
              class="additional-item"
              @click="isLogoutVisible = false"
          >
            <Icon :name="item.icon" class="additional-item__icon"/>
            <span class="additional-item__label">{{ item.name }}</span>
          </NuxtLink>

          <button class="additional-item additional-item--logout" @click="logout">
            <Icon name="heroicons:arrow-left-on-rectangle" class="additional-item__icon"/>
            <span class="additional-item__label">Выйти</span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="sass">
.mobile-bottom-nav
  position: fixed
  bottom: 0
  left: 0
  right: 0
  z-index: 1000
  background-color: var(--color-card-bg)
  border-top: var(--border-width) solid var(--color-border)
  box-shadow: 0 -4px 16px rgba(15, 23, 42, 0.08)
  backdrop-filter: blur(12px)
  -webkit-backdrop-filter: blur(12px)

.nav-items
  display: flex
  justify-content: space-around
  align-items: center
  padding: var(--spacing-2) 0 max(var(--spacing-2), env(safe-area-inset-bottom, 8px))
  min-height: 60px

.nav-item
  display: flex
  flex-direction: column
  align-items: center
  justify-content: center
  gap: 3px
  padding: var(--spacing-2)
  background: none
  border: none
  cursor: pointer
  color: var(--color-text-muted)
  text-decoration: none
  transition: all var(--transition-fast) ease
  border-radius: var(--radius-md)
  min-width: 52px
  position: relative

  &:hover
    color: var(--color-primary)

  &--active
    color: var(--color-primary)

    .nav-item__icon
      transform: scale(1.1)

  &--more.nav-item--active
    color: var(--color-primary)

.nav-item__icon
  width: 22px
  height: 22px
  transition: transform var(--transition-fast) ease

.nav-item__label
  font-size: 10px
  font-weight: 600
  white-space: nowrap
  letter-spacing: 0.1px

.additional-menu
  position: absolute
  bottom: 100%
  left: 0
  right: 0
  background-color: var(--color-card-bg)
  border-top: var(--border-width) solid var(--color-border)
  box-shadow: 0 -8px 24px rgba(15, 23, 42, 0.12)

.additional-menu__content
  padding: var(--spacing-4)
  display: flex
  flex-direction: column
  gap: 2px
  max-height: 60vh
  overflow-y: auto

.additional-item
  display: flex
  align-items: center
  gap: var(--spacing-3)
  padding: var(--spacing-3) var(--spacing-3)
  background: none
  border: none
  cursor: pointer
  color: var(--color-text-secondary)
  text-decoration: none
  transition: all var(--transition-fast) ease
  border-radius: var(--radius-md)
  font-size: var(--font-size-sm)
  width: 100%

  &:hover
    background-color: var(--color-bg-secondary)
    color: var(--color-text)

  &--logout
    color: var(--color-danger)
    border-top: var(--border-width) solid var(--color-border)
    margin-top: var(--spacing-2)
    padding-top: var(--spacing-4)

    &:hover
      background-color: var(--color-danger-light)

.additional-item__icon
  width: 18px
  height: 18px
  flex-shrink: 0

.additional-item__label
  font-weight: 600

.dropdown-enter-active,
.dropdown-leave-active
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1)

.dropdown-enter-from
  opacity: 0
  transform: translateY(12px)

.dropdown-enter-to
  opacity: 1
  transform: translateY(0)

.dropdown-leave-from
  opacity: 1
  transform: translateY(0)

.dropdown-leave-to
  opacity: 0
  transform: translateY(12px)

@media (min-width: 769px)
  .mobile-bottom-nav
    display: none
</style>
