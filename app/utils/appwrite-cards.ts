import type {Models} from 'appwrite'

import {COLLECTION_CARDS, DB_ID} from '~~/app.constants'
import type {ICardRecord} from '~~/types/cards.types'
import {account, DB} from '~/utils/appwrite'
import {buildUserPermissions} from '~/utils/appwrite-user'
import {priorityToAppwritePrice} from '~/utils/card-priority'

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
    const payload = {
        ...data,
        price: priorityToAppwritePrice(data.price ?? 3),
    }
    return DB.createDocument(DB_ID, COLLECTION_CARDS, documentId, payload, buildUserPermissions(userId))
}

export async function updateCardStatus(documentId: string, status: ICardRecord['status']) {
    return DB.updateDocument(DB_ID, COLLECTION_CARDS, documentId, {status})
}

export async function updateCard(
    documentId: string,
    data: {
        name?: string
        price?: number
        status?: ICardRecord['status']
        customerName?: string
    },
) {
    const patch: Record<string, unknown> = {}

    if (data.name !== undefined) patch.name = data.name
    if (data.price !== undefined) patch.price = priorityToAppwritePrice(data.price)
    if (data.status !== undefined) patch.status = data.status

    if (data.customerName !== undefined) {
        const existing = await DB.getDocument<ICardRecord>(DB_ID, COLLECTION_CARDS, documentId)
        patch.customer = {
            ...existing.customer,
            name: data.customerName,
        }
    }

    return DB.updateDocument(DB_ID, COLLECTION_CARDS, documentId, patch)
}
