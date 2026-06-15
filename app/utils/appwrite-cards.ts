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
