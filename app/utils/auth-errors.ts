const AUTH_ERROR_MAP: Record<string, string> = {
    user_invalid_credentials: 'Неверный email или пароль',
    user_not_found: 'Пользователь не найден',
    user_already_exists: 'Пользователь с таким email уже зарегистрирован',
    user_password_mismatch: 'Пароли не совпадают',
    user_unauthorized: 'Нужно войти в аккаунт',
    user_blocked: 'Аккаунт заблокирован. Обратитесь в поддержку',
    user_email_not_whitelisted: 'Email не разрешён для регистрации',
    user_invalid_token: 'Сессия истекла. Войдите снова',
    user_session_already_exists: 'Вы уже авторизованы',
    password_recently_used: 'Этот пароль уже использовался ранее',
    password_personal_data: 'Пароль не должен содержать личные данные',
    general_rate_limit_exceeded: 'Слишком много попыток. Попробуйте позже',
    general_unknown: 'Что-то пошло не так. Попробуйте ещё раз',
}

const MESSAGE_PATTERNS: [RegExp, string][] = [
    [/invalid credentials/i, 'Неверный email или пароль'],
    [/user (with the same id|already exists)/i, 'Пользователь с таким email уже зарегистрирован'],
    [/password must be at least/i, 'Пароль слишком короткий — минимум 6 символов'],
    [/network/i, 'Нет соединения с сервером. Проверьте интернет'],
    [/fetch/i, 'Не удалось связаться с сервером. Попробуйте позже'],
]

export function map_auth_error(error: unknown, fallback: string): string {
    if (!error || typeof error !== 'object') return fallback

    const err = error as { type?: string; code?: string; message?: string }
    const code = err.type || err.code

    if (code && AUTH_ERROR_MAP[code]) {
        return AUTH_ERROR_MAP[code]
    }

    const message = err.message ?? ''
    for (const [pattern, text] of MESSAGE_PATTERNS) {
        if (pattern.test(message)) return text
    }

    if (/^[a-z_]+$/.test(message)) {
        return fallback
    }

    if (/[а-яА-ЯёЁ]/.test(message)) {
        return message
    }

    return fallback
}
