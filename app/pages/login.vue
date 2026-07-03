<script setup lang="ts">
import {v4 as uuid} from 'uuid'
import {useQueryClient} from '@tanstack/vue-query'
import {nextTick} from 'vue'
import {account} from '@/utils/appwrite'
import {mapAppwriteUser} from '@/utils/appwrite-user'
import {clearGuestSession, useAuthStore, useIsLoadingStore} from '~~/store/auth.store'
import {useRouter} from 'vue-router'
import {clearCardsCache} from '~/utils/cards-cache'
import {map_auth_error} from '~/utils/auth-errors'

useSeoMeta({title: 'Вход | Dealio'})

const isLoginMode = ref(true)
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const name = ref('')

const errors = ref<Record<string, string>>({})
const isSubmitting = ref(false)

const router = useRouter()
const isLoadingStore = useIsLoadingStore()
const authStore = useAuthStore()
const queryClient = useQueryClient()

onMounted(async () => {
  if (authStore.isAuth) {
    await router.replace('/board')
    return
  }

  try {
    const user = await account.get()
    clearGuestSession()
    authStore.set(mapAppwriteUser(user))
    clearCardsCache(queryClient)
    await router.replace('/board')
  } catch {
    // нет активной сессии
  }
})

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

const validatePassword = (password: string): boolean => {
  return password.length >= 6
}

const validateForm = (): boolean => {
  errors.value = {}

  if (!email.value) {
    errors.value.email = 'Email обязателен'
  } else if (!validateEmail(email.value)) {
    errors.value.email = 'Введите корректный email'
  }

  if (!password.value) {
    errors.value.password = 'Пароль обязателен'
  } else if (!validatePassword(password.value)) {
    errors.value.password = 'Минимум 6 символов'
  }

  if (!isLoginMode.value) {
    if (!name.value) {
      errors.value.name = 'Имя обязательно'
    } else if (name.value.length < 2) {
      errors.value.name = 'Минимум 2 символа'
    }

    if (!confirmPassword.value) {
      errors.value.confirmPassword = 'Подтвердите пароль'
    } else if (password.value !== confirmPassword.value) {
      errors.value.confirmPassword = 'Пароли не совпадают'
    }
  }

  return Object.keys(errors.value).length === 0
}

const clearError = (field: string) => {
  if (errors.value[field]) {
    delete errors.value[field]
  }
}

const toggleMode = () => {
  isLoginMode.value = !isLoginMode.value
  errors.value = {}
  email.value = ''
  password.value = ''
  confirmPassword.value = ''
  name.value = ''
}

const login = async () => {
  if (!validateForm()) return

  try {
    isSubmitting.value = true
    isLoadingStore.set(true)

    await account.createEmailPasswordSession(email.value, password.value)
    const response = await account.get()

    clearGuestSession()
    authStore.set(mapAppwriteUser(response))
    clearCardsCache(queryClient)
    await router.push('/board')
  } catch (error: unknown) {
    errors.value.general = map_auth_error(error, 'Не удалось войти. Проверьте email и пароль.')
  } finally {
    isSubmitting.value = false
    isLoadingStore.set(false)
  }
}

const register = async () => {
  if (!validateForm()) return

  try {
    isSubmitting.value = true
    isLoadingStore.set(true)

    await account.create(uuid(), email.value, password.value, name.value)

    await login()
  } catch (error: unknown) {
    errors.value.general = map_auth_error(error, 'Не удалось создать аккаунт. Возможно, email уже занят.')
  } finally {
    isSubmitting.value = false
    isLoadingStore.set(false)
  }
}

const handleSubmit = () => {
  if (isLoginMode.value) {
    login()
  } else {
    register()
  }
}

const loginAsGuest = async () => {
  authStore.setGuest()
  clearCardsCache(queryClient)
  isLoadingStore.set(false)
  await nextTick()
  // «/» принадлежит CRM-потоку (crm-flow.global уводит на /register) —
  // гостя ведём сразу на доску.
  await router.replace('/board')
}
</script>

