<script setup lang="ts">
import {onMounted, onBeforeUnmount} from 'vue'
import {useRouter} from 'vue-router'
import {useQueryClient} from '@tanstack/vue-query'
import {account} from '~/utils/appwrite'
import {mapAppwriteUser} from '~/utils/appwrite-user'

import {useAuthStore, useIsLoadingStore, isGuestSession} from '~~/store/auth.store'
import {useBoardStore} from '~~/store/board.store'
import {CARDS_QUERY_KEY, CARDS_STATS_QUERY_KEY} from '~/components/kanban/kanban.types'
import { useTheme } from '~/composables/useTheme'

const PRUNE_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6 часов

const router = useRouter()
const route = useRoute()
const isLoadingStore = useIsLoadingStore()
const authStore = useAuthStore()
const boardStore = useBoardStore()
const queryClient = useQueryClient()
const { initTheme } = useTheme()

let pruneTimer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  initTheme()

  if (route.path === '/login') {
    isLoadingStore.set(false)
    return
  }

  if (isGuestSession()) {
    authStore.setGuest()
    boardStore.init()
    isLoadingStore.set(false)

    // Периодическая очистка истёкших архивных карточек (только client, один интервал на сессию)
    if (import.meta.client && !pruneTimer) {
      pruneTimer = setInterval(() => {
        const before = boardStore.cards.length
        boardStore.pruneExpired()
        const after = boardStore.cards.length
        if (before !== after) {
          queryClient.invalidateQueries({queryKey: [CARDS_QUERY_KEY]})
          queryClient.invalidateQueries({queryKey: [CARDS_STATS_QUERY_KEY]})
        }
      }, PRUNE_INTERVAL_MS)
    }

    return
  }

  try {
    const user = await account.get()
    authStore.set(mapAppwriteUser(user))
  } catch {
    await router.replace('/login')
  } finally {
    isLoadingStore.set(false)
  }
})

onBeforeUnmount(() => {
  if (pruneTimer !== null) {
    clearInterval(pruneTimer)
    pruneTimer = null
  }
})
</script>

<template>
  <transition name="fade-loader">
    <LayoutLoader v-if="isLoadingStore.isLoading" class="loader-fixed"/>
  </transition>

  <div v-show="!isLoadingStore.isLoading" :class="{ layout: authStore.isAuth && route.path !== '/login' }">
    <LayoutSidebar v-if="authStore.isAuth && route.path !== '/login'" class="desktop-sidebar"/>

    <main class="layout__main" :class="{ 'layout__main--auth': authStore.isAuth && route.path !== '/login' }">
      <slot/>
    </main>

    <LayoutMobileBottomNav v-if="authStore.isAuth && route.path !== '/login'" class="mobile-bottom-nav"/>
  </div>
</template>

<style scoped lang="sass">
.layout
  display: flex
  min-height: 100vh
  width: 100vw
  overflow-x: hidden
  background-color: var(--color-bg)

.layout__main
  flex: 1
  min-height: 100vh
  min-width: 0
  overflow-x: hidden
  background-color: var(--color-bg)

  &--auth
    padding-bottom: 0

    @media (max-width: 768px)
      padding-bottom: 72px

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
</style>
