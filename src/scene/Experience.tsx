import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect } from 'react'
import { AgXToneMapping, Color, PMREMGenerator } from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { FLAVORS, SECTIONS, SECTION_BG, type FlavorId } from '../data'
import { easeInOutCubic, sectionProgress, smoothstep } from '../scroll'
import { Carrier } from './Carrier'
import { HeroCan } from './HeroCan'
import { CAMERA_FOV, CAMERA_Z } from './layout'
import { pickedAmount } from './pick'
import { Podium } from './Podium'
import { sceneState } from './state'
import { Wind } from './Wind'

// Bare aluminium renders dark without something to reflect, so give it a studio room.
function StudioEnvironment() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    return () => {
      scene.environment = null
      env.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])
  return null
}

const BG = SECTIONS.map((id) => new Color(SECTION_BG[id]))
const mixed = new Color()
const FLAVOR_BG = new Map<FlavorId | null, Color>(FLAVORS.map((f) => [f.id, new Color(f.labelColor)]))
let lastPicked: FlavorId | null = null

// Blends the page colour between neighbouring sections, in step with the can.
function PageColor() {
  useFrame(() => {
    const f = sectionProgress(window.scrollY)
    const i = Math.min(Math.floor(f), BG.length - 1)
    const j = Math.min(i + 1, BG.length - 1)
    // Each section holds its own colour and only blends over its last third, so tall sections
    // never sit half-mixed (the exploded captions need their dark ground).
    const t = smoothstep(0.65, 1, f - i)
    mixed.copy(BG[i]).lerp(BG[j], t)
    // A picked can turns the page its flavour's colour.
    const picked = FLAVOR_BG.get(sceneState.picked ?? lastPicked)
    if (sceneState.picked) lastPicked = sceneState.picked
    const k = pickedAmount()
    if (picked && k > 0) mixed.lerp(picked, easeInOutCubic(k))
    const css = `#${mixed.getHexString()}`
    if (document.body.style.backgroundColor !== css) {
      document.body.style.backgroundColor = css
      document.documentElement.style.backgroundColor = css
    }
  })
  return null
}

export default function Experience() {
  return (
    <div className="pointer-events-none fixed inset-0 z-10" aria-hidden>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ fov: CAMERA_FOV, position: [0, 0, CAMERA_Z], near: 0.01, far: 10 }}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = AgXToneMapping
          gl.toneMappingExposure = 1.15
        }}
      >
        <StudioEnvironment />
        <PageColor />
        <directionalLight position={[-1, 1.2, 1.2]} intensity={2.2} color="#FFF4E8" />
        <directionalLight position={[1.2, 0.6, -1]} intensity={2} color="#DFEAFF" />
        <Suspense fallback={null}>
          <HeroCan />
          <Podium />
          <Carrier />
        </Suspense>
        <Wind />
      </Canvas>
    </div>
  )
}
