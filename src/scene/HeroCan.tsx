import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import type { Group } from 'three'
import { HERO_FLAVOR, SECTIONS, type SectionId } from '../data'
import {
  clamp01,
  easeInOutCubic,
  easeOutBounce,
  lerp,
  prefersReducedMotion,
  sectionProgress,
  smoothstep,
} from '../scroll'
import { Bubbles } from './Bubbles'
import { ExplodedPieces, explodeAmount, toScreen } from './Exploded'
import { HERO_SLOT, isNarrow, slotPosition, stage, viewSize } from './layout'
import { pickPose, pickTargets, stepPick } from './pick'
import { sceneState } from './state'
import { reportHotspots, stepSpin, turnPlacement, useSpinInput, zoomOffset } from './turn'
import { useCan } from './useCan'

interface Pose {
  x: number
  y: number
  z: number
  rx: number // tilt towards the camera
  rz: number // lean left / right
  ry: number // spin around the can's own axis
  s: number
}

const TAU = Math.PI * 2

// One pose per story section, keyed by section id. x / y are fractions of the half-viewport,
// so the can sits opposite the copy column at any screen size. ry gains a full turn per
// section (added below); the label pose shows the back of the can, where the nutrition panel
// is printed.
const POSES: Partial<Record<SectionId, Pose>> = {
  hero: { x: 0, y: -0.06, z: 0, rx: 0.08, rz: -0.08, ry: -0.3, s: 1.05 },
  fruit: { x: 0.46, y: 0, z: 0, rx: 0.12, rz: 0.42, ry: -0.45, s: 0.92 }, // copy left
  ginger: { x: -0.46, y: 0, z: 0, rx: -0.1, rz: -0.5, ry: 0.5, s: 0.92 }, // copy right
  bubbles: { x: 0.44, y: -0.04, z: 0, rx: 0.72, rz: 0.18, ry: -0.3, s: 0.95 }, // lid towards us
  exploded: { x: 0.04, y: 0.02, z: 0, rx: 0.14, rz: 0, ry: 0.35, s: 0.8 }, // upright, room to fly apart
  label: { x: -0.44, y: 0, z: 0, rx: 0.05, rz: -0.32, ry: Math.PI, s: 0.92 }, // back of can
  // Upright in the DOM spin stage; position and size come from the stage (see storyPose).
  turn: { x: 0, y: 0, z: 0, rx: 0, rz: 0, ry: 0, s: 0.9 },
}
const LAND_SECTION = SECTIONS.indexOf('lineup')
const STORY_POSES: Pose[] = SECTIONS.slice(0, LAND_SECTION).map((id, i) => {
  const p = POSES[id] ?? { x: 0, y: 0, z: 0, rx: 0, rz: 0, ry: 0, s: 0.9 }
  return { ...p, ry: p.ry + i * TAU }
})
const LANDED_RY = LAND_SECTION * TAU
const BUBBLES = SECTIONS.indexOf('bubbles')
const EXPLODED = SECTIONS.indexOf('exploded')
const TURN = SECTIONS.indexOf('turn')

function storyPose(i: number, aspect: number): Pose {
  const view = viewSize(aspect)
  const p = STORY_POSES[i]
  if (i === TURN) {
    const t = turnPlacement(i, aspect)
    if (t.ok) return { ...p, x: t.x, y: t.y, s: t.s }
  }
  // On narrow screens the copy sits at the bottom, so the can stays centred in the top half.
  const narrow = isNarrow(aspect)
  const x = narrow ? 0 : p.x
  const y = narrow ? (i === 0 ? 0.06 : 0.36) : p.y
  const s = narrow ? p.s * (i === 0 ? 0.78 : 0.6) : p.s
  return { ...p, x: (x * view.w) / 2, y: (y * view.h) / 2, s }
}

// Travel between two poses: one full spin, a swoop towards the camera and a lean into the move.
function travel(a: Pose, b: Pose, t: number, viewH: number): Pose {
  const e = easeInOutCubic(clamp01((t - 0.1) / 0.8))
  const arc = Math.sin(Math.PI * e)
  const lean = b.x === a.x ? 0 : -Math.sign(b.x - a.x) * 0.35 * arc
  return {
    x: lerp(a.x, b.x, e),
    y: lerp(a.y, b.y, e) - 0.1 * (viewH / 2) * arc,
    z: lerp(a.z, b.z, e) + 0.06 * arc,
    rx: lerp(a.rx, b.rx, e),
    rz: lerp(a.rz, b.rz, e) + lean,
    ry: lerp(a.ry, b.ry, e),
    s: lerp(a.s, b.s, e),
  }
}

// Last leg: stand up while flying over the empty pedestal, then drop onto it.
function landing(a: Pose, t: number, scrollY: number, aspect: number, viewH: number): Pose {
  const slot = slotPosition(HERO_SLOT, scrollY, aspect)
  const hoverY = slot.y + viewH * 0.22
  const upright = { x: slot.x, y: hoverY, z: 0, rx: 0, rz: 0, ry: LANDED_RY, s: slot.scale }
  if (t < 0.7) return travel(a, upright, t / 0.7, viewH)
  const drop = easeOutBounce(clamp01((t - 0.7) / 0.3))
  return { ...upright, y: lerp(hoverY, slot.y, drop) }
}

