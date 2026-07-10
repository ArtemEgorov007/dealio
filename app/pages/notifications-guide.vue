<script setup lang="ts">
definePageMeta({layout: 'erp'})

useSeoMeta({title: 'Уведомления | ERP'})

type Platform = 'android' | 'ios'

interface Step {
  caption: string
}

const ANDROID_STEPS: Step[] = [
  {caption: 'Откройте ERP в Chrome и нажмите значок <b>⋮</b> справа от адресной строки'},
  {caption: 'В меню выберите <b>«Настройки» → «Настройки сайтов» → «Уведомления»</b>'},
  {caption: 'Включите переключатель <b>«Уведомления»</b> вверху экрана — готово'},
]

const IOS_STEPS: Step[] = [
  {caption: 'Откройте ERP в Safari и нажмите значок <b>«Поделиться»</b> снизу'},
  {caption: 'В открывшемся меню прокрутите вниз и выберите <b>«На экран «Домой»»</b>'},
  {caption: 'Готово — иконка ERP на главном экране. Уведомления придут туда, когда мы их включим'},
]

const platform = ref<Platform>('android')
const index = ref(0)

const steps = computed(() => platform.value === 'android' ? ANDROID_STEPS : IOS_STEPS)

const setPlatform = (value: Platform) => {
  platform.value = value
  index.value = 0
}

const go = (direction: number) => {
  index.value = Math.max(0, Math.min(steps.value.length - 1, index.value + direction))
}
</script>

