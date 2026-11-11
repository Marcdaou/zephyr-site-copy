import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  InstancedMesh,
  Object3D,
  Shape,
  ShapeGeometry,
  type MeshStandardMaterial,
  type PointsMaterial,
} from 'three'
import { prefersReducedMotion, sectionProgress, smoothstep } from '../scroll'
import { sceneState } from './state'
import { viewSize } from './layout'

const LEAVES = 18
const MIST = 160

// Raw pointer / tilt target; sceneState.wind eases towards it every frame.
const target = { x: 0, y: 0 }

// The west wind: mouse position on desktop, device tilt on phones. Writes sceneState.wind.
function useWindInput() {
  useEffect(() => {
    if (prefersReducedMotion()) return
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      target.x = (e.clientX / window.innerWidth) * 2 - 1
      target.y = 1 - (e.clientY / window.innerHeight) * 2
    }
    // gamma: left/right tilt, beta: front/back. Neutral holding angle is ~40deg forward.
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma === null || e.beta === null) return
      target.x = Math.max(-1, Math.min(1, e.gamma / 30))
      target.y = Math.max(-1, Math.min(1, (40 - e.beta) / 30))
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('deviceorientation', onTilt)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('deviceorientation', onTilt)
    }
  }, [])
}

// A yuzu leaf: pointed ellipse, slightly asymmetric.
function leafGeometry() {
  const s = new Shape()
  s.moveTo(0, -0.012)
  s.bezierCurveTo(0.008, -0.006, 0.007, 0.006, 0, 0.013)
  s.bezierCurveTo(-0.006, 0.006, -0.007, -0.006, 0, -0.012)
  return new ShapeGeometry(s, 6)
}

const LEAF_SEEDS = Array.from({ length: LEAVES }, () => ({
  x: Math.random(),
  y: Math.random(),
  z: -0.12 + Math.random() * 0.2,
  speed: 0.05 + Math.random() * 0.06,
  spin: (Math.random() - 0.5) * 4,
  phase: Math.random() * Math.PI * 2,
  s: 0.7 + Math.random() * 0.6,
}))
const MIST_SEEDS = Array.from({ length: MIST }, () => ({
  x: Math.random(),
  y: Math.random(),
  z: -0.1 + Math.random() * 0.18,
  speed: 0.08 + Math.random() * 0.1,
  phase: Math.random() * Math.PI * 2,
}))

const dummy = new Object3D()
const wrap = (v: number) => v - Math.floor(v)

// Leaves and mist blowing across the hero. They always drift west to east; the pointer adds
// gusts and steers them. Fades out as the hero scrolls away.
export function Wind() {
  useWindInput()
  const reduced = useMemo(prefersReducedMotion, [])
  const leaves = useRef<InstancedMesh>(null!)
  const leafMat = useRef<MeshStandardMaterial>(null!)
  const mistMat = useRef<PointsMaterial>(null!)
  const leafGeo = useMemo(leafGeometry, [])
  const mistGeo = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(MIST * 3), 3))
    return g
  }, [])
  // Integrated drift so gusts accelerate the flow instead of teleporting it.
  const drift = useRef({ x: 0, y: 0 })

  useFrame(({ clock, size }, delta) => {
    const w = sceneState.wind
    const k = 1 - Math.exp(-delta * 3)
    w.x += (target.x - w.x) * k
    w.y += (target.y - w.y) * k

    const amount = reduced ? 0 : 1 - smoothstep(0.35, 0.8, sectionProgress(window.scrollY))
    leaves.current.visible = amount > 0.001
    leafMat.current.opacity = amount
    mistMat.current.opacity = amount * 0.35
    if (amount <= 0.001) return

    const dt = Math.min(delta, 0.05)
    drift.current.x += dt * (0.6 + w.x * 1.2)
    drift.current.y += dt * w.y * 0.6
    const t = clock.elapsedTime
    const view = viewSize(size.width / size.height)
    const W = view.w * 1.2
    const H = view.h * 1.2

    LEAF_SEEDS.forEach((s, i) => {
      const u = wrap(s.x + drift.current.x * s.speed * 2.5)
      const v = wrap(s.y + drift.current.y * s.speed * 2 + 0.03 * Math.sin(t * 0.8 + s.phase))
      dummy.position.set((u - 0.5) * W, (v - 0.5) * H, s.z)
      dummy.rotation.set(t * s.spin * 0.5 + s.phase, t * s.spin + w.y, -Math.PI / 2 + w.x * 0.6)
      dummy.scale.setScalar(s.s)
      dummy.updateMatrix()
      leaves.current.setMatrixAt(i, dummy.matrix)
    })
    // Phones get half the leaves and mist.
    const count = size.width < 700 ? 0.5 : 1
    leaves.current.count = Math.round(LEAVES * count)
    mistGeo.setDrawRange(0, Math.round(MIST * count))
    leaves.current.instanceMatrix.needsUpdate = true

    const pos = mistGeo.attributes.position as BufferAttribute
    MIST_SEEDS.forEach((s, i) => {
      const u = wrap(s.x + drift.current.x * s.speed * 3)
      const v = wrap(s.y + drift.current.y * s.speed * 2 + 0.01 * Math.sin(t + s.phase))
      pos.setXYZ(i, (u - 0.5) * W, (v - 0.5) * H, s.z)
    })
    pos.needsUpdate = true
  })

  return (
    <group>
      <instancedMesh ref={leaves} args={[leafGeo, undefined, LEAVES]} frustumCulled={false}>
        <meshStandardMaterial ref={leafMat} color="#5E7F2A" roughness={0.6} side={DoubleSide} transparent />
      </instancedMesh>
      <points geometry={mistGeo} frustumCulled={false}>
        <pointsMaterial ref={mistMat} color="#FFFFFF" size={0.0025} sizeAttenuation transparent depthWrite={false} />
      </points>
    </group>
  )
}
