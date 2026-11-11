import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { DirectionalLight, Group, Mesh, MeshBasicMaterial, Object3D } from 'three'
import { FLAVORS, HERO_FLAVOR, type Flavor } from '../data'
import {
  CAN_HALF_HEIGHT,
  HERO_SLOT,
  PEDESTAL_HEIGHT,
  PEDESTAL_RADIUS,
  SLOT_X,
  podiumPlacement,
  slotPosition,
  stage,
} from './layout'
import { toScreen } from './Exploded'
import { pickPose, pickTargets, stepPick } from './pick'
import { sceneState, useSceneState } from './state'
import { prefersReducedMotion } from '../scroll'
import { useCan } from './useCan'

const PEDESTAL_COLOR = '#EDE4D6'

function Pedestal({ slot, flavor }: { slot: number; flavor: Flavor }) {
  const h = PEDESTAL_HEIGHT[slot]
  return (
    <group position={[SLOT_X[slot], 0, 0]}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[PEDESTAL_RADIUS, PEDESTAL_RADIUS, h, 64]} />
        <meshStandardMaterial color={PEDESTAL_COLOR} roughness={0.85} />
      </mesh>
      {/* A band in the flavour's label colour ties each pedestal to its can. */}
      <mesh position={[0, h - 0.007, 0]}>
        <cylinderGeometry args={[PEDESTAL_RADIUS + 0.0004, PEDESTAL_RADIUS + 0.0004, 0.004, 64, 1, true]} />
        <meshStandardMaterial color={flavor.labelColor} roughness={0.6} />
      </mesh>
    </group>
  )
}

// One of the three cans already waiting on the podium. It hops when the hero can lands, and
// jumps off to centre stage when picked.
function WaitingCan({ slot, flavor }: { slot: number; flavor: Flavor }) {
  const scene = useCan(flavor.id)
  const ref = useRef<Group>(null!)
  const baseY = PEDESTAL_HEIGHT[slot] + CAN_HALF_HEIGHT
  const restRy = -SLOT_X[slot] * 2.2
  const reduced = useMemo(prefersReducedMotion, [])

  useLayoutEffect(() => {
    pickTargets.set(flavor.id, scene)
    return () => void pickTargets.delete(flavor.id)
  }, [flavor.id, scene])

  useFrame(({ camera, clock, size }, delta) => {
    let hop = 0
    if (stage.landedAt !== null) {
      const dt = clock.elapsedTime - stage.landedAt - 0.12 - Math.abs(slot - HERO_SLOT) * 0.08
      if (dt > 0) hop = 0.012 * Math.abs(Math.sin(dt * 13)) * Math.exp(-dt * 5)
    }
    const t = stepPick(flavor.id, delta, reduced)
    if (t <= 0) {
      ref.current.position.set(SLOT_X[slot], baseY + hop, 0)
      ref.current.rotation.y = restRy
      ref.current.scale.setScalar(1)
      toScreen(ref.current, camera, sceneState.cans[flavor.id], size.width, size.height)
      return
    }
    // Pick poses are in world space; convert back into the podium's frame.
    const aspect = size.width / size.height
    const podium = podiumPlacement(window.scrollY, aspect)
    const rest = slotPosition(slot, window.scrollY, aspect)
    const p = pickPose({ x: rest.x, y: rest.y, z: 0, ry: restRy, s: rest.scale }, restRy, t, aspect)
    ref.current.position.set(p.x / podium.scale, (p.y - podium.y) / podium.scale, p.z / podium.scale)
    ref.current.rotation.y = p.ry
    ref.current.scale.setScalar(p.s / podium.scale)
    toScreen(ref.current, camera, sceneState.cans[flavor.id], size.width, size.height)
  })

  return (
    <group ref={ref} position={[SLOT_X[slot], baseY, 0]} rotation={[0, restRy, 0]}>
      <primitive object={scene} />
    </group>
  )
}

function SlotLabel({ slot, flavor }: { slot: number; flavor: Flavor }) {
  // Fade out while a can is picked so the names don't collide with it or the header.
  const { picked } = useSceneState()
  return (
    <Html position={[SLOT_X[slot], -0.018, 0.05]} center zIndexRange={[25, 20]}>
      <div
        className="w-[min(22vw,11rem)] text-center text-teal transition-opacity duration-200"
        style={{ opacity: picked ? 0 : 1 }}
      >
        <p className="font-display text-sm leading-tight font-bold md:text-lg">{flavor.name}</p>
        <p className="mt-1 hidden font-serif text-sm italic md:block">{flavor.tagline}</p>
        <p className="mt-1 text-xs md:text-sm">{flavor.calories} calories</p>
      </div>
    </Html>
  )
}

// A ripple on the floor around the hero's pedestal at the moment of landing.
function LandingRipple() {
  const ref = useRef<Mesh>(null!)
  useFrame(({ clock }) => {
    const mat = ref.current.material as MeshBasicMaterial
    const dt = stage.landedAt === null ? Infinity : clock.elapsedTime - stage.landedAt
    const k = Math.min(dt / 0.9, 1)
    ref.current.visible = k < 1
    ref.current.scale.setScalar(1 + k * 1.4)
    mat.opacity = 0.45 * (1 - k)
  })
  return (
    <mesh ref={ref} position={[SLOT_X[HERO_SLOT], 0.0005, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[PEDESTAL_RADIUS + 0.002, PEDESTAL_RADIUS + 0.006, 96]} />
      <meshBasicMaterial color="#0F3F49" transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

export function Podium() {
  const group = useRef<Group>(null!)
  const light = useRef<DirectionalLight>(null!)
  const target = useRef<Object3D>(null!)

  useLayoutEffect(() => {
    light.current.target = target.current
  }, [])

  useFrame(({ size }) => {
    const { y, scale } = podiumPlacement(window.scrollY, size.width / size.height)
    group.current.position.set(0, y, 0)
    group.current.scale.setScalar(scale)
  })

  return (
    <group ref={group}>
      {/* Shadow light travels with the podium so its shadow camera always frames it. */}
      <object3D ref={target} position={[0, 0, 0]} />
      <directionalLight
        ref={light}
        position={[0.25, 0.75, 0.5]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.0015}
        shadow-camera-near={0.05}
        shadow-camera-far={3}
        shadow-camera-left={-0.3}
        shadow-camera-right={0.3}
        shadow-camera-top={0.3}
        shadow-camera-bottom={-0.3}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[3, 3]} />
        <shadowMaterial opacity={0.2} />
      </mesh>
      <LandingRipple />

      {FLAVORS.map((flavor, slot) => (
        <group key={flavor.id}>
          <Pedestal slot={slot} flavor={flavor} />
          {flavor.id !== HERO_FLAVOR && <WaitingCan slot={slot} flavor={flavor} />}
          <SlotLabel slot={slot} flavor={flavor} />
        </group>
      ))}
    </group>
  )
}
