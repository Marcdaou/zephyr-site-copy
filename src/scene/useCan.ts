import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useLayoutEffect } from 'react'
import type { Mesh, MeshStandardMaterial, Object3D } from 'three'
import { FLAVORS, modelUrl, type FlavorId } from '../data'

// Loads one ZEPHYR can (meshopt-compressed GLB) and readies it for shadows and sharp labels.
export function useCan(id: FlavorId) {
  const { scene } = useGLTF(modelUrl(id))
  const gl = useThree((s) => s.gl)
  pristine(id, scene) // snapshot before anyone poses it

  useLayoutEffect(() => {
    const aniso = gl.capabilities.getMaxAnisotropy()
    scene.traverse((o) => {
      const mesh = o as Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
      const mat = mesh.material as MeshStandardMaterial
      if (mat.map) mat.map.anisotropy = aniso
    })
  }, [scene, gl])

  return scene
}

// An untouched copy of a can, taken before the hero animates its lid and tab, so later
// clones never inherit an opened or exploded pose.
const pristineCache = new Map<FlavorId, Object3D>()
export function pristine(id: FlavorId, scene: Object3D) {
  if (!pristineCache.has(id)) pristineCache.set(id, scene.clone(true))
  return pristineCache.get(id)!.clone(true)
}

FLAVORS.forEach((f) => useGLTF.preload(modelUrl(f.id)))
