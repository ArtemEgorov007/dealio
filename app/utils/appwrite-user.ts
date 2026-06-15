import type {Models} from 'appwrite'
import {Permission, Role} from 'appwrite'

import type {IUser} from '~~/store/auth.store'

export function mapAppwriteUser(user: Models.User): IUser {
    return {
        id: user.$id,
        email: user.email,
        name: user.name || user.email.split('@')[0] || 'Пользователь',
        status: true,
        isGuest: false,
    }
}

export function buildUserPermissions(userId: string) {
    return [
        Permission.read(Role.user(userId)),
        Permission.update(Role.user(userId)),
        Permission.delete(Role.user(userId)),
    ]
}
