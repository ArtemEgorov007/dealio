const CANONICAL_ORIGIN = 'https://erp-mt.ru'

export default defineNuxtPlugin(() => {
    const {location} = window
    const currentOrigin = `${location.protocol}//${location.host}`

    if (currentOrigin === CANONICAL_ORIGIN) return

    location.replace(`${CANONICAL_ORIGIN}${location.pathname}${location.search}${location.hash}`)
})
