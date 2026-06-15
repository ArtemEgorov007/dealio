<script setup lang="ts">
import {account} from '@/utils/appwrite'

import {useAuthStore, useIsLoadingStore} from '~~/store/auth.store'

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
        <NuxtImg
            src="/logo.svg"
            alt="Логотип Dealio"
            class="logo"
            width="100"
            height="auto"
        />
      </NuxtLink>

      <button class="toggle-btn" @click="toggleSidebar" aria-label="Свернуть меню">
        <Icon
            :name="isOpen ? 'heroicons:chevron-left' : 'heroicons:chevron-right'"
            class="toggle-icon"
        />
      </button>
    </div>

    <nav class="sidebar__nav">
      <LayoutMenu/>
    </nav>

    <div class="sidebar__footer">
      <div class="sidebar__theme-toggle">
        <UiThemeToggle />
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
  background-color: var(--color-bg)
  border-right: var(--border-width) solid var(--color-border)
  box-shadow: var(--shadow-md)
  transition: width 0.3s ease

  &--collapsed
    width: var(--sidebar-width-collapsed)

    .nav-link span,
    .logout-label
      display: none

    .logo-link
      padding: 0
      width: auto

    .sidebar__theme-toggle
      display: flex
      justify-content: center

  &__header
    flex-shrink: 0
    display: flex
    align-items: center
    justify-content: space-between
    padding: var(--spacing-4)
    border-bottom: var(--border-width) solid var(--color-border)

  &__nav
    flex: 1
    overflow-y: auto
    padding: var(--spacing-5) 0

  &__footer
    flex-shrink: 0
    padding: var(--spacing-4)
    border-top: var(--border-width) solid var(--color-border)
    display: flex
    flex-direction: column
    gap: var(--spacing-4)

  &__theme-toggle
    display: flex
    justify-content: flex-start

.logo-link
  display: block
  transition: opacity 0.3s ease

.logo
  max-width: 100%
  height: auto

.toggle-btn
  background: none
  border: none
  cursor: pointer
  padding: var(--spacing-2)
  color: var(--color-text-secondary)
  transition: color var(--transition-normal) ease

  &:hover
    color: var(--color-primary)

.toggle-icon
  width: 24px
  height: 24px

.logout-btn
  display: flex
  align-items: center
  justify-content: flex-start
  gap: var(--spacing-2)
  width: 100%
  background: none
  border: none
  cursor: pointer
  color: var(--color-text-secondary)
  font-size: var(--font-size-base)
  transition: color var(--transition-normal) ease

  &:hover
    color: var(--color-danger)

  .sidebar--collapsed &
    justify-content: center

.logout-icon
  width: 24px
  height: 24px

.logout-label
  white-space: nowrap

@media (max-width: 768px)
  .sidebar
    display: none
// Скрываем сайдбар на мобильных
</style>