<script setup lang="ts">
import {onMounted} from 'vue'
import {useRouter} from 'vue-router'
import {account} from '~/utils/appwrite'

import {useAuthStore, useIsLoadingStore, isGuestSession} from '~~/store/auth.store'
import { useTheme } from '~/composables/useTheme'

const router = useRouter()
const isLoadingStore = useIsLoadingStore()
const authStore = useAuthStore()
const { initTheme } = useTheme()

onMounted(async () => {
  // Initialize theme
  initTheme()

  // Guest/demo mode: skip Appwrite entirely
  if (isGuestSession()) {
    authStore.setGuest()
    isLoadingStore.set(false)
    return
  }

  try {
    const user = await account.get()
    if (user) {
      authStore.set(user)
    }
  } catch {
    router.push('/login')
  } finally {
    isLoadingStore.set(false)
  }
})
</script>

<template>
  <transition name="fade-loader">
    <LayoutLoader v-if="isLoadingStore.isLoading" class="loader-fixed"/>
  </transition>

  <div v-show="!isLoadingStore.isLoading" :class="{ layout: authStore.isAuth }">
    <LayoutSidebar v-if="authStore.isAuth" class="desktop-sidebar"/>

    <main class="layout__main" :class="{ 'layout__main--mobile': authStore.isAuth }">
      <slot/>
    </main>

    <LayoutMobileBottomNav v-if="authStore.isAuth" class="mobile-bottom-nav"/>
  </div>
</template>

<style scoped lang="sass">
.layout
  display: flex
  min-height: 100vh
  width: 100vw
  overflow-x: hidden

.layout__main
  padding: var(--spacing-4)
  width: 100%
  min-height: 100vh
  transition: margin-left var(--transition-normal) ease

  &--mobile
    padding-bottom: 80px

.desktop-sidebar
  @media (max-width: 768px)
    display: none

.mobile-bottom-nav
  @media (min-width: 769px)
    display: none

.loader-fixed
  position: fixed
  inset: 0
  background-color: var(--color-bg)
  display: flex
  align-items: center
  justify-content: center
  z-index: var(--z-index-modal)

.fade-loader-enter-active,
.fade-loader-leave-active
  transition: opacity 0.3s ease

.fade-loader-enter-from,
.fade-loader-leave-to
  opacity: 0

@media (max-width: 768px)
  .layout
    flex-direction: column

  .layout__main
    margin-left: 0
    padding: var(--spacing-3)
    padding-bottom: 80px
</style>