export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',

    ssr: false,

    app: {
        baseURL: process.env.NUXT_APP_BASE_URL || '/',
        head: {
            htmlAttrs: {lang: 'ru'},
            title: 'Dealio — трекер идей, задач и wishlist',
            link: [{rel: 'icon', type: 'image/svg+xml', href: 'logo.svg'}],
            meta: [
                {name: 'description', content: 'Dealio — kanban-трекер идей, задач и wishlist'},
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
        '/kanban': {redirect: '/'},
        '/feedback': {redirect: '/help'},
    }
})
