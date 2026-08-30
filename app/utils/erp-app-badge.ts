export function supportsAppBadge(): boolean {
  return typeof navigator !== 'undefined' && 'setAppBadge' in navigator
}

export async function syncAppBadge(count: number): Promise<void> {
  if (!supportsAppBadge()) return

  try {
    if (count > 0) {
      await navigator.setAppBadge(count)
      return
    }
    await navigator.clearAppBadge()
  } catch {
    // Badge API failures must not affect queue or notifications.
  }
}
