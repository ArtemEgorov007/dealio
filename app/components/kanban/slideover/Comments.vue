<script setup lang="ts">
import dayjs from 'dayjs'
import type {IDeal} from '~~/types/deals.types'
import {useComments} from './useComments'
import {useCreateComment} from './useCreateComment'

const {data, refetch, isLoading} = useComments()
const {commentRef, writeComment} = useCreateComment({refetch})

const card = data as unknown as IDeal
</script>

<template>
  <div class="comments">
    <div class="comments__header">
      <Icon name="heroicons:chat-bubble-left-ellipsis" size="16"/>
      <span class="comments__title">Комментарии</span>
    </div>

    <div class="comments__input-wrap">
      <input
          v-model="commentRef"
          class="comments__field"
          placeholder="Написать комментарий..."
          @keyup.enter="writeComment"
      />
      <button
          class="comments__submit"
          :disabled="!commentRef"
          @click="writeComment"
          aria-label="Отправить комментарий"
      >
        <Icon name="heroicons:paper-airplane" size="15"/>
      </button>
    </div>

    <div v-if="isLoading" class="comments__loading">
      <div v-for="i in 2" :key="i" class="comment-skeleton"></div>
    </div>

    <div v-else-if="card?.comments?.length" class="comments__list">
      <div
          v-for="comment in card.comments"
          :key="comment.$id"
          class="comment"
      >
        <div class="comment__avatar">
          <Icon name="heroicons:user-circle" size="22"/>
        </div>
        <div class="comment__bubble">
          <span class="comment__time">{{ dayjs(comment.$createdAt).format('HH:mm · D MMM') }}</span>
          <p class="comment__text">{{ comment.text }}</p>
        </div>
      </div>
    </div>

    <div v-else class="comments__empty">
      <Icon name="heroicons:chat-bubble-oval-left" size="24" class="comments__empty-icon"/>
      <span>Комментариев пока нет</span>
    </div>
  </div>
</template>

<style scoped lang="sass">
.comments
  display: flex
  flex-direction: column
  gap: var(--spacing-4)

.comments__header
  display: flex
  align-items: center
  gap: var(--spacing-2)
  color: var(--color-text-secondary)

.comments__title
  font-size: var(--font-size-sm)
  font-weight: 700
  color: var(--color-text-secondary)

.comments__input-wrap
  display: flex
  gap: var(--spacing-2)

.comments__field
  flex: 1
  padding: 9px var(--spacing-4)
  border: var(--border-width) solid var(--color-input-border)
  border-radius: var(--radius-lg)
  background-color: var(--color-bg-secondary)
  color: var(--color-input-text)
  font-family: inherit
  font-size: var(--font-size-sm)
  transition: border-color var(--transition-normal) ease, box-shadow var(--transition-normal) ease

  &:focus
    outline: none
    border-color: var(--color-input-border-focus)
    box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.1)
    background-color: var(--color-input-bg)

  &::placeholder
    color: var(--color-input-placeholder)

.comments__submit
  width: 38px
  height: 38px
  display: flex
  align-items: center
  justify-content: center
  flex-shrink: 0
  border: none
  border-radius: var(--radius-md)
  background-color: var(--color-primary)
  color: white
  cursor: pointer
  transition: all var(--transition-fast) ease

  &:hover:not(:disabled)
    background-color: var(--color-primary-hover)
    transform: translateY(-1px)

  &:disabled
    background-color: var(--color-button-disabled-bg)
    color: var(--color-button-disabled-text)
    cursor: not-allowed

.comments__loading
  display: flex
  flex-direction: column
  gap: var(--spacing-3)

.comment-skeleton
  height: 64px
  border-radius: var(--radius-md)
  background: linear-gradient(90deg, var(--color-bg-secondary) 25%, var(--color-bg-tertiary) 50%, var(--color-bg-secondary) 75%)
  background-size: 200% 100%
  animation: shimmer 1.5s ease infinite

@keyframes shimmer
  0%
    background-position: 200% 0
  100%
    background-position: -200% 0

.comments__list
  display: flex
  flex-direction: column
  gap: var(--spacing-3)

.comment
  display: flex
  align-items: flex-start
  gap: var(--spacing-3)

.comment__avatar
  color: var(--color-text-muted)
  flex-shrink: 0
  margin-top: 2px

.comment__bubble
  flex: 1
  background-color: var(--color-bg-secondary)
  border: var(--border-width) solid var(--color-border)
  border-radius: var(--radius-lg)
  padding: var(--spacing-3) var(--spacing-4)

.comment__time
  font-size: 11px
  color: var(--color-text-muted)
  font-weight: 600
  display: block
  margin-bottom: 4px

.comment__text
  font-size: var(--font-size-sm)
  color: var(--color-text)
  line-height: var(--line-height-normal)

.comments__empty
  display: flex
  flex-direction: column
  align-items: center
  gap: var(--spacing-2)
  padding: var(--spacing-8) var(--spacing-4)
  color: var(--color-text-muted)
  font-size: var(--font-size-sm)
  font-weight: 500

.comments__empty-icon
  opacity: 0.35
</style>
