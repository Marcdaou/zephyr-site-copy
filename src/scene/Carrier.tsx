import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { Group, Object3D } from 'three'
import { FLAVORS, type FlavorId } from '../data'
import { clamp01, easeOutBounce, lerp, prefersReducedMotion } from '../scroll'
import { CAN_HALF_HEIGHT, elementPlacement } from './layout'
import { sceneState } from './state'
import { pristine, useCan } from './useCan'

export const PACK_STAGE_ID = 'pack-stage'

const CELL = 0.072 // one can's square in the carrier
const WALL = 0.0025
const WALL_H = 0.055
const DIVIDER_H = 0.15 // the centre panel doubles as the handle
const CARDBOARD = '#B98A57'
const CARDBOARD_DARK = '#9C7144'
// Cell centres, in drop order: front left, front right, back left, back right.
const CELLS = [
  [-CELL / 2, CELL / 2],
  [CELL / 2, CELL / 2],
  [-CELL / 2, -CELL / 2],
  [CELL / 2, -CELL / 2],
] as const
const SEAT_Y = WALL + CAN_HALF_HEIGHT
const DROP_FROM = SEAT_Y + 0.22
const DROP_TIME = 0.7

// A 2 x 2 cardboard carrier: a base, four outer walls, a low cross divider and a tall centre
// panel with a hand hole. Plain boxes, so it costs a handful of draw calls.
function CarrierBox() {
  const outer = CELL * 2 + WALL * 2
  const panel = (w: number, h: number, d: number, x: number, y: number, z: number, color = CARDBOARD) => (
    <mesh position={[x, y, z]} castShadow receiveShadow>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
  )
  return (
    <group>
      {panel(outer, WALL, outer, 0, WALL / 2, 0)}
      {panel(outer, WALL_H, WALL, 0, WALL_H / 2, outer / 2 - WALL / 2)}
      {panel(outer, WALL_H, WALL, 0, WALL_H / 2, -outer / 2 + WALL / 2)}
      {panel(WALL, WALL_H, outer, outer / 2 - WALL / 2, WALL_H / 2, 0)}
      {panel(WALL, WALL_H, outer, -outer / 2 + WALL / 2, WALL_H / 2, 0)}
      {panel(WALL, WALL_H * 0.8, outer, 0, (WALL_H * 0.8) / 2, 0, CARDBOARD_DARK)}
      {/* Centre handle panel, built around its hand hole. */}
      {panel(outer, DIVIDER_H - 0.045, WALL, 0, (DIVIDER_H - 0.045) / 2, 0, CARDBOARD_DARK)}
      {panel(outer, 0.016, WALL, 0, DIVIDER_H - 0.008, 0, CARDBOARD_DARK)}
      {panel(outer * 0.3, 0.03, WALL, -outer * 0.35, DIVIDER_H - 0.031, 0, CARDBOARD_DARK)}
      {panel(outer * 0.3, 0.03, WALL, outer * 0.35, DIVIDER_H - 0.031, 0, CARDBOARD_DARK)}
    </group>
  )
}

// One cell. Keeps a private clone per flavour (a GLB scene can only have one parent), reads
// its flavour from sceneState.pack every frame and bounces the can in whenever it changes.
function PackedCan({ cell, sources }: { cell: number; sources: Record<FlavorId, Object3D> }) {
  const ref = useRef<Group>(null!)
  const clones = useMemo(
    () => Object.fromEntries(FLAVORS.map((f) => [f.id, pristine(f.id, sources[f.id])])) as Record<FlavorId, Object3D>,
    [sources],
  )
  const reduced = useMemo(prefersReducedMotion, [])
  const droppedAt = useRef(0)
  const last = useRef<FlavorId | null>(null)

  useFrame(({ clock }) => {
    const flavor = sceneState.pack[cell] ?? null
    if (flavor !== last.current) {
      last.current = flavor
      droppedAt.current = clock.elapsedTime
      FLAVORS.forEach((f) => (clones[f.id].visible = f.id === flavor))
    }
    ref.current.visible = flavor !== null
    if (!flavor) return
    const t = reduced ? 1 : clamp01((clock.elapsedTime - droppedAt.current) / DROP_TIME)
    ref.current.position.y = lerp(DROP_FROM, SEAT_Y, easeOutBounce(t))
    ref.current.rotation.y = (1 - t) * 1.5 + cell * 0.4
  })

  return (
    <group ref={ref} position={[CELLS[cell][0], SEAT_Y, CELLS[cell][1]]} visible={false}>
      {FLAVORS.map((f) => (
        <primitive key={f.id} object={clones[f.id]} visible={false} />
      ))}
    </group>
  )
}

// "Build your own 4-pack", framed inside the DOM stage element. Once full, it turns slowly.
export function Carrier() {
  const lime = useCan('lime')
  const yuzu = useCan('yuzu')
  const blood = useCan('blood')
  const grapefruit = useCan('grapefruit')
  const sources = useMemo(() => ({ lime, yuzu, blood, grapefruit }), [lime, yuzu, blood, grapefruit])
  const outer = useRef<Group>(null!)
  const turn = useRef<Group>(null!)
  const stageEl = useRef<HTMLElement | null>(null)
  const reduced = useMemo(prefersReducedMotion, [])

  useFrame(({ size }, delta) => {
    if (!stageEl.current?.isConnected) stageEl.current = document.getElementById(PACK_STAGE_ID)
    const place = elementPlacement(stageEl.current, size.width / size.height)
    outer.current.visible = place.on
    if (!place.on) return
    // Fit the carrier, with cans standing in it, inside the stage.
    const s = Math.min(place.h / 0.24, place.w / 0.26)
    outer.current.position.set(place.x, place.y - 0.09 * s, 0)
    outer.current.scale.setScalar(s)
    // Idles round slowly while you fill it, then shows off a little once it is full.
    if (!reduced) turn.current.rotation.y += delta * (sceneState.pack.length === 4 ? 0.35 : 0.08)
  })

  return (
    <group ref={outer} visible={false}>
      <group rotation={[0.35, 0, 0]}>
        <group ref={turn} rotation={[0, -0.5, 0]}>
          <CarrierBox />
          {CELLS.map((_, i) => (
            <PackedCan key={i} cell={i} sources={sources} />
          ))}
        </group>
      </group>
    </group>
  )
}
