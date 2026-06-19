export const KANBAN_DRAG_THRESHOLD_PX = 5

export function createDragGhost(
    source: HTMLElement,
    clientX: number,
    clientY: number,
): { ghost: HTMLElement; offsetX: number; offsetY: number } {
    const rect = source.getBoundingClientRect()
    const offsetX = clientX - rect.left
    const offsetY = clientY - rect.top
    const ghost = source.cloneNode(true) as HTMLElement
    const computed = getComputedStyle(source)

    Object.assign(ghost.style, {
        position: 'fixed',
        left: `${clientX - offsetX}px`,
        top: `${clientY - offsetY}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        margin: '0',
        pointerEvents: 'none',
        zIndex: '10000',
        opacity: '0.95',
        boxShadow: '0 10px 28px rgba(0, 0, 0, 0.28)',
        transform: 'rotate(-0.5deg) scale(1.02)',
        backgroundColor: computed.backgroundColor,
        border: computed.border,
        borderRadius: computed.borderRadius,
        color: computed.color,
        font: computed.font,
        padding: computed.padding,
        display: computed.display,
        alignItems: computed.alignItems,
        gap: computed.gap,
        boxSizing: 'border-box',
    })

    ghost.classList.add('kanban-drag-ghost')
    ghost.setAttribute('aria-hidden', 'true')
    document.body.appendChild(ghost)

    return {ghost, offsetX, offsetY}
}

export function moveDragGhost(
    ghost: HTMLElement,
    clientX: number,
    clientY: number,
    offsetX: number,
    offsetY: number,
): void {
    ghost.style.left = `${clientX - offsetX}px`
    ghost.style.top = `${clientY - offsetY}px`
}

export function removeDragGhost(ghost: HTMLElement | null): void {
    ghost?.remove()
}

export function resolveDropColumnId(clientX: number, clientY: number): string | null {
    const columnEl = document.elementFromPoint(clientX, clientY)?.closest('[data-column-id]') as HTMLElement | null
    return columnEl?.dataset.columnId ?? null
}
