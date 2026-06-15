<script setup lang="ts">
const { app } = useRuntimeConfig()
const baseURL = app.baseURL
</script>

<template>
  <transition name="fade-loader">
    <div class="loader-wrapper">
      <div class="loader-container">
        <img
            :src="`${baseURL}loader.svg`"
            alt="Загрузка..."
            class="loader-image"
            width="220"
        />
        <p class="loader-text">Загрузка данных...</p>
      </div>
    </div>
  </transition>
</template>

<style scoped lang="sass">
.loader-wrapper
  position: fixed
  inset: 0
  background-color: var(--color-bg)
  display: flex
  align-items: center
  justify-content: center
  z-index: var(--z-index-modal)
  min-height: 100vh

.loader-container
  display: flex
  flex-direction: column
  align-items: center
  justify-content: center

.loader-image
  display: block
  width: 220px
  height: auto
  margin-bottom: var(--spacing-4)

.loader-text
  color: var(--color-text-secondary)
  font-size: var(--font-size-base)
  font-weight: var(--font-weight-medium)

.fade-loader-enter-active,
.fade-loader-leave-active
  transition: opacity 0.3s ease

.fade-loader-enter-from,
.fade-loader-leave-to
  opacity: 0
</style>
