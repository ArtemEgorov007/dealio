import {scrollEdgeFadeMask, updateScrollEdgeFlags} from '~/utils/scroll-edge-fade'

/**
 * Soft side fade for horizontal overflow (same approach as ErpTabBar).
 * Bind `el` to the scroll container and `:style="maskStyle"`.
 */
export function useScrollEdgeFade(options?: {
  fadeSize?: string
  threshold?: number
}) {
  const fadeSize = options?.fadeSize ?? '14px'
  const threshold = options?.threshold ?? 4

  const el = ref<HTMLElement | null>(null)
  const canScrollLeft = ref(false)
  const canScrollRight = ref(false)
  let resizeObserver: ResizeObserver | null = null

  const updateScrollState = () => {
    const node = el.value
    if (!node) {
      canScrollLeft.value = false
      canScrollRight.value = false
      return
    }
    const flags = updateScrollEdgeFlags(node, threshold)
    canScrollLeft.value = flags.canScrollLeft
    canScrollRight.value = flags.canScrollRight
  }

  const maskStyle = computed(() =>
    scrollEdgeFadeMask(canScrollLeft.value, canScrollRight.value, fadeSize),
  )

  onMounted(() => {
    updateScrollState()
    el.value?.addEventListener('scroll', updateScrollState, {passive: true})
    window.addEventListener('resize', updateScrollState)
    if (el.value && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => updateScrollState())
      resizeObserver.observe(el.value)
    }
  })

  onBeforeUnmount(() => {
    el.value?.removeEventListener('scroll', updateScrollState)
    window.removeEventListener('resize', updateScrollState)
    resizeObserver?.disconnect()
    resizeObserver = null
  })

  return {
    el,
    maskStyle,
    updateScrollState,
    canScrollLeft,
    canScrollRight,
  }
}
