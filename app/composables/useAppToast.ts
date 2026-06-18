const TOAST_DURATION_MS = 3500

const toastUi = {
    root: 'dealio-toast',
    title: 'dealio-toast__title',
    description: 'dealio-toast__desc',
    icon: 'dealio-toast__icon',
}

export function useAppToast() {
    const toast = useToast()

    const showSuccess = (title: string, description?: string) => {
        toast.add({
            title,
            description,
            color: 'neutral',
            icon: 'heroicons:check-circle',
            duration: TOAST_DURATION_MS,
            class: 'dealio-toast dealio-toast--success',
            ui: toastUi,
        })
    }

    const showError = (error: unknown, fallback = 'Что-то пошло не так') => {
        const title = error instanceof Error ? error.message : fallback
        toast.add({
            title,
            color: 'neutral',
            icon: 'heroicons:exclamation-circle',
            duration: TOAST_DURATION_MS + 500,
            class: 'dealio-toast dealio-toast--error',
            ui: toastUi,
        })
    }

    return {showSuccess, showError}
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