<template>
  <ErpScreen
      title="Уведомления"
      subtitle="Подготовьте телефон заранее"
      icon="heroicons:bell"
  >
    <template #hero>
      <div class="platform-row">
        <button
            type="button"
            class="platform-opt"
            :class="{ 'platform-opt--active': platform === 'android' }"
            @click="setPlatform('android')"
        >
          <Icon name="mdi:android" size="15" class="platform-opt__icon"/> Android
        </button>
        <button
            type="button"
            class="platform-opt"
            :class="{ 'platform-opt--active': platform === 'ios' }"
            @click="setPlatform('ios')"
        >
          <Icon name="mdi:apple" size="15" class="platform-opt__icon"/> iPhone
        </button>
      </div>
    </template>

    <div class="slider">
      <button
          type="button"
          class="arrow-btn"
          :disabled="index === 0"
          aria-label="Предыдущий шаг"
          @click="go(-1)"
      >
        <Icon name="heroicons:chevron-left" size="16"/>
      </button>

      <div class="slide-viewport">
        <div class="slide-track" :style="{ transform: `translateX(-${index * 100}%)` }">
          <template v-if="platform === 'android'">
            <div class="slide">
              <div class="screen">
                <span class="step-badge">1</span>
                <div class="chrome-bar">
                  <span class="chrome-icon-btn"><Icon name="heroicons:lock-closed" size="11"/></span>
                  <span class="chrome-pill"><Icon name="heroicons:lock-closed" size="9"/> morflot-erp.ru</span>
                  <span class="chrome-icon-btn"><Icon name="heroicons:squares-2x2" size="14"/></span>
                  <span class="chrome-icon-btn">
                    <Icon name="heroicons:ellipsis-vertical" size="15"/>
                    <span class="tap-ring"/>
                  </span>
                </div>
                <div class="page-body">
                  <div class="bar"/>
                  <div class="bar"/>
                  <div class="bar"/>
                </div>
              </div>
            </div>

            <div class="slide">
              <div class="screen">
                <span class="step-badge">2</span>
                <div class="chrome-bar">
                  <span class="chrome-icon-btn"><Icon name="heroicons:lock-closed" size="11"/></span>
                  <span class="chrome-pill"><Icon name="heroicons:lock-closed" size="9"/> morflot-erp.ru</span>
                  <span class="chrome-icon-btn"><Icon name="heroicons:squares-2x2" size="14"/></span>
                  <span class="chrome-icon-btn"><Icon name="heroicons:ellipsis-vertical" size="15"/></span>
                </div>
                <div class="page-body">
                  <div class="bar"/>
                  <div class="bar"/>
                </div>
                <div class="menu-pop">
                  <div class="menu-pop__item"><Icon name="heroicons:bookmark" size="12"/> Закладки</div>
                  <div class="menu-pop__item"><Icon name="heroicons:clock" size="12"/> История</div>
                  <div class="menu-pop__item menu-pop__item--hl">
                    <Icon name="heroicons:cog-6-tooth" size="12"/> Настройки
                  </div>
                </div>
              </div>
            </div>

            <div class="slide">
              <div class="screen">
                <span class="step-badge">3</span>
                <div class="chrome-bar" style="gap: 8px">
                  <span class="chrome-icon-btn"><Icon name="heroicons:chevron-left" size="14"/></span>
                  <span style="font-size: 11px; font-weight: 700; color: var(--color-text)">Уведомления</span>
                </div>
                <div class="settings-list">
                  <div class="settings-row settings-row--hl">
                    <span style="display: flex; align-items: center; gap: 6px">
                      <Icon name="heroicons:bell" size="13"/> Уведомления
                    </span>
                    <span style="position: relative; display: inline-flex">
                      <span class="toggle toggle--on"/>
                      <span class="tap-ring tap-ring--pill"/>
                    </span>
                  </div>
                  <div class="settings-row">
                    <span>Использовать тихий режим</span>
                    <span class="toggle"/>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <template v-else>
            <div class="slide">
              <div class="screen">
                <span class="step-badge">1</span>
                <div class="chrome-bar">
                  <span class="chrome-pill"><Icon name="heroicons:lock-closed" size="9"/> morflot-erp.ru</span>
                </div>
                <div class="page-body">
                  <div class="bar"/>
                  <div class="bar"/>
                  <div class="bar"/>
                </div>
                <div class="safari-bar">
                  <span class="dim"><Icon name="heroicons:chevron-left" size="16"/></span>
                  <span class="dim"><Icon name="heroicons:chevron-right" size="16"/></span>
                  <span style="position: relative; display: inline-flex">
                    <Icon name="heroicons:arrow-up-on-square" size="17"/>
                    <span class="tap-ring"/>
                  </span>
                  <span class="dim"><Icon name="heroicons:bookmark" size="16"/></span>
                  <span class="dim"><Icon name="heroicons:squares-2x2" size="16"/></span>
                </div>
              </div>
            </div>

            <div class="slide">
              <div class="screen">
                <span class="step-badge">2</span>
                <div class="chrome-bar">
                  <span class="chrome-pill"><Icon name="heroicons:lock-closed" size="9"/> morflot-erp.ru</span>
                </div>
                <div class="page-body">
                  <div class="bar"/>
                </div>
                <div class="share-sheet">
                  <div class="share-apps">
                    <div class="share-app"><span class="share-app__icon"/>Диана</div>
                    <div class="share-app"><span class="share-app__icon"/>Игорь</div>
                    <div class="share-app"><span class="share-app__icon"/>Почта</div>
                  </div>
                  <div class="share-action">
                    <Icon name="heroicons:star" size="14"/> В избранное
                  </div>
                  <div class="share-action share-action--hl">
                    <Icon name="heroicons:home" size="14"/> На экран «Домой»
                  </div>
                </div>
              </div>
            </div>

            <div class="slide">
              <div class="screen">
                <span class="step-badge">3</span>
                <div class="chrome-bar">
                  <span class="chrome-pill" style="justify-content: center">15:04</span>
                </div>
                <div class="home-grid">
                  <div class="home-icon">
                    <span class="home-icon__box"/>
                    <span class="home-icon__label">Почта</span>
                  </div>
                  <div class="home-icon">
                    <span class="home-icon__box"/>
                    <span class="home-icon__label">Камера</span>
                  </div>
                  <div class="home-icon">
                    <span class="home-icon__box home-icon__box--erp"/>
                    <span class="home-icon__label home-icon__label--active">ERP</span>
                  </div>
                  <div class="home-icon">
                    <span class="home-icon__box"/>
                    <span class="home-icon__label">Заметки</span>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <button
          type="button"
          class="arrow-btn"
          :disabled="index === steps.length - 1"
          aria-label="Следующий шаг"
          @click="go(1)"
      >
        <Icon name="heroicons:chevron-right" size="16"/>
      </button>
    </div>

    <!-- eslint-disable-next-line vue/no-v-html -->
    <p class="caption" v-html="steps[index].caption"/>
    <div class="dots">
      <span
          v-for="(_, i) in steps"
          :key="i"
          class="dot"
          :class="{ 'dot--active': i === index }"
      />
    </div>

    <p class="note">
      Уведомления в ERP пока не отправляются — это подготовит телефон заранее,
      чтобы ничего не пришлось настраивать, когда мы их включим.
    </p>
  </ErpScreen>
