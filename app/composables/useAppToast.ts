const TOAST_DURATION_MS = 3500

export function useAppToast() {
    const toast = useToast()

    const showSuccess = (title: string, description?: string) => {
        toast.add({
            title,
            description,
            color: 'success',
            icon: 'heroicons:check-circle',
            duration: TOAST_DURATION_MS,
        })
    }

    const showError = (error: unknown, fallback = 'Что-то пошло не так') => {
        const title = error instanceof Error ? error.message : fallback
        toast.add({
            title,
            color: 'error',
            icon: 'heroicons:exclamation-circle',
            duration: TOAST_DURATION_MS + 500,
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
