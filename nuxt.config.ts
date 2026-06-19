export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',

    ssr: false,

    runtimeConfig: {
        public: {
            crmSpreadsheetId: process.env.NUXT_PUBLIC_CRM_SPREADSHEET_ID || '1HDj9ng5OdbgohhzdeP9LGVA-Fs_WI93m5IDWDdTXR-U',
            crmIssueSheetGid: process.env.NUXT_PUBLIC_CRM_ISSUE_SHEET_GID || '1376055067',
            crmSheetsApiKey: process.env.NUXT_PUBLIC_CRM_SHEETS_API_KEY || '',
            crmGasUrl: process.env.NUXT_PUBLIC_CRM_GAS_URL || '',
        },
    },

    app: {
        baseURL: process.env.NUXT_APP_BASE_URL || '/',
        head: {
            htmlAttrs: {lang: 'ru'},
            title: 'CRM — выдача бирок',
            link: [{rel: 'icon', type: 'image/svg+xml', href: 'logo.svg'}],
            meta: [
                {name: 'description', content: 'CRM — регистрация, выбор цеха и выдача бирок'},
                {name: 'theme-color', content: '#000000'},
                {name: 'color-scheme', content: 'dark'},
            ],
        },
    },

    devtools: {
        enabled: false
    },

    modules: [
        '@nuxt/icon',
        '@pinia/nuxt',
        '@nuxt/ui',
        '@vueuse/nuxt',

        [
            '@vee-validate/nuxt',
            {
                autoImports: true,
                componentNames: {
                    Form: 'VeeForm',
                    Field: 'VeeField',
                    FieldArray: 'VeeFieldArray',
                    ErrorMessage: 'VeeErrorMessage'
                }
            }
        ],

        [
            '@nuxtjs/google-fonts',
            {
                families: {
                    Inter: [400, 500, 600, 700],
                    'Roboto Mono': [500, 600]
                },
                display: 'swap',
                preload: true,
                subsets: ['latin', 'cyrillic']
            }
        ]
    ],

    css: [
        '@/assets/css/normalize.css',
        '@/assets/css/variables.css',
        '@/assets/css/kanban-effects.css',
        '@/assets/css/toast-overrides.css',
    ],

    pinia: {
        storesDirs: ['./store/**']
    },

    routeRules: {
        '/products': {redirect: '/ideas'},
        '/orders': {redirect: '/tasks'},
        '/customers': {redirect: '/wishlist'},
        '/customers/**': {redirect: '/wishlist'},
        '/payments': {redirect: '/archive'},
        '/kanban': {redirect: '/board'},
        '/feedback': {redirect: '/help'},
    }
})
