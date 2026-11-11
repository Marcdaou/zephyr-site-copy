import { SECTIONS } from '../data'
import { anchors } from '../scroll'

// World units are metres, matching the GLB files: a can is 0.066 wide and 0.122 tall,
// with its pivot at the centre.
export const CAMERA_Z = 0.5
export const CAMERA_FOV = 28
export const CAN_HALF_HEIGHT = 0.061

// Podium slots in podium-local space, ordered like FLAVORS (lime, yuzu, blood, grapefruit).
export const SLOT_X = [-0.1575, -0.0525, 0.0525, 0.1575]
export const PEDESTAL_HEIGHT = [0.03, 0.055, 0.042, 0.025]
export const PEDESTAL_RADIUS = 0.042
export const HERO_SLOT = 1

const LINEUP = SECTIONS.indexOf('lineup')

export const isNarrow = (aspect: number) => aspect < 0.8

// Size of the visible plane at z = 0.
export function viewSize(aspect: number) {
  const h = 2 * CAMERA_Z * Math.tan((CAMERA_FOV * Math.PI) / 360)
  return { w: h * aspect, h }
}

// The podium is laid out as if it were part of the lineup section: it scrolls with the page
// and sits in place when that section reaches the top of the viewport.
export function podiumPlacement(scrollY: number, aspect: number) {
  const view = viewSize(aspect)
  const narrow = isNarrow(aspect)
  const scale = Math.min(0.64, (view.w * (narrow ? 0.92 : 0.8)) / 0.4)
  const floor = (narrow ? -0.3 : -0.68) * (view.h / 2)
  const y = floor + ((scrollY - anchors[LINEUP]) / window.innerHeight) * view.h
  return { y, scale }
}

// Where a can's centre sits when it stands on pedestal `slot`.
export function slotPosition(slot: number, scrollY: number, aspect: number) {
  const { y, scale } = podiumPlacement(scrollY, aspect)
  return {
    x: SLOT_X[slot] * scale,
    y: y + (PEDESTAL_HEIGHT[slot] + CAN_HALF_HEIGHT) * scale,
    scale,
  }
}

// Shared between the hero can and the podium so the neighbours can react to the landing.
export const stage = { landedAt: null as number | null }

// Where a DOM element sits in the z = 0 plane, so a 3D object can be framed inside it.
// `on` is false when the element is well off screen, so callers can skip work.
export function elementPlacement(el: Element | null, aspect: number) {
  if (!el) return { x: 0, y: 0, w: 0, h: 0, on: false }
  const r = el.getBoundingClientRect()
  const view = viewSize(aspect)
  const vw = window.innerWidth
  const vh = window.innerHeight
  return {
    x: ((r.left + r.width / 2) / vw - 0.5) * view.w,
    y: (0.5 - (r.top + r.height / 2) / vh) * view.h,
    w: (r.width / vw) * view.w,
    h: (r.height / vh) * view.h,
    on: r.bottom > -vh * 0.25 && r.top < vh * 1.25,
  }
}