<template>
  <section class="login">
    <div class="login__bg">
      <div class="login__bg-mesh"></div>
    </div>

    <div class="login__container">
      <div class="login__logo">
        <div class="login__logo-mark">D</div>
        <span class="login__logo-text">Dealio</span>
      </div>

      <header class="login__header">
        <h1 class="login__title">
          {{ isLoginMode ? 'Добро пожаловать' : 'Создать аккаунт' }}
        </h1>
        <p class="login__subtitle">
          {{
            isLoginMode
                ? 'Трекер идей, задач и желаний'
                : 'Создайте аккаунт и начните собирать идеи'
          }}
        </p>
      </header>

      <div v-if="errors.general" class="login__error" role="alert">
        <Icon name="heroicons:exclamation-circle" size="16"/>
        <span>{{ errors.general }}</span>
      </div>

      <form class="login__form" @submit.prevent="handleSubmit" novalidate>
        <div v-if="!isLoginMode" class="form-group">
          <UiInput
              v-model="name"
              id="register-name"
              label="Полное имя"
              placeholder="Ваше имя"
              type="text"
              autocomplete="name"
              :error="errors.name"
              @input="clearError('name')"
              required
          />
        </div>

        <div class="form-group">
          <UiInput
              v-model="email"
              id="login-email"
              label="Email"
              placeholder="you@example.com"
              type="email"
              autocomplete="email"
              :error="errors.email"
              @input="clearError('email')"
              required
          />
        </div>

        <div class="form-group">
          <UiInput
              v-model="password"
              id="login-password"
              label="Пароль"
              placeholder="Минимум 6 символов"
              type="password"
              autocomplete="isLoginMode ? 'current-password' : 'new-password'"
              show-password-toggle
              :error="errors.password"
              :hint="!errors.password && !isLoginMode ? 'Не короче 6 символов' : undefined"
              @input="clearError('password')"
              required
          />
        </div>

        <div v-if="!isLoginMode" class="form-group">
          <UiInput
              v-model="confirmPassword"
              id="register-confirm-password"
              label="Подтвердите пароль"
              placeholder="Повторите пароль"
              type="password"
              autocomplete="new-password"
              show-password-toggle
              :error="errors.confirmPassword"
              @input="clearError('confirmPassword')"
              required
          />
        </div>

        <UiButton
            type="submit"
            variant="primary"
            size="lg"
            block
            :disabled="isSubmitting"
            :loading="isSubmitting"
        >
          {{
            isSubmitting
                ? (isLoginMode ? 'Входим...' : 'Создаём...')
                : (isLoginMode ? 'Войти' : 'Создать аккаунт')
          }}
        </UiButton>
      </form>

      <div class="login__demo">
        <div class="login__divider">
          <span class="login__divider-text">или</span>
        </div>
        <button class="login__demo-btn" @click="loginAsGuest">
          <span class="demo-btn__icon">
            <Icon name="heroicons:eye" size="16"/>
          </span>
          <span class="demo-btn__text">
            <span class="demo-btn__label">Демо-режим</span>
            <span class="demo-btn__sub">Трекер идей и задач без регистрации</span>
          </span>
          <Icon name="heroicons:arrow-right" size="14" class="demo-btn__arrow"/>
        </button>
      </div>

      <footer class="login__footer">
        <button v-if="isLoginMode" class="login__toggle-link" @click="toggleMode">
          Нет аккаунта? <span>Зарегистрироваться</span>
        </button>
        <button v-else class="login__toggle-link" @click="toggleMode">
          Уже есть аккаунт? <span>Войти</span>
        </button>
      </footer>
    </div>
  </section>
</template>

<style scoped lang="sass">
.login
  display: flex
  align-items: center
  justify-content: center
  min-height: 100vh
  padding: var(--spacing-6)
  position: relative
  overflow: hidden
  background-color: var(--color-bg)

.login__bg
  position: fixed
  inset: 0
  z-index: 0
  pointer-events: none

.login__bg-mesh
  position: absolute
  inset: 0
  background: none

.login__container
  position: relative
  z-index: 1
  width: 100%
  max-width: 400px
  background-color: var(--color-card-bg)
  border-radius: var(--radius-2xl)
  padding: var(--spacing-8)
  box-shadow: var(--shadow-xl)
  border: var(--border-width) solid var(--color-card-border)
  display: flex
  flex-direction: column
  gap: var(--spacing-6)

.login__logo
  display: flex
  align-items: center
  gap: var(--spacing-3)

