/** CSS mask for soft edges on a horizontally scrollable strip. */
export function scrollEdgeFadeMask(
  canScrollLeft: boolean,
  canScrollRight: boolean,
  fadeSize = '14px',
): {maskImage: string; WebkitMaskImage: string} {
  let image = 'none'
  if (canScrollLeft && canScrollRight) {
    image = `linear-gradient(to right, transparent, black ${fadeSize}, black calc(100% - ${fadeSize}), transparent)`
  } else if (canScrollLeft) {
    image = `linear-gradient(to right, transparent, black ${fadeSize})`
  } else if (canScrollRight) {
    image = `linear-gradient(to right, black calc(100% - ${fadeSize}), transparent)`
  }
  return {maskImage: image, WebkitMaskImage: image}
}

export function updateScrollEdgeFlags(
  el: HTMLElement,
  threshold = 4,
): {canScrollLeft: boolean; canScrollRight: boolean} {
  const maxScroll = el.scrollWidth - el.clientWidth
  return {
    canScrollLeft: el.scrollLeft > threshold,
    canScrollRight: el.scrollLeft < maxScroll - threshold,
  }
}
