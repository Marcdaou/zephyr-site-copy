import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, type RefObject } from 'react'
import {
  CanvasTexture,
  CylinderGeometry,
  CapsuleGeometry,
  Group,
  SRGBColorSpace,
  Vector3,
  type Camera,
  type Object3D,
} from 'three'
import { smoothstep } from '../scroll'
import { sceneState, type PartId, type ScreenPoint } from './state'

// 0 outside the exploded section, 1 in its middle: apart on the way in, back together on the
// way out. Matches the DOM captions, which show over local progress 0.6..1.4 (f - at + 0.5).
export const explodeAmount = (f: number, at: number) =>
  smoothstep(at - 0.1, at + 0.3, f) * (1 - smoothstep(at + 0.75, at + 0.98, f))

const v = new Vector3()

// Project a world-space object (plus an optional local offset) to CSS pixels.
export function toScreen(obj: Object3D, camera: Camera, out: ScreenPoint, w: number, h: number, offset?: Vector3) {
  v.copy(offset ?? v.set(0, 0, 0))
  obj.localToWorld(v)
  v.project(camera)
  out.x = (v.x * 0.5 + 0.5) * w
  out.y = (0.5 - v.y * 0.5) * h
  out.visible = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05
}

// A cross-section of yuzu: rind, pith and ten pale segments, painted once.
function yuzuSliceTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#F2C200'
  g.beginPath()
  g.arc(128, 128, 128, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#FFF3C4'
  g.beginPath()
  g.arc(128, 128, 112, 0, Math.PI * 2)
  g.fill()
  for (let i = 0; i < 10; i++) {
    const a0 = (i / 10) * Math.PI * 2 + 0.04
    const a1 = ((i + 1) / 10) * Math.PI * 2 - 0.04
    g.fillStyle = i % 2 ? '#F7D64A' : '#F4CF35'
    g.beginPath()
    g.moveTo(128 + Math.cos((a0 + a1) / 2) * 10, 128 + Math.sin((a0 + a1) / 2) * 10)
    g.arc(128, 128, 102, a0, a1)
    g.closePath()
    g.fill()
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

// A knobbly chunk of ginger root: a closed capsule lying on its side, gently lumped. The bumps
// come from the vertex position (not its index) so shared seams stay closed.
function gingerGeometry(seed: number) {
  const geo = new CapsuleGeometry(0.008, 0.016, 6, 12)
  geo.rotateZ(Math.PI / 2)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const n = 1 + 0.12 * Math.sin(x * 260 + seed * 2.1) * Math.cos(z * 210 + seed) + 0.08 * Math.sin(y * 300 + seed * 3.7)
    pos.setXYZ(i, x * n, y * n * 0.85, z * n)
  }
  geo.computeVertexNormals()
  return geo
}

// Where the fruit drifts to, in can space, when fully apart. Kind decides the shape.
const PIECES = [
  // Yuzu to the left, ginger to the right, all at least 1.3 can radii clear of the body and
  // away from the body caption (right, just below centre).
  { kind: 'yuzu', to: [-0.105, 0.035, 0.02], rot: [1.2, 0.3, 0.2], s: 1 },
  { kind: 'yuzu', to: [-0.095, -0.03, 0.03], rot: [0.9, -0.5, 0.6], s: 0.8 },
  { kind: 'yuzu', to: [-0.085, -0.075, -0.02], rot: [1.4, 0.8, -0.3], s: 0.7 },
  { kind: 'ginger', to: [0.1, 0.06, 0.01], rot: [0.4, 1, 0.3], s: 1 },
  { kind: 'ginger', to: [0.09, 0.095, 0.0], rot: [-0.3, 0.4, 1.1], s: 0.8 },
  { kind: 'ginger', to: [0.095, -0.08, 0.0], rot: [0.8, -0.6, 0.2], s: 0.9 },
] as const

const CAPTION_OFFSET: Record<'body' | 'lid' | 'tab', Vector3> = {
  body: new Vector3(0.035, -0.02, 0),
  lid: new Vector3(0, 0.003, 0),
  tab: new Vector3(0, 0.004, 0),
}

// Sliced yuzu and ginger drifting out of the can, and caption anchors for the DOM.
export function ExplodedPieces({
  amount,
  parts,
}: {
  amount: RefObject<number>
  parts: Record<'body' | 'lid' | 'tab', Object3D>
}) {
  const group = useRef<Group>(null!)
  const pieces = useRef<(Group | null)[]>([])
  const texture = useMemo(yuzuSliceTexture, [])
  const slice = useMemo(() => new CylinderGeometry(0.016, 0.016, 0.003, 40), [])
  const ginger = useMemo(() => [0, 1, 2].map(gingerGeometry), [])

  useFrame(({ camera, clock, size }) => {
    const a = amount.current
    sceneState.explode = a
    group.current.visible = a > 0.001
    const show = a > 0.5
    ;(['body', 'lid', 'tab'] as const).forEach((id) =>
      toScreen(parts[id], camera, sceneState.parts[id], size.width, size.height, CAPTION_OFFSET[id]),
    )
    if (!show) (Object.keys(sceneState.parts) as PartId[]).forEach((id) => (sceneState.parts[id].visible = false))
    if (!group.current.visible) return

    const t = clock.elapsedTime
    PIECES.forEach((p, i) => {
      const g = pieces.current[i]
      if (!g) return
      // Stagger so the pieces peel out one after another.
      const k = smoothstep(0.3 + i * 0.05, 0.75 + i * 0.05, a)
      g.position.set(p.to[0] * k, p.to[1] * k + 0.002 * Math.sin(t * 1.5 + i), p.to[2] * k)
      g.rotation.set(p.rot[0] * k + t * 0.2, p.rot[1] * k + t * 0.3, p.rot[2] * k)
      g.scale.setScalar(p.s * k)
    })
    // Captions anchor to the first piece of each kind.
    if (pieces.current[0] && show) toScreen(pieces.current[0], camera, sceneState.parts.yuzu, size.width, size.height)
    if (pieces.current[3] && show) toScreen(pieces.current[3], camera, sceneState.parts.ginger, size.width, size.height)
  })

  return (
    <group ref={group} visible={false}>
      {PIECES.map((p, i) => (
        <group key={i} ref={(g) => void (pieces.current[i] = g)}>
          {p.kind === 'yuzu' ? (
            <mesh geometry={slice}>
              <meshStandardMaterial attach="material-0" color="#E8B400" roughness={0.5} />
              <meshStandardMaterial attach="material-1" map={texture} roughness={0.35} />
              <meshStandardMaterial attach="material-2" map={texture} roughness={0.35} />
            </mesh>
          ) : (
            <group>
              <mesh geometry={ginger[i % 3]}>
                <meshStandardMaterial color="#C99A5B" roughness={0.75} />
              </mesh>
              {/* The pale, juicy cut face at one end of the knob. */}
              <mesh position={[0.016, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.0085, 0.0085, 0.0015, 18]} />
                <meshStandardMaterial color="#F2DFA8" roughness={0.5} />
              </mesh>
            </group>
          )}
        </group>
      ))}
    </group>
  )
}
