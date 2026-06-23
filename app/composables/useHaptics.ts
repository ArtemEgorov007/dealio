// Поддерживается в Android Chrome/Firefox, в Safari/iOS — нет.
export function useHaptics() {
    const vibrate = (pattern: number | number[]) => {
        navigator.vibrate?.(pattern)
    }

    return {vibrate}
}
