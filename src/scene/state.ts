import { useSyncExternalStore } from 'react'
import type { FlavorId } from '../data'

// Shared state between the DOM and the 3D scene. The DOM owns intent (which can is picked,
// what is in the pack); the scene owns motion and reports back where things sit on screen.
// Mutable fields that change every frame (wind, spin, hotspot screen positions) are read
// directly; `emit()` only fires on discrete changes so React re-renders stay rare.

export type HotspotId = 'juice' | 'calories' | 'nutrition'
export type PartId = 'body' | 'lid' | 'tab' | 'yuzu' | 'ginger'

export interface ScreenPoint {
  x: number // CSS px from the viewport's left
  y: number // CSS px from the viewport's top
  visible: boolean // facing the camera and on screen
}

export const sceneState = {
  // 1. Pick a can on the podium. Set by the DOM hit targets laid over `cans`.
  picked: null as FlavorId | null,
  cans: {
    lime: { x: 0, y: 0, visible: false },
    yuzu: { x: 0, y: 0, visible: false },
    blood: { x: 0, y: 0, visible: false },
    grapefruit: { x: 0, y: 0, visible: false },
  } as Record<FlavorId, ScreenPoint>,
  // 2. Turn the can in your hand. The DOM writes angle / velocity / dragging; the scene adds inertia.
  spin: { angle: 0, velocity: 0, dragging: false },
  hotspot: null as HotspotId | null, // focused hotspot; the scene zooms towards it
  hotspots: {
    juice: { x: 0, y: 0, visible: false },
    calories: { x: 0, y: 0, visible: false },
    nutrition: { x: 0, y: 0, visible: false },
  } as Record<HotspotId, ScreenPoint>,
  // 3. Exploded view: where each part's caption should anchor, and how far apart (0..1).
  explode: 0,
  parts: {
    body: { x: 0, y: 0, visible: false },
    lid: { x: 0, y: 0, visible: false },
    tab: { x: 0, y: 0, visible: false },
    yuzu: { x: 0, y: 0, visible: false },
    ginger: { x: 0, y: 0, visible: false },
  } as Record<PartId, ScreenPoint>,
  // 4. West wind: pointer / tilt in -1..1, +x right, +y up.
  wind: { x: 0, y: 0 },
  // 5. Build your own 4-pack, in drop order (max 4). The frontend persists it.
  pack: [] as FlavorId[],
}

const listeners = new Set<() => void>()
let version = 0

export function emit() {
  version++
  listeners.forEach((l) => l())
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

// Re-renders the caller whenever `emit()` fires; read fields off `sceneState` after it.
export function useSceneState() {
  useSyncExternalStore(subscribe, () => version)
  return sceneState
}

export function pickCan(id: FlavorId | null) {
  if (sceneState.picked === id) return
  sceneState.picked = id
  emit()
}

export function focusHotspot(id: HotspotId | null) {
  sceneState.hotspot = id
  emit()
}

export function setPack(pack: FlavorId[]) {
  sceneState.pack = pack.slice(0, 4)
  emit()
}
