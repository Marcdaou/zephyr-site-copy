import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, type RefObject } from 'react'
import { BufferAttribute, BufferGeometry, CanvasTexture, type PointsMaterial } from 'three'

const COUNT = 70
const LID_Y = 0.058 // just under the rim, in can space
const RISE = 0.11

// A soft ring sprite, drawn once, so the bubbles read as carbonation rather than dots.
function bubbleTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 10, 32, 32, 30)
  grad.addColorStop(0, 'rgba(255,255,255,0.15)')
  grad.addColorStop(0.75, 'rgba(255,255,255,0.9)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.beginPath()
  g.arc(32, 32, 30, 0, Math.PI * 2)
  g.fill()
  return new CanvasTexture(c)
}

// Fixed per page load; each bubble loops up from the lid at its own pace.
const SEEDS = Array.from({ length: COUNT }, () => ({
  angle: Math.random() * Math.PI * 2,
  radius: 0.004 + Math.random() * 0.016,
  speed: 0.25 + Math.random() * 0.45,
  phase: Math.random(),
  wobble: Math.random() * Math.PI * 2,
}))

// Bubbles rising out of the opened can, along its own axis. `amount` (0..1) fades them in and out.
export function Bubbles({ amount }: { amount: RefObject<number> }) {
  const material = useRef<PointsMaterial>(null!)

  const texture = useMemo(() => bubbleTexture(), [])
  const geometry = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(COUNT * 3), 3))
    return g
  }, [])

  useFrame(({ clock }) => {
    const a = amount.current
    material.current.opacity = a * 0.85
    if (a <= 0.001) return
    const t = clock.elapsedTime
    const pos = geometry.attributes.position as BufferAttribute
    SEEDS.forEach((s, i) => {
      const life = (t * s.speed + s.phase) % 1
      const r = s.radius * (1 + life * 1.8)
      pos.setXYZ(
        i,
        Math.cos(s.angle) * r + Math.sin(t * 3 + s.wobble) * 0.002,
        LID_Y + life * RISE,
        Math.sin(s.angle) * r + 0.006,
      )
    })
    pos.needsUpdate = true
  })

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        ref={material}
        map={texture}
        size={0.0045}
        sizeAttenuation
        transparent
        opacity={0}
        depthWrite={false}
      />
    </points>
  )
}
