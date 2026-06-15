<script setup lang="ts">
import {MENU_DATA} from "~/components/layout/menu.data"

interface Props {
  isCollapsed?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isCollapsed: false
})
</script>

<template>
  <div class="menu">
    <NuxtLink
        class="menu-item"
        :class="{ 'menu-item--collapsed': isCollapsed }"
        v-for="item in MENU_DATA"
        :key="item.name"
        :to="item.url"
        active-class="menu-item--active"
    >
      <span class="menu-item__icon-wrap">
        <Icon :name="item.icon" class="menu-item__icon"/>
      </span>
      <span v-if="!isCollapsed" class="menu-item__text">{{ item.name }}</span>
    </NuxtLink>
  </div>
</template>

<style scoped lang="sass">
.menu
  width: 100%
  padding: 0 var(--spacing-3)
  display: flex
  flex-direction: column
  gap: 2px

.menu-item
  display: flex
  align-items: center
  gap: var(--spacing-3)
  padding: var(--spacing-2) var(--spacing-3)
  color: var(--color-text-tertiary)
  text-decoration: none
  border-radius: var(--radius-md)
  transition: all var(--transition-normal) var(--transition-ease)
  font-weight: 500
  font-size: var(--font-size-sm)
  white-space: nowrap
  overflow: hidden
  position: relative

  &::before
    content: ''
    position: absolute
    left: 0
    top: 50%
    transform: translateY(-50%)
    width: 2.5px
    height: 0
    background-color: var(--color-primary)
    border-radius: 0 2px 2px 0
    transition: height var(--transition-normal) var(--transition-ease)

  &:hover
    background-color: var(--color-bg-secondary)
    color: var(--color-text)

  &--active
    background-color: var(--color-primary-light)
    color: var(--color-primary)
    font-weight: 600

    &::before
      height: 60%

    .menu-item__icon-wrap
      color: var(--color-primary)

  &--collapsed
    justify-content: center
    padding: var(--spacing-2)

    &::before
      display: none

    &.menu-item--active
      .menu-item__icon-wrap
        background-color: var(--color-primary-muted)
        border-radius: var(--radius-sm)

  &__icon-wrap
    display: flex
    align-items: center
    justify-content: center
    width: 20px
    height: 20px
    flex-shrink: 0
    transition: color var(--transition-normal) ease

  &__text
    white-space: nowrap
    overflow: hidden
    text-overflow: ellipsis

@media (max-width: 768px)
  .menu-item
    justify-content: center
    padding: var(--spacing-3)

    &__text
      display: none
</style>
