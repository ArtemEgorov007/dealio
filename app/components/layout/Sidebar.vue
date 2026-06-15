<script setup lang="ts">
import {account} from '@/utils/appwrite'

import {useAuthStore, useIsLoadingStore} from '~~/store/auth.store'

const { app } = useRuntimeConfig()
const baseURL = app.baseURL

const router = useRouter()
const isOpen = ref(true)

const toggleSidebar = () => {
  isOpen.value = !isOpen.value
}

const isLoadingStore = useIsLoadingStore()
const authStore = useAuthStore()

const logout = async () => {
  try {
    isLoadingStore.set(true)
    await account.deleteSession('current')
    authStore.clear()
    await router.push('/login')
  } finally {
    isLoadingStore.set(false)
  }
}
</script>

<template>
  <aside class="sidebar" :class="{ 'sidebar--collapsed': !isOpen }">
    <div class="sidebar__header">
      <NuxtLink to="/" class="logo-link">
        <div class="logo-mark">
          <span class="logo-icon">D</span>
        </div>
        <span v-if="isOpen" class="logo-text">Dealio</span>
      </NuxtLink>

      <button class="toggle-btn" @click="toggleSidebar" :aria-label="isOpen ? 'Свернуть меню' : 'Развернуть меню'">
        <Icon
            :name="isOpen ? 'heroicons:chevron-left' : 'heroicons:chevron-right'"
            class="toggle-icon"
        />
      </button>
    </div>

    <nav class="sidebar__nav">
      <LayoutMenu :is-collapsed="!isOpen"/>
    </nav>

    <div class="sidebar__footer">
      <div class="sidebar__theme-toggle">
        <UiThemeToggle />
        <span v-if="isOpen" class="footer-label">Тема</span>
      </div>

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
  height: 100vh
  position: sticky
  top: 0
  flex-shrink: 0
  background-color: var(--color-bg-surface)
  border-right: var(--border-width) solid var(--color-border)
  transition: width 0.25s var(--transition-ease)
  overflow: hidden

  &--collapsed
    width: var(--sidebar-width-collapsed)

    .logo-text
      display: none

    .logo-link
      justify-content: center

    .footer-label
      display: none

    .sidebar__theme-toggle
      justify-content: center

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

  &__theme-toggle
    display: flex
    align-items: center
    gap: var(--spacing-3)
    padding: var(--spacing-1) 0

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
  background: linear-gradient(135deg, var(--color-primary), #0f9b8e)
  border-radius: var(--radius-md)
  display: flex
  align-items: center
  justify-content: center
  flex-shrink: 0
  box-shadow: 0 2px 8px rgba(13, 148, 136, 0.3)

.logo-icon
  color: white
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
  background: linear-gradient(135deg, #8b5cf6, #0d9488)
  display: flex
  align-items: center
  justify-content: center
  color: white
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
