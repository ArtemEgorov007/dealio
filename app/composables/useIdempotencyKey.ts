/**
 * GAS Web App POST-ответы иногда теряются на клиенте (редирект-эхо 404) уже
 * ПОСЛЕ того, как сервер успешно записал результат — слепой повтор той же
 * формы реально задваивает Приём/Выдачу на складе. requestId генерируется
 * один раз на конкретный набор значений формы и переиспользуется, пока эти
 * значения не изменились — так повтор клика после потерянного ответа шлёт
 * тот же ID (сервер его дедуплицирует), а осознанное изменение количества/
 * получателя и т.п. считается новой операцией с новым ID.
 */
export function useIdempotencyKey() {
    const lastFingerprint = ref<string | null>(null)
    const lastRequestId = ref<string | null>(null)

    const requestIdFor = (fingerprint: string): string => {
        if (lastFingerprint.value === fingerprint && lastRequestId.value) {
            return lastRequestId.value
        }
        const id = crypto.randomUUID()
        lastFingerprint.value = fingerprint
        lastRequestId.value = id
        return id
    }

    // Вызывать после подтверждённого успеха: иначе повтор той же формы
    // (два одинаковых прихода подряд и т.п.) дедуплицируется сервером
    // как ложный повтор и тихо не запишется.
    const reset = () => {
        lastFingerprint.value = null
        lastRequestId.value = null
    }

    return {requestIdFor, reset}
}
