import type {Models} from 'appwrite'

import {COLLECTION_CARDS, DB_ID} from '~~/app.constants'
import type {ICardRecord} from '~~/types/cards.types'
import {EnumStatus} from '~~/types/cards.types'
import {account, DB} from '~/utils/appwrite'
import {buildUserPermissions} from '~/utils/appwrite-user'
import {isWishlistCategory, toAppwritePrice} from '~/utils/card-priority'
import {toAppwriteStatus} from '~/utils/appwrite-status'

async function getSessionUserId(): Promise<string> {
    const user = await account.get()
    return user.$id
}

function filterDocumentsByUser<T extends { $permissions?: string[] }>(
    documents: T[],
    userId: string,
): T[] {
    const userRole = `user:${userId}`
    return documents.filter(doc =>
        doc.$permissions?.some(permission => permission.includes(userRole)),
    )
}

export async function listCards(): Promise<Models.DocumentList<ICardRecord>> {
    const userId = await getSessionUserId()
    const result = await DB.listDocuments<ICardRecord>(DB_ID, COLLECTION_CARDS)
    const documents = filterDocumentsByUser(result.documents, userId)

    return {
        ...result,
        documents,
        total: documents.length,
    }
}

export async function createCard(
    documentId: string,
    data: Omit<Partial<ICardRecord>, '$id' | '$createdAt' | '$updatedAt' | '$permissions' | '$databaseId' | '$collectionId'>,
) {
    const userId = await getSessionUserId()
    const category = data.customer?.name
    const payload = {
        ...data,
        price: toAppwritePrice(data.price ?? 0, category),
        status: toAppwriteStatus(data.status ?? EnumStatus.ideas),
    }
    return DB.createDocument(DB_ID, COLLECTION_CARDS, documentId, payload, buildUserPermissions(userId))
}

export async function updateCardStatus(documentId: string, status: EnumStatus) {
    return DB.updateDocument(DB_ID, COLLECTION_CARDS, documentId, {
        status: toAppwriteStatus(status),
    })
}

export async function updateCard(
    documentId: string,
    data: {
        name?: string
        price?: number
        status?: EnumStatus
        customerName?: string
    },
) {
    const patch: Record<string, unknown> = {}
    const needsExisting = data.price !== undefined || data.customerName !== undefined
    let category = data.customerName

    if (needsExisting) {
        const existing = await DB.getDocument<ICardRecord>(DB_ID, COLLECTION_CARDS, documentId)
        category = data.customerName ?? existing.customer.name

        if (data.customerName !== undefined) {
            patch.customer = {
                ...existing.customer,
                name: data.customerName,
            }
        }

        if (data.price !== undefined) {
            patch.price = toAppwritePrice(data.price, category)
        } else if (data.customerName !== undefined && !isWishlistCategory(data.customerName)) {
            patch.price = toAppwritePrice(0, data.customerName)
        }
    }

    if (data.name !== undefined) patch.name = data.name
    if (data.status !== undefined) patch.status = toAppwriteStatus(data.status)

    return DB.updateDocument(DB_ID, COLLECTION_CARDS, documentId, patch)
}
