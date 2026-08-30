const CANONICAL_ORIGIN = 'https://erp-mt.ru'
const PRODUCTION_HOSTS = new Set(['erp-mt.ru', 'www.erp-mt.ru'])

export default defineNuxtPlugin(() => {
    const {location} = window
    const currentOrigin = `${location.protocol}//${location.host}`

    // Staging uses its own host and must retain its isolated runtime configuration.
    if (!PRODUCTION_HOSTS.has(location.hostname)) return

    if (currentOrigin === CANONICAL_ORIGIN) return

    location.replace(`${CANONICAL_ORIGIN}${location.pathname}${location.search}${location.hash}`)
})
