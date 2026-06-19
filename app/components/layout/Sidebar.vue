<script setup lang="ts">
import {useAuthStore} from '~~/store/auth.store'
import {useLogout} from '~/composables/useLogout'

const isOpen = ref(true)

const toggleSidebar = () => {
  isOpen.value = !isOpen.value
}

const handleLogoClick = (event: MouseEvent) => {
  if (!isOpen.value) {
    event.preventDefault()
    toggleSidebar()
  }
}

const authStore = useAuthStore()
const {logout} = useLogout()
</script>

<template>
  <aside class="sidebar" :class="{ 'sidebar--collapsed': !isOpen }">
    <div class="sidebar__header">
      <NuxtLink to="/board" class="logo-link" @click="handleLogoClick">
        <div class="logo-mark">
          <span class="logo-icon">D</span>
        </div>
        <span v-if="isOpen" class="logo-text">Dealio</span>
      </NuxtLink>

      <button
          v-if="isOpen"
          class="toggle-btn"
          @click="toggleSidebar"
          :aria-label="'Свернуть меню'"
      >
        <Icon
            name="heroicons:chevron-left"
            class="toggle-icon"
        />
      </button>
    </div>

    <nav class="sidebar__nav">
      <LayoutMenu :is-collapsed="!isOpen"/>
    </nav>

    <div class="sidebar__footer">
      <div class="sidebar__user" v-if="isOpen && authStore.user">
        <div class="user-avatar">
          {{ authStore.user.name?.charAt(0)?.toUpperCase() || 'U' }}
        </div>
        <div class="user-info">
          <span class="user-name">{{ authStore.user.name || 'Пользователь' }}</span>
          <span class="user-email">{{ authStore.user.email || '' }}</span>
        </div>
      </div>

      <button class="logout-btn" @click="logout" aria-label="Выйти из аккаунта">
        <Icon name="heroicons:arrow-left-on-rectangle" class="logout-icon"/>
        <span class="logout-label" v-if="isOpen">Выйти</span>
      </button>
    </div>
  </aside>
</template>

<style scoped lang="sass">
.sidebar
  display: flex
  flex-direction: column
  width: var(--sidebar-width-expanded)
  height: 100%
  flex-shrink: 0
  background-color: var(--color-bg-surface)
  border-right: var(--border-width) solid var(--color-border)
  transition: width 0.25s var(--transition-ease)
  overflow: hidden

  &--collapsed
    width: var(--sidebar-width-collapsed)

    .sidebar__header
      justify-content: center
      padding: var(--spacing-4) var(--spacing-2)

    .logo-text
      display: none

    .logo-link
      justify-content: center
      flex: 0

    .footer-label
      display: none

    .user-avatar
      margin: 0 auto

  &__header
    flex-shrink: 0
    display: flex
    align-items: center
    justify-content: space-between
    padding: var(--spacing-4) var(--spacing-4)
    border-bottom: var(--border-width) solid var(--color-border)
    height: 60px
    min-width: 0
    overflow: hidden

  &__nav
    flex: 1
    overflow-y: auto
    overflow-x: hidden
    padding: var(--spacing-3) 0

  &__footer
    flex-shrink: 0
    padding: var(--spacing-4)
    border-top: var(--border-width) solid var(--color-border)
    display: flex
    flex-direction: column
    gap: var(--spacing-3)

  &__user
    display: flex
    align-items: center
    gap: var(--spacing-3)
    padding: var(--spacing-2) var(--spacing-1)
    border-radius: var(--radius-md)

.logo-link
  display: flex
  align-items: center
  gap: var(--spacing-3)
  text-decoration: none
  transition: opacity var(--transition-normal) ease

  &:hover
    opacity: 0.85

.logo-mark
  width: 32px
  height: 32px
  background: var(--color-primary)
  border-radius: var(--radius-md)
  display: flex
  align-items: center
  justify-content: center
  flex-shrink: 0

.logo-icon
  color: var(--color-text-inverse)
  font-size: 16px
  font-weight: 800
  letter-spacing: -0.5px
  line-height: 1

.logo-text
  font-size: var(--font-size-lg)
  font-weight: 800
  color: var(--color-text)
  letter-spacing: -0.3px
  white-space: nowrap

.toggle-btn
  background: none
  border: none
  cursor: pointer
  padding: var(--spacing-2)
  color: var(--color-text-muted)
  border-radius: var(--radius-sm)
  transition: all var(--transition-normal) ease
  display: flex
  align-items: center
  justify-content: center

  &:hover
    color: var(--color-text)
    background-color: var(--color-bg-secondary)

.toggle-icon
  width: 18px
  height: 18px

.user-avatar
  width: 32px
  height: 32px
  border-radius: var(--radius-full)
  background: var(--color-bg-tertiary)
  border: var(--border-width) solid var(--color-border)
  display: flex
  align-items: center
  justify-content: center
  color: var(--color-text)
  font-size: var(--font-size-sm)
  font-weight: 700
  flex-shrink: 0

.user-info
  display: flex
  flex-direction: column
  overflow: hidden

.user-name
  font-size: var(--font-size-sm)
  font-weight: 600
  color: var(--color-text)
  white-space: nowrap
  overflow: hidden
  text-overflow: ellipsis

.user-email
  font-size: var(--font-size-xs)
  color: var(--color-text-muted)
  white-space: nowrap
  overflow: hidden
  text-overflow: ellipsis

.footer-label
  font-size: var(--font-size-sm)
  color: var(--color-text-secondary)
  font-weight: 500

.logout-btn
  display: flex
  align-items: center
  justify-content: flex-start
  gap: var(--spacing-3)
  width: 100%
  background: none
  border: none
  cursor: pointer
  color: var(--color-text-muted)
  font-size: var(--font-size-sm)
  font-weight: 500
  padding: var(--spacing-2) var(--spacing-1)
  border-radius: var(--radius-md)
  transition: all var(--transition-normal) ease

  &:hover
    color: var(--color-danger)
    background-color: var(--color-danger-light)

  .sidebar--collapsed &
    justify-content: center

.logout-icon
  width: 18px
  height: 18px
  flex-shrink: 0

.logout-label
  white-space: nowrap

@media (max-width: 768px)
  .sidebar
    display: none
</style>
