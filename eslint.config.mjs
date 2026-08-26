// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    rules: {
      // Vue 3 поддерживает несколько корневых узлов; Nuxt-компоненты уже
      // используют эту модель, поэтому правило Vue 2 здесь ложно срабатывает.
      'vue/no-multiple-template-root': 'off',
    },
  },
  {
    // Google Apps Script backends (scripts/*.js) — отдельный рантайм,
    // не Node/браузер: doGet/doPost вызывает сам GAS, а не наш код,
    // а SpreadsheetApp/LockService/... — его глобалы, не undef.
    files: ['scripts/**/*.js'],
    languageOptions: {
      globals: {
        SpreadsheetApp: 'readonly',
        PropertiesService: 'readonly',
        LockService: 'readonly',
        CacheService: 'readonly',
        ContentService: 'readonly',
        Utilities: 'readonly',
        Session: 'readonly',
        HtmlService: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'off',
    },
  },
)
