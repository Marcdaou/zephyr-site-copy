import type { Object3D } from 'three'
import type { FlavorId } from '../data'
import { clamp01, easeInOutCubic, lerp } from '../scroll'
import { isNarrow, viewSize } from './layout'
import { sceneState } from './state'

// Picking a can on the podium: it hops off its pedestal, turns its label to the viewer and
// grows to centre stage. Each can eases its own progress (0 on the pedestal, 1 on stage).

const DURATION = 1.1 // seconds, either way
export const pickProgress: Record<FlavorId, number> = { lime: 0, yuzu: 0, blood: 0, grapefruit: 0 }

// Click targets for the raycaster, registered by whichever component renders that flavour.
export const pickTargets = new Map<FlavorId, Object3D>()

// Advance one can's progress towards its target. Reduced motion jumps straight there.
export function stepPick(id: FlavorId, delta: number, reduced: boolean) {
  const goal = sceneState.picked === id ? 1 : 0
  const p = pickProgress[id]
  pickProgress[id] = reduced ? goal : p + Math.sign(goal - p) * Math.min(Math.abs(goal - p), delta / DURATION)
  return pickProgress[id]
}

// The most-picked amount across all cans, for page tinting and dimming neighbours.
export const pickedAmount = () => Math.max(...Object.values(pickProgress))

export interface PickPose {
  x: number
  y: number
  z: number
  ry: number // extra spin on top of the resting one
  s: number
}

// Blend a resting world pose (`rest`) towards centre stage. `restRy` is the can's own spin
// on the pedestal, so we can unwind it to face the camera. The arc gives the hop.
export function pickPose(rest: PickPose, restRy: number, t: number, aspect: number): PickPose {
  if (t <= 0) return rest
  const view = viewSize(aspect)
  const narrow = isNarrow(aspect)
  // Stage: right of centre on desktop so the story copy fits on the left; top half on phones.
  // Phones: fit between the header (80px) and the top of the bottom sheet (60% down).
  const top = view.h / 2 - (80 / window.innerHeight) * view.h
  const bottom = -view.h * 0.1
  const stage = narrow
    ? { x: 0, y: (top + bottom) / 2, s: Math.min(0.8, (0.85 * (top - bottom)) / 0.122) }
    : { x: view.w * 0.2, y: -view.h * 0.02, s: 1.15 }
  const hop = clamp01(t / 0.3)
  const move = easeInOutCubic(clamp01((t - 0.15) / 0.85))
  const arc = Math.sin(Math.PI * Math.min(hop, 1)) * (1 - move) + Math.sin(Math.PI * move) * 0.5
  // Unwind the resting spin and add a full showman's turn on the way.
  const turn = move * (-restRy + Math.PI * 2 * Math.sign(restRy || 1))
  return {
    x: lerp(rest.x, stage.x, move),
    y: lerp(rest.y, stage.y, move) + arc * view.h * 0.08,
    z: lerp(rest.z, 0.02, move),
    ry: rest.ry + turn,
    s: lerp(rest.s, stage.s, move),
  }
}