export function HeroCan() {
  const scene = useCan(HERO_FLAVOR)
  const outer = useRef<Group>(null!) // position, scale and tilt
  const spin = useRef<Group>(null!) // spin around the can's axis
  const reduced = useMemo(prefersReducedMotion, [])

  const tab = useMemo(() => scene.getObjectByName('PullTab')!, [scene])
  const tabRest = useMemo(() => tab.rotation.x, [tab])
  const bubbles = useRef(0)
  const lid = useMemo(() => scene.getObjectByName('LidDetails')!, [scene])
  const lidRest = useMemo(() => lid.position.y, [lid])
  const tabRestY = useMemo(() => tab.position.y, [tab])
  const explode = useRef(0)
  useSpinInput(reduced)

  useLayoutEffect(() => {
    pickTargets.set(HERO_FLAVOR, scene)
    return () => void pickTargets.delete(HERO_FLAVOR)
  }, [scene])

  useFrame(({ camera, clock, size }, delta) => {
    const aspect = size.width / size.height
    const view = viewSize(aspect)
    const scrollY = window.scrollY
    const f = sectionProgress(scrollY)

    let p: Pose
    if (f < LAND_SECTION - 1) {
      const i = Math.floor(f)
      // The exploded view holds the can still until its parts are back together.
      const t = i === EXPLODED ? clamp01((f - i - 0.85) / 0.15) : f - i
      p = travel(storyPose(i, aspect), storyPose(i + 1, aspect), t, view.h)
    } else {
      const a = storyPose(LAND_SECTION - 1, aspect)
      p = landing(a, clamp01(f - (LAND_SECTION - 1)), scrollY, aspect, view.h)
    }

    // In the turn section the visitor holds the can: their spin and hotspot zoom take over.
    const held = 1 - smoothstep(0.35, 0.6, Math.abs(f - TURN))
    const zoom = stepSpin(Math.min(delta, 0.05), reduced) * held
    p.ry += sceneState.spin.angle * held
    p.s *= 1 + 0.6 * zoom
    p.y -= zoomOffset(p.s, zoom)

    // Idle float while the can is in the air; it settles as it comes in to land.
    const airborne = (1 - smoothstep(LAND_SECTION - 0.6, LAND_SECTION - 0.25, f)) * (1 - held)
    const time = clock.elapsedTime
    if (!reduced) {
      p.y += 0.003 * Math.sin(time * 1.3) * airborne
      p.ry += 0.1 * Math.sin(time * 0.6) * airborne
      // Lean into the west wind while the hero is on screen.
      const gust = 1 - smoothstep(0.2, 0.7, f)
      p.rz -= 0.14 * sceneState.wind.x * gust
      p.rx -= 0.1 * sceneState.wind.y * gust
      p.x += 0.006 * sceneState.wind.x * gust
    }

    // Picked from the podium: hop off to centre stage (only once it has landed).
    const k = stepPick(HERO_FLAVOR, delta, reduced)
    if (k > 0) {
      const q = pickPose({ x: p.x, y: p.y, z: p.z, ry: p.ry, s: p.s }, 0, k, aspect)
      p = { ...p, ...q }
    }

    outer.current.position.set(p.x, p.y, p.z)
    outer.current.rotation.set(p.rx, 0, p.rz)
    outer.current.scale.setScalar(p.s)
    spin.current.rotation.y = p.ry

    // The tab lifts as the bubbles section arrives and stays open: this is the can you drink.
    tab.rotation.x = tabRest - 1.05 * smoothstep(BUBBLES - 0.45, BUBBLES - 0.05, f)
    bubbles.current = smoothstep(BUBBLES - 0.4, BUBBLES, f) * (1 - smoothstep(BUBBLES + 0.3, BUBBLES + 0.75, f))

    // Exploded view: the parts float apart along the can's axis, then snap back together.
    // Reduced motion: no drift, the parts simply show apart while the captions are up.
    const e = reduced ? (explodeAmount(f, EXPLODED) > 0.5 ? 1 : 0) : explodeAmount(f, EXPLODED)
    explode.current = e
    // Lid and tab lead; the fruit follows (see Exploded.tsx).
    const parts = smoothstep(0, 0.35, e)
    lid.position.y = lidRest + 0.05 * parts
    tab.position.y = tabRestY + 0.09 * parts
    tab.rotation.z = 0.6 * parts

    const landed = f >= LAND_SECTION - 0.015
    if (landed && stage.landedAt === null) stage.landedAt = time
    if (!landed) stage.landedAt = null
    // Screen centre for the DOM hit target; only pickable once it stands on the podium.
    const hit = sceneState.cans[HERO_FLAVOR]
    toScreen(outer.current, camera, hit, size.width, size.height)
    hit.visible &&= landed
    reportHotspots(spin.current, camera, size.width, size.height, held > 0.95 && k === 0)
  })

  return (
    <group ref={outer}>
      <group ref={spin}>
        <primitive object={scene} />
      </group>
      <Bubbles amount={bubbles} />
      <ExplodedPieces amount={explode} parts={{ body: scene, lid, tab }} />
    </group>
  )
}
