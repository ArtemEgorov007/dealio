import {v4 as uuid} from 'uuid'

import {COLLECTION_COMMENTS, DB_ID} from '~~/app.constants'
import {account, DB} from '~/utils/appwrite'
import {buildUserPermissions} from '~/utils/appwrite-user'

export async function createComment(text: string, dealId: string) {
    const userId = (await account.get()).$id
    return DB.createDocument(
        DB_ID,
        COLLECTION_COMMENTS,
        uuid(),
        {text, deal: dealId},
        buildUserPermissions(userId),
    )
}
