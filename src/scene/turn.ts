import { useEffect } from 'react'
import { Vector3, type Camera, type Object3D } from 'three'
import { anchors } from '../scroll'
import { toScreen } from './Exploded'
import { CAN_HALF_HEIGHT, elementPlacement, isNarrow, viewSize } from './layout'
import { focusHotspot, sceneState, type HotspotId } from './state'

// "Turn the can in your hand": the hero can itself flies into the DOM stage and is spun there,
// so the same can carries on from the story into the lineup.

export const SPIN_STAGE_ID = 'spin-stage'

const RADIUS = 0.0335 // label surface, can space
// Hotspots pinned to the label: angle around the can (0 faces the camera at rest) and height.
const HOTSPOTS: Record<HotspotId, { angle: number; y: number }> = {
  juice: { angle: -0.785, y: 0.0146 }, // "Real Yuzu Juice" roundel, left of the slice, 62% up
  calories: { angle: 0.7, y: 0.0146 }, // "45 calories" roundel, mirrors it
  nutrition: { angle: -1.66, y: 0.0061 }, // nutrition panel, 55% up
}
const ANCHORS = Object.fromEntries(
  Object.entries(HOTSPOTS).map(([id, h]) => [id, new Vector3(Math.sin(h.angle) * RADIUS, h.y, Math.cos(h.angle) * RADIUS)]),
) as Record<HotspotId, Vector3>

const FRICTION = 2.2 // per second; how quickly a flick settles
const camDir = new Vector3()
const normal = new Vector3()
const UP = new Vector3(0, 1, 0)

// The shortest signed turn from a to b.
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

// Drag-to-spin input on the DOM stage. Pointer drags set the angle directly and leave a
// velocity behind; arrow keys nudge it. (The DOM keeps Home and the hint.)
export function useSpinInput(reduced: boolean) {
  useEffect(() => {
    const el = document.getElementById(SPIN_STAGE_ID)
    if (!el) return
    const spin = sceneState.spin
    let lastX = 0
    let lastT = 0
    const down = (e: PointerEvent) => {
      spin.dragging = true
      spin.velocity = 0
      lastX = e.clientX
      lastT = e.timeStamp
      el.setPointerCapture(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      if (!spin.dragging) return
      const d = ((e.clientX - lastX) / Math.max(el.clientWidth, 1)) * Math.PI * 2
      const dt = Math.max((e.timeStamp - lastT) / 1000, 1 / 240)
      spin.angle += d
      spin.velocity = reduced ? 0 : 0.6 * spin.velocity + 0.4 * (d / dt)
      lastX = e.clientX
      lastT = e.timeStamp
    }
    const up = () => (spin.dragging = false)
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      e.preventDefault()
      if (sceneState.hotspot) focusHotspot(null)
      spin.angle += (e.key === 'ArrowRight' ? 1 : -1) * (Math.PI / 6)
      spin.velocity = 0
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('keydown', key)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('keydown', key)
    }
  }, [reduced])
}

let zoom = 0

// Coasts the spin after a release and steers it towards a focused hotspot. Returns the zoom (0..1).
export function stepSpin(dt: number, reduced: boolean) {
  const spin = sceneState.spin
  // Grabbing the can hands control back to the drag.
  if (spin.dragging && sceneState.hotspot) focusHotspot(null)
  const focus = sceneState.hotspot
  if (focus && !spin.dragging) {
    const err = wrapAngle(-HOTSPOTS[focus].angle - spin.angle)
    if (reduced) spin.angle += err
    else spin.velocity = err * 6
  }
  if (!spin.dragging) {
    spin.angle += spin.velocity * dt
    if (!focus) spin.velocity *= Math.exp(-FRICTION * dt)
  }
  const z = focus ? 1 : 0
  zoom = reduced ? z : zoom + (z - zoom) * (1 - Math.exp(-dt * 6))
  return zoom
}

let stageEl: HTMLElement | null = null

// Where the can stands in the turn section: framed in the DOM stage as it sits when the section
// reaches the top of the viewport, so it holds still like every other story pose.
export function turnPlacement(section: number, aspect: number) {
  if (!stageEl?.isConnected) stageEl = document.getElementById(SPIN_STAGE_ID)
  const place = elementPlacement(stageEl, aspect)
  const view = viewSize(aspect)
  const y = place.y - ((window.scrollY - anchors[section]) / window.innerHeight) * view.h
  const s = Math.min((place.h * 0.8) / (CAN_HALF_HEIGHT * 2), (place.w * 0.8) / 0.066)
  // Phones: a little smaller and higher so the can clears the label details list.
  const narrow = isNarrow(aspect)
  return { x: place.x, y: y + (narrow ? view.h * 0.08 : 0), s: narrow ? s * 0.8 : s, ok: !!stageEl }
}

// Zooming towards a spot also slides the can so that spot stays near the stage centre.
export const zoomOffset = (s: number, k: number) => (sceneState.hotspot ? HOTSPOTS[sceneState.hotspot].y : 0) * s * k

// Screen positions for the DOM hotspot buttons; `active` is false outside the turn section.
export function reportHotspots(spinner: Object3D, camera: Camera, w: number, h: number, active: boolean) {
  camera.getWorldDirection(camDir)
  ;(Object.keys(ANCHORS) as HotspotId[]).forEach((id) => {
    const out = sceneState.hotspots[id]
    if (!active) return void (out.visible = false)
    toScreen(spinner, camera, out, w, h, ANCHORS[id])
    normal.copy(ANCHORS[id]).setY(0).normalize().applyAxisAngle(UP, spinner.rotation.y)
    // Hide spots turned more than ~70 degrees away from the viewer.
    out.visible &&= normal.dot(camDir) < -0.34
  })
}
