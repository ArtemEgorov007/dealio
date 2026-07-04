<script setup lang="ts">
import {onMounted} from 'vue'
import {useRouter} from 'vue-router'
import {useQueryClient} from '@tanstack/vue-query'
import {useIntervalFn} from '@vueuse/core'
import {account} from '~/utils/appwrite'
import {mapAppwriteUser} from '~/utils/appwrite-user'

import {useAuthStore, useIsLoadingStore, isGuestSession} from '~~/store/auth.store'
import {useBoardStore} from '~~/store/board.store'
import {useAuthArchiveStore} from '~~/store/auth-archive.store'
import {CARDS_QUERY_KEY, CARDS_STATS_QUERY_KEY} from '~/components/kanban/kanban.types'

const PRUNE_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6 часов

const router = useRouter()
const route = useRoute()
const isLoadingStore = useIsLoadingStore()
const authStore = useAuthStore()
const boardStore = useBoardStore()
const authArchiveStore = useAuthArchiveStore()
const queryClient = useQueryClient()

const pruneGuestArchive = () => {
  if (!authStore.isGuest) return
  const before = boardStore.cards.length
  boardStore.pruneExpired()
  if (before !== boardStore.cards.length) {
    queryClient.invalidateQueries({queryKey: [CARDS_QUERY_KEY]})
    queryClient.invalidateQueries({queryKey: [CARDS_STATS_QUERY_KEY]})
  }
}

const {resume} = useIntervalFn(pruneGuestArchive, PRUNE_INTERVAL_MS, {
  immediate: false,
})

  onMounted(async () => {
  const ERP_PATHS = ['/register', '/workshop', '/badges', '/receipt']

  if (ERP_PATHS.includes(route.path)) {
    isLoadingStore.set(false)
    return
  }

  if (route.path === '/login') {
    isLoadingStore.set(false)
    return
  }

  if (isGuestSession()) {
    authStore.setGuest()
    boardStore.init()
    isLoadingStore.set(false)

    if (import.meta.client) {
      resume()
    }

    return
  }

  try {
    const user = await account.get()
    authStore.set(mapAppwriteUser(user))
    if (import.meta.client && authStore.userId) {
      authArchiveStore.init(authStore.userId)
      authArchiveStore.pruneExpired()
    }
  } catch {
    await router.replace('/login')
  } finally {
    isLoadingStore.set(false)
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

    <KanbanSlideover v-if="authStore.isAuth && route.path !== '/login'"/>
  </div>
</template>

<style scoped lang="sass">
.layout
  display: flex
  height: 100vh
  width: 100%
  overflow: hidden
  background-color: var(--color-bg)

.layout__main
  flex: 1
  min-width: 0
  min-height: 0
  overflow-x: hidden
  background-color: var(--color-bg)

  &--auth
    display: flex
    flex-direction: column
    overflow-y: auto
    overscroll-behavior: contain
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
