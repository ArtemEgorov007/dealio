<script setup lang="ts">
import {v4 as uuid} from 'uuid'
import {account} from '@/utils/appwrite'
import {useAuthStore, useIsLoadingStore} from '~~/store/auth.store'
import {useRouter} from 'vue-router'

useSeoMeta({title: 'Вход в систему | CRM'})

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
    errors.value.password = 'Пароль должен содержать минимум 6 символов'
  }

  if (!isLoginMode.value) {
    if (!name.value) {
      errors.value.name = 'Имя обязательно'
    } else if (name.value.length < 2) {
      errors.value.name = 'Имя должно содержать минимум 2 символа'
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

    if (response) {
      authStore.set({
        email: response.email,
        name: response.name,
        status: response.status
      })

      await router.push('/')
    }
  } catch (error: any) {
    console.error('Ошибка входа:', error)
    errors.value.general = error.message || 'Ошибка входа. Проверьте данные.'
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
  } catch (error: any) {
    console.error('Ошибка регистрации:', error)
    errors.value.general = error.message || 'Ошибка регистрации. Возможно, пользователь уже существует.'
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

const loginAsGuest = () => {
  authStore.setGuest()
  isLoadingStore.set(false)
  router.push('/')
}
</script>

<template>
  <section class="login">
    <div class="login__container">
      <header class="login__header">
        <h1 class="login__title">
          {{ isLoginMode ? 'Вход в систему' : 'Создание аккаунта' }}
        </h1>
        <p class="login__subtitle">
          {{
            isLoginMode
                ? 'Введите свои учетные данные для доступа к CRM'
                : 'Заполните форму для создания нового аккаунта'
          }}
        </p>
      </header>

      <div v-if="errors.general" class="login__error">
        <Icon name="radix-icons:exclamation-triangle" size="16"/>
        {{ errors.general }}
      </div>

      <form class="login__form" @submit.prevent="handleSubmit">
        <div v-if="!isLoginMode" class="form-group">
          <UiInput
              v-model="name"
              id="register-name"
              label="Полное имя"
              placeholder="Введите ваше имя"
              type="text"
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
              placeholder="Введите ваш email"
              type="email"
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
              placeholder="Введите пароль"
              type="password"
              :error="errors.password"
              @input="clearError('password')"
              required
          />
          <div v-if="!isLoginMode" class="password-hint">
            Минимум 6 символов
          </div>
        </div>

        <div v-if="!isLoginMode" class="form-group">
          <UiInput
              v-model="confirmPassword"
              id="register-confirm-password"
              label="Подтвердите пароль"
              placeholder="Повторите пароль"
              type="password"
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
                ? (isLoginMode ? 'Вход...' : 'Создание...')
                : (isLoginMode ? 'Войти' : 'Создать аккаунт')
          }}
        </UiButton>
      </form>

      <div class="login__demo">
        <div class="login__demo-divider">
          <span>или</span>
        </div>
        <button class="login__demo-btn" @click="loginAsGuest">
          <Icon name="radix-icons:eye-open" size="18"/>
          Демо-режим — войти без регистрации
        </button>
        <p class="login__demo-hint">Интерактивная доска с мок-данными, без сохранения</p>
      </div>

      <footer class="login__footer">
        <div class="login__links">
          <button
              v-if="isLoginMode"
              class="login__link"
              @click="toggleMode"
          >
            Создать аккаунт
          </button>
          <button
              v-else
              class="login__link"
              @click="toggleMode"
          >
            Уже есть аккаунт? Войти
          </button>
        </div>

        <NuxtLink v-if="isLoginMode" to="/" class="login__link login__link--secondary">
          Забыли пароль?
        </NuxtLink>
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
  background: linear-gradient(135deg, var(--color-bg-alt) 0%, var(--color-primary-light) 100%)

.login__container
  width: 100%
  max-width: 480px
  background-color: var(--color-card-bg)
  border-radius: var(--radius-xl)
  padding: var(--spacing-8)
  box-shadow: var(--shadow-xl)
  border: var(--border-width) solid var(--color-card-border)
  display: flex
  flex-direction: column
  gap: var(--spacing-6)
  backdrop-filter: blur(10px)

.login__header
  text-align: center

.login__title
  font-size: var(--font-size-3xl)
  font-weight: var(--font-weight-bold)
  color: var(--color-text)
  margin-bottom: var(--spacing-2)

.login__subtitle
  font-size: var(--font-size-base)
  color: var(--color-text-secondary)
  line-height: var(--line-height-normal)

.login__error
  display: flex
  align-items: center
  gap: var(--spacing-2)
  padding: var(--spacing-3)
  background-color: var(--color-error-bg)
  color: var(--color-error-text)
  border: 1px solid var(--color-error-border)
  border-radius: var(--radius-md)
  font-size: var(--font-size-sm)
  margin-bottom: var(--spacing-4)

.login__form
  display: flex
  flex-direction: column
  gap: var(--spacing-4)

.form-group
  display: flex
  flex-direction: column
  gap: var(--spacing-1)

.password-hint
  font-size: var(--font-size-xs)
  color: var(--color-text-tertiary)
  margin-top: var(--spacing-1)

.login__demo
  display: flex
  flex-direction: column
  gap: var(--spacing-3)
  align-items: center

.login__demo-divider
  width: 100%
  display: flex
  align-items: center
  gap: var(--spacing-3)
  color: var(--color-text-tertiary)
  font-size: var(--font-size-sm)

  &::before,
  &::after
    content: ''
    flex: 1
    height: 1px
    background-color: var(--color-border)

.login__demo-btn
  width: 100%
  display: flex
  align-items: center
  justify-content: center
  gap: var(--spacing-2)
  padding: var(--spacing-3) var(--spacing-4)
  border: var(--border-width) dashed var(--color-border)
  border-radius: var(--radius-lg)
  background: transparent
  color: var(--color-text-secondary)
  font-size: var(--font-size-base)
  font-weight: var(--font-weight-medium)
  cursor: pointer
  transition: all var(--transition-normal) ease

  &:hover
    border-color: var(--color-primary)
    color: var(--color-primary)
    background-color: rgba(59, 130, 246, 0.05)

.login__demo-hint
  font-size: var(--font-size-xs)
  color: var(--color-text-tertiary)
  text-align: center
  margin: 0

.login__footer
  display: flex
  flex-direction: column
  gap: var(--spacing-4)
  padding-top: var(--spacing-4)
  border-top: var(--border-width) solid var(--color-border)

.login__links
  display: flex
  justify-content: center

.login__link
  background: none
  border: none
  color: var(--color-primary)
  font-weight: var(--font-weight-medium)
  font-size: var(--font-size-sm)
  cursor: pointer
  transition: color var(--transition-normal) ease
  text-decoration: none

  &:hover
    color: var(--color-primary-hover)
    text-decoration: underline

  &--secondary
    color: var(--color-text-secondary)
    font-size: var(--font-size-xs)

    &:hover
      color: var(--color-text)

@media (max-width: 768px)
  .login
    padding: var(--spacing-4)

  .login__container
    padding: var(--spacing-6)
    max-width: 100%

  .login__title
    font-size: var(--font-size-2xl)

  .login__footer
    gap: var(--spacing-3)
</style>
