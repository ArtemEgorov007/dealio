<script setup lang="ts">
import {computed} from 'vue'
import {useDealSlideStore} from '~~/store/deal-slide.store'

const store = useDealSlideStore()

const isLocalOpen = computed({
  get: () => store.isOpen,
  set: (value: boolean) => {
    store.isOpen = value
  }
})
</script>

<template>
  <div class="slideover-wrapper" :class="{ 'slideover-wrapper--open': isLocalOpen }">
    <Transition name="slideover-overlay">
      <div
          v-if="isLocalOpen"
          class="slideover-backdrop"
          @click="isLocalOpen = false"
          aria-label="Закрыть панель"
      />
    </Transition>

    <Transition name="slideover">
      <div
          v-if="isLocalOpen"
          class="slideover-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Детали сделки"
          @click.stop
      >
        <div class="slideover-inner">
          <div class="slideover-header">
            <div class="slideover-header__title">
              <span class="slideover-header__label">Детали сделки</span>
            </div>
            <button
              class="slideover-close"
              @click="isLocalOpen = false"
              aria-label="Закрыть"
            >
              <Icon name="heroicons:x-mark" size="18"/>
            </button>
          </div>
          <div class="slideover-body">
            <KanbanSlideoverTop/>
            <KanbanSlideoverComments/>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style lang="sass" scoped>
.slideover-wrapper
  position: fixed
  top: 0
  left: 0
  width: 100%
  height: 100%
  z-index: var(--z-index-modal)
  pointer-events: none

  &--open
    pointer-events: auto

.slideover-backdrop
  position: fixed
  top: 0
  left: 0
  width: 100%
  height: 100%
  background-color: var(--color-bg-overlay)
  backdrop-filter: blur(2px)
  pointer-events: auto

.slideover-overlay-enter-active
  transition: opacity var(--transition-slow) ease

.slideover-overlay-leave-active
  transition: opacity var(--transition-normal) ease

.slideover-overlay-enter-from,
.slideover-overlay-leave-to
  opacity: 0

.slideover-panel
  position: fixed
  top: 0
  right: 0
  width: 420px
  max-width: 100vw
  height: 100%
  display: flex
  flex-direction: column
  pointer-events: auto
  z-index: calc(var(--z-index-modal) + 1)

  @media (max-width: 480px)
    width: 100vw

.slideover-enter-active
  transition: transform var(--transition-slow) cubic-bezier(0.32, 0.72, 0, 1)

.slideover-leave-active
  transition: transform var(--transition-normal) cubic-bezier(0.4, 0, 1, 1)

.slideover-enter-from
  transform: translateX(100%)

.slideover-enter-to
  transform: translateX(0)

.slideover-leave-from
  transform: translateX(0)

.slideover-leave-to
  transform: translateX(100%)

.slideover-inner
  display: flex
  flex-direction: column
  height: 100%
  background-color: var(--color-card-bg)
  border-left: var(--border-width) solid var(--color-border)
  box-shadow: var(--shadow-xl)

.slideover-header
  display: flex
  align-items: center
  justify-content: space-between
  padding: var(--spacing-5) var(--spacing-6)
  border-bottom: var(--border-width) solid var(--color-border)
  flex-shrink: 0
  background-color: var(--color-card-bg)

.slideover-header__title
  display: flex
  flex-direction: column
  gap: 2px

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
  transition: all var(--transition-fast) ease

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
  padding: var(--spacing-5) var(--spacing-6)
  display: flex
  flex-direction: column
  gap: var(--spacing-5)
</style>