</template>

<style scoped lang="sass">
.platform-row
  display: flex
  gap: 2px
  background: var(--color-bg)
  border-radius: 11px
  padding: 3px

.platform-opt
  display: flex
  align-items: start
  justify-content: flex-start
  gap: 6px
  flex: 1
  padding: 9px 0 9px 14px
  border: none
  border-radius: 9px
  background: transparent
  font-size: 13px
  font-weight: 600
  color: var(--color-text)
  cursor: pointer

  &--active
    background: var(--color-card-bg)
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12), 0 0.5px 1px rgba(0, 0, 0, 0.06)

// mdi:android/mdi:apple рисуют глиф в верхней части своего вьюбокса —
// геометрически по центру кнопки, но на глаз выглядит задранным над
// подписью без ручной подстройки вниз.
.platform-opt__icon
  transform: translateY(2px)

.slider
  display: flex
  align-items: center
  gap: 8px
  justify-content: center

  // Экран телефона растёт вместе с шириной колонки (aspect-ratio держит
  // пропорцию) — на широком десктопе это не влезает в высоту без скролла,
  // поэтому сверху ограничиваем ширину самого мокапа, а не всей страницы.
  @media (min-width: 900px)
    .slide-viewport
      max-width: 260px
      flex: 0 0 auto

.arrow-btn
  flex-shrink: 0
  width: 34px
  height: 34px
  border-radius: 50%
  border: none
  background: var(--color-bg)
  color: var(--color-primary)
  display: flex
  align-items: center
  justify-content: center
  cursor: pointer
  transition: transform 0.12s ease

  &:active:not(:disabled)
    transform: scale(0.9)

  &:disabled
    opacity: 0.35
    cursor: default

.slide-viewport
  flex: 1
  min-width: 0
  overflow: hidden
  border-radius: 16px

.slide-track
  display: flex
  transition: transform 0.32s cubic-bezier(0.22, 0.61, 0.36, 1)

.slide
  flex: 0 0 100%
  min-width: 0

.screen
  background: #F2F5F9
  border-radius: 14px
  aspect-ratio: 9 / 13
  position: relative
  overflow: hidden
  border: 1px solid rgba(28, 37, 48, 0.08)

.step-badge
  position: absolute
  top: 10px
  left: 10px
  z-index: 6
  background: var(--color-primary)
  color: #fff
  font-size: 10px
  font-weight: 800
  width: 20px
  height: 20px
  border-radius: 50%
  display: flex
  align-items: center
  justify-content: center

.chrome-bar
  display: flex
  align-items: center
  gap: 6px
  background: #fff
  padding: 8px
  border-bottom: 1px solid rgba(28, 37, 48, 0.08)
  position: relative
  z-index: 2

.chrome-pill
  flex: 1
  background: #EFF2F6
  border-radius: 999px
  padding: 6px 10px
  font-size: 10px
  color: var(--color-text-secondary)
  display: flex
  align-items: center
  gap: 5px
  white-space: nowrap
  overflow: hidden
  text-overflow: ellipsis

.chrome-icon-btn
  width: 22px
  height: 22px
  border-radius: 50%
  display: flex
  align-items: center
  justify-content: center
  color: #3C4650
  flex-shrink: 0
  position: relative

.page-body
  padding: 12px 10px

  .bar
    height: 8px
    border-radius: 4px
    background: #E4E9EF
    margin-bottom: 7px

    &:nth-child(1)
      width: 70%

    &:nth-child(2)
      width: 92%

    &:nth-child(3)
      width: 55%

.menu-pop
  position: absolute
  top: 36px
  right: 8px
  width: 68%
  background: #fff
  border-radius: 10px
  box-shadow: 0 8px 24px -8px rgba(0, 0, 0, 0.28)
  padding: 5px
  z-index: 5
  font-size: 11px
  color: var(--color-text)

.menu-pop__item
  padding: 7px 9px
  border-radius: 7px
  display: flex
  align-items: center
  gap: 7px

  &--hl
    background: var(--color-primary-light)
    color: var(--color-primary)
    font-weight: 700

