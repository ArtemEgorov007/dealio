export const KANBAN_CARD_DRAG_MIME = 'application/x-dealio-card-id'

export function prepareCardDragTransfer(event: DragEvent, cardId: string): void {
    const dataTransfer = event.dataTransfer
    if (!dataTransfer) return

    dataTransfer.clearData()
    dataTransfer.setData(KANBAN_CARD_DRAG_MIME, cardId)
    dataTransfer.setData('text/plain', cardId)
    dataTransfer.effectAllowed = 'move'

    const ghost = document.createElement('div')
    ghost.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none'
    ghost.textContent = '\u200b'
    document.body.appendChild(ghost)
    dataTransfer.setDragImage(ghost, 0, 0)
    requestAnimationFrame(() => ghost.remove())
}

export function blockNativeDropNavigation(event: DragEvent): void {
    event.preventDefault()
    event.stopPropagation()
}
