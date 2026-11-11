import { SECTIONS } from './data'

// Scroll position at which each section's top meets the top of the viewport.
// Measured from the DOM so the 3D poses stay locked to the copy whatever the layout.
export const anchors: number[] = SECTIONS.map((_, i) => i * window.innerHeight)

export function measureAnchors() {
  SECTIONS.forEach((id, i) => {
    const el = document.getElementById(id)
    if (el) anchors[i] = el.getBoundingClientRect().top + window.scrollY
  })
}

// Float section index: 2.5 means halfway between the third and fourth sections.
export function sectionProgress(scrollY: number) {
  if (scrollY <= anchors[0]) return 0
  for (let i = 0; i < anchors.length - 1; i++) {
    if (scrollY < anchors[i + 1]) return i + (scrollY - anchors[i]) / (anchors[i + 1] - anchors[i])
  }
  return anchors.length - 1
}

export const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1)
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
export const easeOutBounce = (t: number) => {
  const n = 7.5625, d = 2.75
  if (t < 1 / d) return n * t * t
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375
  return n * (t -= 2.625 / d) * t + 0.984375
}
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