.settings-list
  padding: 10px 0

.settings-row
  display: flex
  align-items: center
  justify-content: space-between
  padding: 10px 12px
  font-size: 11px
  color: var(--color-text)
  border-bottom: 1px solid rgba(28, 37, 48, 0.06)

  &--hl
    background: var(--color-primary-light)

.toggle
  width: 34px
  height: 19px
  border-radius: 999px
  background: #D8DEE6
  position: relative
  flex-shrink: 0

  &::after
    content: ''
    position: absolute
    top: 2px
    left: 2px
    width: 15px
    height: 15px
    border-radius: 50%
    background: #fff
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25)

  &--on
    background: var(--erp-ok)

    &::after
      left: 17px

.share-sheet
  position: absolute
  left: 0
  right: 0
  bottom: 0
  background: #fff
  border-radius: 16px 16px 0 0
  box-shadow: 0 -8px 24px -8px rgba(0, 0, 0, 0.25)
  padding: 10px 10px 12px
  z-index: 5

.share-apps
  display: flex
  gap: 10px
  padding: 4px 2px 10px
  overflow: hidden

.share-app
  display: flex
  flex-direction: column
  align-items: center
  gap: 4px
  font-size: 7px
  color: var(--color-text-secondary)
  flex-shrink: 0

.share-app__icon
  width: 30px
  height: 30px
  border-radius: 9px
  background: #E4E9EF

.share-action
  display: flex
  align-items: center
  gap: 8px
  padding: 8px 6px
  border-radius: 8px
  font-size: 11px
  color: var(--color-text)

  &--hl
    background: var(--color-primary-light)
    color: var(--color-primary)
    font-weight: 700

.safari-bar
  position: absolute
  left: 0
  right: 0
  bottom: 0
  display: flex
  align-items: center
  justify-content: space-around
  background: rgba(246, 248, 251, 0.96)
  backdrop-filter: blur(6px)
  padding: 9px 6px
  border-top: 1px solid rgba(28, 37, 48, 0.08)
  z-index: 2
  color: var(--color-primary)

  .dim
    color: #B8C0CA

.home-grid
  display: grid
  grid-template-columns: repeat(4, 1fr)
  gap: 12px
  padding: 16px 10px

.home-icon
  display: flex
  flex-direction: column
  align-items: center
  gap: 4px

.home-icon__box
  width: 34px
  height: 34px
  border-radius: 10px
  background: #E4E9EF
  position: relative

  &--erp
    background: var(--erp-grad-header)

.home-icon__label
  font-size: 6.5px
  color: var(--color-text-secondary)
  text-align: center

  &--active
    font-weight: 700
    color: var(--color-primary)

// Пульсирующее кольцо прямо вокруг нужной кнопки/тумблера — inset
// центрирует его на родителе (position: relative на самой иконке)
// автоматически, независимо от размера иконки, так что не нужно
// вручную подбирать top/left под каждую цель.
.tap-ring
  position: absolute
  inset: -5px
  border-radius: 50%
  border: 2px solid var(--erp-warn)
  pointer-events: none
  animation: tap-pulse 1.5s ease-out infinite

  &--pill
    border-radius: 999px

@keyframes tap-pulse
  0%
    transform: scale(0.75)
    opacity: 1

  75%
    transform: scale(1.35)
    opacity: 0

  100%
    opacity: 0

@media (prefers-reduced-motion: reduce)
  .tap-ring
    animation: none
    opacity: 0.9

.caption
  margin-top: 14px
  font-size: 13px
  line-height: 1.45
  color: var(--color-text)
  text-align: center
  min-height: 38px

  :deep(b)
    color: var(--color-primary)

.dots
  display: flex
  justify-content: center
  gap: 6px
  margin-top: 4px

.dot
  width: 6px
  height: 6px
  border-radius: 50%
  background: var(--color-border)
  transition: background 0.2s ease, transform 0.2s ease

  &--active
    background: var(--color-primary)
    transform: scale(1.3)

.note
  margin-top: 4px
  padding: 12px 14px
  border-radius: 12px
  background: var(--color-card-bg)
  box-shadow: var(--erp-shadow-card)
  font-size: 12px
  line-height: 1.5
  color: var(--color-text-secondary)
</style>
