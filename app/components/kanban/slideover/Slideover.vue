<script setup lang="ts">
import {useCardSlideStore} from '~~/store/card-slide.store'

const store = useCardSlideStore()

const isOpen = computed(() => store.isOpen)

const closePanel = () => {
  store.isOpen = false
}

const onEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && isOpen.value) {
    closePanel()
  }
}

watch(isOpen, (open) => {
  if (!import.meta.client) return
  document.body.classList.toggle('dealio-slideover-open', open)
  document.body.style.overflow = open ? 'hidden' : ''
  if (!open) {
    (document.activeElement as HTMLElement | null)?.blur()
  }
}, {immediate: true})

onMounted(() => {
  document.addEventListener('keydown', onEscape)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onEscape)
  if (import.meta.client) {
    document.body.classList.remove('dealio-slideover-open')
    document.body.style.overflow = ''
  }
})
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="slideover-root">
      <div
          class="slideover-backdrop"
          aria-hidden="true"
          @click="closePanel"
      />

      <aside
          class="slideover-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Редактирование элемента"
      >
        <header class="slideover-header">
          <span class="slideover-header__label">Редактирование</span>
          <button
              type="button"
              class="slideover-close"
              aria-label="Закрыть"
              @click="closePanel"
          >
            <Icon name="heroicons:x-mark" size="18"/>
          </button>
        </header>

        <div v-if="store.card" class="slideover-body">
          <KanbanSlideoverTop/>
          <KanbanSlideoverComments/>
        </div>
      </aside>
    </div>
  </Teleport>
</template>

<style scoped lang="sass">
.slideover-root
  position: fixed
  inset: 0
  z-index: var(--z-index-modal)
  pointer-events: auto

.slideover-backdrop
  position: absolute
  inset: 0
  background-color: var(--color-bg-overlay)
  animation: backdrop-in 0.2s ease both

.slideover-panel
  position: absolute
  top: 0
  right: 0
  width: min(420px, 100vw)
  height: 100%
  display: flex
  flex-direction: column
  background-color: var(--color-card-bg)
  border-left: var(--border-width) solid var(--color-border)
  box-shadow: var(--shadow-xl)
  will-change: transform
  animation: panel-in 0.24s cubic-bezier(0.32, 0.72, 0, 1) both

.slideover-header
  display: flex
  align-items: center
  justify-content: space-between
  padding: var(--spacing-5) var(--spacing-6)
  border-bottom: var(--border-width) solid var(--color-border)
  flex-shrink: 0

.slideover-header__label
  font-size: var(--font-size-sm)
  font-weight: 700
  color: var(--color-text)
  letter-spacing: -0.1px

.slideover-close
  width: 32px
  height: 32px
  display: flex
  align-items: center
  justify-content: center
  background: none
  border: var(--border-width) solid var(--color-border)
  border-radius: var(--radius-md)
  color: var(--color-text-muted)
  cursor: pointer
  transition: background-color var(--transition-fast) ease, color var(--transition-fast) ease, border-color var(--transition-fast) ease

  &:hover
    background-color: var(--color-bg-secondary)
    color: var(--color-text)
    border-color: var(--color-border-hover)

  &:focus-visible
    outline: 2px solid var(--color-primary)
    outline-offset: 2px

.slideover-body
  flex: 1
  overflow-y: auto
  overscroll-behavior: contain
  padding: var(--spacing-5) var(--spacing-6)
  display: flex
  flex-direction: column
  gap: var(--spacing-5)

@keyframes backdrop-in
  from
    opacity: 0
  to
    opacity: 1

@keyframes panel-in
  from
    transform: translateX(100%)
  to
    transform: translateX(0)

@media (max-width: 480px)
  .slideover-panel
    width: 100vw
</style>
