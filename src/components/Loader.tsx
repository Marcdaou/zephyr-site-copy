import { useProgress } from '@react-three/drei'
import { useEffect, useState } from 'react'

// Covers the page until all four cans have loaded, so the scroll never starts on an empty stage.
export function Loader() {
  const { active, progress } = useProgress()
  const [gone, setGone] = useState(false)
  const done = !active && progress === 100

  useEffect(() => {
    if (!done) return
    const id = window.setTimeout(() => setGone(true), 700)
    return () => window.clearTimeout(id)
  }, [done])

  if (gone) return null
  return (
    <div
      role="status"
      className={`fixed inset-0 z-50 grid place-items-center bg-yuzu text-teal transition-opacity duration-700 ${
        done ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="text-center">
        <p className="font-display text-5xl font-extrabold">ZEPHYR</p>
        <p className="mt-3 font-serif italic">Chilling the cans… {Math.round(progress)}%</p>
      </div>
    </div>
  )
}
