// Polite announcements for state changes the canvas shows but a screen reader can't see.
// Writes straight into the live region's DOM node, so no React render can batch it away.
let region: HTMLElement | null = null
let timer = 0

export const bindLiveRegion = (el: HTMLElement | null) => {
  region = el
}

export function announce(text: string) {
  if (!region) return
  // Clear first so repeating the same message is still read out.
  region.textContent = ''
  window.clearTimeout(timer)
  timer = window.setTimeout(() => region && (region.textContent = text), 50)
}
