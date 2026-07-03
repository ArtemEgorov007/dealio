import {defineStore} from 'pinia'

export const GUEST_STORAGE_KEY = 'dealio-guest'

export function isGuestSession(): boolean {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(GUEST_STORAGE_KEY) === '1'
}

export function setGuestSession(): void {
    if (typeof window === 'undefined') return
    localStorage.setItem(GUEST_STORAGE_KEY, '1')
}

export function clearGuestSession(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(GUEST_STORAGE_KEY)
}

export interface IUser {
    id?: string
    email: string
    name: string
    status: boolean
    isGuest?: boolean
}

interface IAuthState {
    user: IUser
}

interface ILoadingState {
    isLoading: boolean
}

const defaultUser: IUser = {
    email: '',
    name: '',
    status: false,
    isGuest: false
}

const guestUser: IUser = {
    id: undefined,
    email: 'guest@dealio.demo',
    name: 'Гость',
    status: true,
    isGuest: true
}

export const useAuthStore = defineStore('auth', {
    // Гостевой флаг читаем из localStorage синхронно при создании стора —
    // иначе запросы доски (vue-query) стартуют раньше, чем layout выставит
    // isGuest, и гость бьёт в Appwrite (2×403 в консоли на каждом холодном старте).
    state: (): IAuthState => ({
        user: isGuestSession() ? {...guestUser} : {...defaultUser}
    }),

    getters: {
        isAuth: (state) => state.user.status === true,
        isGuest: (state) => state.user.isGuest === true,
        userId: (state) => state.user.id,
        userEmail: (state) => state.user.email,
        userName: (state) => state.user.name
    },

    actions: {
        clear() {
            clearGuestSession()
            this.user = {...defaultUser}
        },

        set(userData: IUser) {
            this.user = {...userData}
        },

        setGuest() {
            setGuestSession()
            this.user = {...guestUser}
        },
    }
})

export const useIsLoadingStore = defineStore('isLoading', {
    state: (): ILoadingState => ({
        isLoading: true
    }),

    actions: {
        set(value: boolean) {
            this.isLoading = value
        }
    }
})