.login__logo-mark
  width: 36px
  height: 36px
  background: var(--color-primary)
  border-radius: var(--radius-md)
  display: flex
  align-items: center
  justify-content: center
  color: var(--color-text-inverse)
  font-size: 18px
  font-weight: 800
  line-height: 1

.login__logo-text
  font-size: var(--font-size-xl)
  font-weight: 800
  color: var(--color-text)
  letter-spacing: -0.4px

.login__header
  padding-bottom: var(--spacing-2)
  border-bottom: var(--border-width) solid var(--color-border)

.login__title
  font-size: var(--font-size-2xl)
  font-weight: 800
  color: var(--color-text)
  letter-spacing: -0.5px
  margin-bottom: 4px

.login__subtitle
  font-size: var(--font-size-sm)
  color: var(--color-text-muted)
  font-weight: 500

.login__error
  display: flex
  align-items: center
  gap: var(--spacing-2)
  padding: var(--spacing-3) var(--spacing-4)
  background-color: var(--color-error-bg)
  color: var(--color-error-text)
  border: 1px solid var(--color-error-border)
  border-radius: var(--radius-md)
  font-size: var(--font-size-sm)
  font-weight: 500

.login__form
  display: flex
  flex-direction: column
  gap: 0

  :deep(.ui-input:last-of-type)
    margin-bottom: var(--spacing-5)

.form-group
  display: flex
  flex-direction: column

.login__demo
  display: flex
  flex-direction: column
  gap: var(--spacing-3)

.login__divider
  position: relative
  text-align: center

  &::before
    content: ''
    position: absolute
    top: 50%
    left: 0
    right: 0
    height: 1px
    background-color: var(--color-border)

.login__divider-text
  position: relative
  display: inline-block
  background-color: var(--color-card-bg)
  padding: 0 var(--spacing-3)
  font-size: var(--font-size-xs)
  color: var(--color-text-muted)
  font-weight: 600
  text-transform: uppercase
  letter-spacing: 0.5px

.login__demo-btn
  display: flex
  align-items: center
  gap: var(--spacing-3)
  width: 100%
  padding: var(--spacing-3) var(--spacing-4)
  border: var(--border-width) solid var(--color-border)
  border-radius: var(--radius-lg)
  background: var(--color-bg-secondary)
  cursor: pointer
  transition: all var(--transition-normal) ease
  text-align: left

  &:hover
    border-color: var(--color-primary)
    background-color: var(--color-primary-light)

    .demo-btn__label
      color: var(--color-primary)

    .demo-btn__arrow
      color: var(--color-primary)
      transform: translateX(2px)

  &:focus-visible
    outline: 2px solid var(--color-primary)
    outline-offset: 2px

.demo-btn__icon
  width: 36px
  height: 36px
  background-color: var(--color-primary-muted)
  border-radius: var(--radius-md)
  display: flex
  align-items: center
  justify-content: center
  color: var(--color-primary)
  flex-shrink: 0

.demo-btn__text
  flex: 1
  display: flex
  flex-direction: column
  gap: 2px

.demo-btn__label
  font-size: var(--font-size-sm)
  font-weight: 700
  color: var(--color-text)
  transition: color var(--transition-fast) ease

.demo-btn__sub
  font-size: var(--font-size-xs)
  color: var(--color-text-muted)
  font-weight: 500

.demo-btn__arrow
  color: var(--color-text-muted)
  transition: all var(--transition-normal) ease
  flex-shrink: 0

.login__footer
  text-align: center
  padding-top: var(--spacing-2)
  border-top: var(--border-width) solid var(--color-border)

.login__toggle-link
  background: none
  border: none
  font-size: var(--font-size-sm)
  color: var(--color-text-muted)
  cursor: pointer
  font-family: inherit
  font-weight: 500
  transition: color var(--transition-fast) ease

  &:hover
    color: var(--color-text)

  span
    color: var(--color-primary)
    font-weight: 700

    &:hover
      text-decoration: underline

@media (max-width: 480px)
  .login
    padding: var(--spacing-4)
    align-items: flex-end

  .login__container
    max-width: 100%
    border-radius: var(--radius-xl) var(--radius-xl) 0 0
    padding: var(--spacing-6)
</style>
