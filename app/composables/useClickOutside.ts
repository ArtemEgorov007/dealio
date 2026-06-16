import {onMounted, onBeforeUnmount, type Ref} from 'vue'

export function useClickOutside(
    target: Ref<HTMLElement | null>,
    handler: () => void,
) {
    const onPointerDown = (event: PointerEvent) => {
        const el = target.value
        if (!el || el.contains(event.target as Node)) return
        handler()
    }

    onMounted(() => document.addEventListener('pointerdown', onPointerDown, true))
    onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown, true))
}
