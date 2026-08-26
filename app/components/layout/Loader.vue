<template>
  <div class="loader-wrapper">
    <div class="loader-container">
      <div class="loader-logo">
        <div class="loader-logo-mark">D</div>
        <span class="loader-logo-text">Dealio</span>
      </div>
      <div class="loader-spinner">
        <div class="spinner-track"/>
        <div class="spinner-thumb"/>
      </div>
      <p class="loader-text">Загружаем данные...</p>
    </div>
  </div>
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
  gap: var(--spacing-5)

.loader-logo
  display: flex
  align-items: center
  gap: var(--spacing-3)

.loader-logo-mark
  width: 44px
  height: 44px
  background: var(--color-primary)
  border-radius: var(--radius-lg)
  display: flex
  align-items: center
  justify-content: center
  color: var(--color-text-inverse)
  font-size: 22px
  font-weight: 800
  line-height: 1

.loader-logo-text
  font-size: var(--font-size-3xl)
  font-weight: 800
  color: var(--color-text)
  letter-spacing: -0.5px

.loader-spinner
  position: relative
  width: 36px
  height: 36px

.spinner-track
  position: absolute
  inset: 0
  border: 2.5px solid var(--color-border)
  border-radius: 50%

.spinner-thumb
  position: absolute
  inset: 0
  border: 2.5px solid transparent
  border-top-color: var(--color-primary)
  border-radius: 50%
  animation: spin 0.75s linear infinite

@keyframes spin
  to
    transform: rotate(360deg)

.loader-text
  color: var(--color-text-muted)
  font-size: var(--font-size-sm)
  font-weight: 600
</style>
