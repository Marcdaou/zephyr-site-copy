import { FLAVORS, type FlavorId } from './data'
import { sceneState, setPack } from './scene/state'

// The four-pack survives reloads. Anything malformed or unknown in storage is dropped silently.
const PACK_KEY = 'zephyr-pack-v1'
export const PACK_SIZE = 4

export function restorePack() {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(PACK_KEY) ?? '[]')
    if (!Array.isArray(raw)) return
    setPack(raw.filter((id): id is FlavorId => FLAVORS.some((f) => f.id === id)))
  } catch {
    // Unreadable storage: start with an empty carrier.
  }
}

export function savePack(pack: FlavorId[]) {
  setPack(pack)
  try {
    localStorage.setItem(PACK_KEY, JSON.stringify(sceneState.pack))
  } catch {
    // Private mode or full storage: the pack just won't survive a reload.
  }
}
