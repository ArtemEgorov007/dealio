const TOAST_DURATION_MS = 3500
const UNDO_DELETE_DURATION_MS = 10_000

const toastUi = {
    root: 'erp-toast',
    wrapper: 'erp-toast__body',
    title: 'erp-toast__title',
    description: 'erp-toast__desc',
    icon: 'erp-toast__icon',
    progress: 'erp-toast__progress',
    close: 'erp-toast__close',
    actions: 'erp-toast__actions',
}

const baseToastOptions = {
    color: 'neutral' as const,
    orientation: 'horizontal' as const,
    progress: false,
    close: false,
    duration: TOAST_DURATION_MS,
    ui: toastUi,
}

export function useAppToast() {
    const toast = useToast()

    const showSuccess = (title: string, description?: string) => {
        toast.add({
            ...baseToastOptions,
            title,
            description,
            icon: 'heroicons:check-circle',
            class: 'erp-toast erp-toast--success',
        })
    }

    const showError = (error: unknown, fallback = 'Что-то пошло не так') => {
        const title = error instanceof Error ? error.message : fallback
        toast.add({
            ...baseToastOptions,
            title,
            icon: 'heroicons:x-circle',
            duration: TOAST_DURATION_MS + 500,
            class: 'erp-toast erp-toast--error',
        })
    }

    const showUndoDelete = (onUndo: () => void) => {
        const duration = UNDO_DELETE_DURATION_MS
        const startedAt = Date.now()
        let tickTimer: ReturnType<typeof setInterval> | null = null

        const stopTick = () => {
            if (tickTimer !== null) {
                clearInterval(tickTimer)
                tickTimer = null
            }
        }

        const getRemainingLabel = () => {
            const seconds = Math.max(1, Math.ceil((duration - (Date.now() - startedAt)) / 1000))
            return `${seconds} сек для отмены`
        }

        const entry = toast.add({
            ...baseToastOptions,
            duration,
            progress: true,
            title: 'Карточка удалена навсегда',
            description: getRemainingLabel(),
            icon: 'heroicons:trash',
            class: 'erp-toast erp-toast--undo',
            actions: [{
                label: 'Отменить',
                class: 'erp-toast__undo-btn',
                onClick: () => {
                    stopTick()
                    onUndo()
                    toast.remove(entry.id)
                },
            }],
        })

        if (import.meta.client) {
            tickTimer = setInterval(() => {
                if (duration - (Date.now() - startedAt) <= 0) {
                    stopTick()
                    return
                }
                toast.update(entry.id, {description: getRemainingLabel()})
            }, 250)
        }
    }

    return {showSuccess, showError, showUndoDelete}
}

export function useMutationToast(successMessage?: string) {
    const {showSuccess, showError} = useAppToast()

    return {
        onSuccess: () => {
            if (successMessage) showSuccess(successMessage)
        },
        onError: (error: unknown) => showError(error),
    }
}
