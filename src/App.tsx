import Lenis from 'lenis'
import { useEffect, useState } from 'react'
import { Header } from './components/Header'
import { Loader } from './components/Loader'
import { Exploded, FlavorPanel, LiveRegion, Pack, Turn } from './components/Features'
import { Footer, Ginger, Hero, HeroWordmark, Label, Lineup, Bubbles, Fruit } from './components/Sections'
import { SECTIONS, SECTION_DARK } from './data'
import Experience from './scene/Experience'
import { restorePack } from './packStorage'
import { useSceneState } from './scene/state'
import { smooth } from './smooth'
import { measureAnchors, prefersReducedMotion, sectionProgress } from './scroll'

export default function App() {
  const [dark, setDark] = useState(false)
  const { picked } = useSceneState()

  useEffect(restorePack, [])

  // Smooth scrolling drives the native scroll position, which the 3D scene reads every frame.
  useEffect(() => {
    if (prefersReducedMotion()) return
    const lenis = new Lenis({ autoRaf: true, lerp: 0.09, anchors: true })
    smooth.lenis = lenis
    return () => {
      lenis.destroy()
      smooth.lenis = null
    }
  }, [])

  // Keep the section anchors in step with the layout.
  useEffect(() => {
    measureAnchors()
    const ro = new ResizeObserver(measureAnchors)
    ro.observe(document.body)
    document.fonts.ready.then(measureAnchors)
    return () => ro.disconnect()
  }, [])

  // Header ink follows the section underneath it.
  useEffect(() => {
    const onScroll = () => {
      const i = Math.min(Math.floor(sectionProgress(window.scrollY + 40)), SECTIONS.length - 1)
      setDark(SECTION_DARK[SECTIONS[i]])
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="relative">
      <HeroWordmark />
      <Experience />
      <Header dark={dark || picked !== null} />
      <main className="relative z-20">
        <Hero />
        <Fruit />
        <Ginger />
        <Bubbles />
        <Exploded />
        <Label />
        <Turn />
        <Lineup />
        <Pack />
      </main>
      <Footer />
      <FlavorPanel />
      <LiveRegion />
      <Loader />
    </div>
  )
}
