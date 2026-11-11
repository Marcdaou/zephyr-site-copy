import { useEffect, useRef, useState, type ReactNode } from 'react'
import { FLAVORS, type FlavorId } from '../data'
import { PACK_SIZE, savePack } from '../packStorage'
import { prefersReducedMotion } from '../scroll'
import { focusHotspot, pickCan, sceneState, useSceneState, type HotspotId, type PartId } from '../scene/state'
import { announce, bindLiveRegion } from '../announce'
import { smooth } from '../smooth'

// Sections and overlays for the interactive features. Their 3D halves live in scene/; these are
// the DOM halves: copy, controls, and the screen-reader mirrors of what the canvas shows.

const flavorById = (id: FlavorId) => FLAVORS.find((f) => f.id === id)!

export function LiveRegion() {
  return <p ref={bindLiveRegion} aria-live="polite" className="sr-only" />
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-sm font-medium tracking-[0.18em] uppercase">{children}</p>
}

function Heading({ children }: { children: ReactNode }) {
  return <h2 className="mt-3 font-display text-5xl leading-[0.92] font-extrabold md:text-7xl">{children}</h2>
}

// Five dots per row, like the ginger section's "How it tastes".
export function TasteMeter({ rows, label }: { rows: [string, number][]; label: string }) {
  return (
    <div>
      <p className="text-sm">{label}</p>
      <ul className="mt-3 space-y-2">
        {rows.map(([name, score]) => (
          <li key={name} className="grid grid-cols-[4.5rem_1fr] items-center">
            <span className="font-display text-xl font-bold">{name}</span>
            <span className="flex gap-1.5" aria-label={`${score} out of 5`} role="img">
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className={`size-3.5 rounded-full border-2 border-current ${i < score ? 'bg-current' : ''}`} />
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---------- 4. West wind: tilt permission chip (iOS asks before sending orientation) ---------- */

type OrientationPermission = { requestPermission?: () => Promise<'granted' | 'denied'> }

export function TiltChip() {
  const [show, setShow] = useState(() => {
    const D = window.DeviceOrientationEvent as unknown as OrientationPermission | undefined
    return !!D?.requestPermission && matchMedia('(pointer: coarse)').matches && !prefersReducedMotion()
  })
  if (!show) return null
  const ask = () => {
    const D = window.DeviceOrientationEvent as unknown as OrientationPermission
    D.requestPermission?.().catch(() => 'denied').finally(() => setShow(false))
  }
  return (
    <button
      type="button"
      onClick={ask}
      className="min-h-11 self-start rounded-full border-2 border-teal px-4 text-sm font-medium"
    >
      Tilt to feel the wind
    </button>
  )
}

/* ---------- 1. Pick a can ---------- */

// The canvas never takes pointer events, so clicks on the podium land on these transparent buttons,
// pinned each frame to the can positions the scene reports. A row of real buttons, shown only on
// keyboard focus so it doesn't cover the podium labels, is the keyboard and screen-reader way in.
export function CanPicker() {
  const { picked } = useSceneState()
  const hits = useRef<Partial<Record<FlavorId, HTMLButtonElement | null>>>({})

  useEffect(() => {
    let raf = 0
    const tick = () => {
      for (const f of FLAVORS) {
        const el = hits.current[f.id]
        const p = sceneState.cans[f.id]
        if (!el) continue
        el.style.display = p.visible ? 'block' : 'none'
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <>
      {!picked &&
        FLAVORS.map((f) => (
          <button
            key={f.id}
            ref={(el) => {
              hits.current[f.id] = el
            }}
            type="button"
            tabIndex={-1}
            aria-hidden
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => pickCan(f.id)}
            style={{ display: 'none' }}
            className="fixed top-0 left-0 z-20 h-[22vh] w-[min(12vw,7rem)] cursor-pointer"
          />
        ))}
      <div className="sr-only focus-within:not-sr-only">
        <p className="mt-6 text-sm font-medium">Tap a can to meet it.</p>
        <ul className="mx-auto mt-3 flex max-w-xl flex-wrap justify-center gap-2">
          {FLAVORS.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                id={`meet-${f.id}`}
                aria-expanded={picked === f.id}
                aria-controls="flavor-panel"
                onClick={() => pickCan(f.id)}
                className="min-h-11 rounded-full border-2 border-teal bg-cream px-4 text-sm font-medium hover:bg-teal hover:text-cream"
              >
                Meet {f.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}

export function FlavorPanel() {
  const { picked } = useSceneState()
  const close = useRef<HTMLButtonElement>(null)
  const dragStart = useRef<number | null>(null)
  const last = useRef<FlavorId | null>(null)

  // Announce every change, whether it came from a 3D click, these buttons or Escape.
  useEffect(() => {
    if (picked) announce(`${flavorById(picked).name} selected.`)
    else if (last.current) announce('Back to the lineup.')
    last.current = picked
  }, [picked])

  useEffect(() => {
    if (!picked) return
    smooth.lenis?.stop()
    document.documentElement.style.overflow = 'hidden'
    close.current?.focus()
    return () => {
      smooth.lenis?.start()
      document.documentElement.style.overflow = ''
    }
  }, [picked])

  if (!picked) return null
  const f = flavorById(picked)
  const i = FLAVORS.indexOf(f)

  const back = () => {
    pickCan(null)
    document.getElementById(`meet-${f.id}`)?.focus()
  }
  const step = (d: number) => {
    const next = FLAVORS[(i + d + FLAVORS.length) % FLAVORS.length]
    pickCan(next.id)
  }

  return (
    <div className="fixed inset-0 z-40" onClick={back}>
      <div
        id="flavor-panel"
        role="dialog"
        aria-modal
        aria-labelledby="flavor-name"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') back()
          else if (e.key === 'ArrowLeft') step(-1)
          else if (e.key === 'ArrowRight') step(1)
          else if (e.key === 'Tab') trapFocus(e)
        }}
        onPointerDown={(e) => (dragStart.current = e.clientY)}
        onPointerUp={(e) => {
          if (dragStart.current !== null && e.clientY - dragStart.current > 80 && e.pointerType === 'touch') back()
          dragStart.current = null
        }}
        className="absolute inset-x-0 bottom-0 max-h-[60vh] overflow-y-auto rounded-t-3xl bg-cream p-6 text-teal shadow-2xl transition-opacity duration-200 md:inset-x-auto md:top-1/2 md:left-[6vw] md:bottom-auto md:max-h-[85vh] md:w-[26rem] md:-translate-y-1/2 md:rounded-3xl md:p-8"
      >
        <div className="flex items-center justify-between gap-4">
          <button ref={close} type="button" onClick={back} className="min-h-11 text-sm font-medium underline underline-offset-4">
            Back to the lineup
          </button>
          <div className="flex gap-2">
            <button type="button" aria-label="Previous flavor" onClick={() => step(-1)} className="size-11 rounded-full border-2 border-teal">
              ←
            </button>
            <button type="button" aria-label="Next flavor" onClick={() => step(1)} className="size-11 rounded-full border-2 border-teal">
              →
            </button>
          </div>
        </div>
        <h2 id="flavor-name" className="mt-6 font-display text-4xl leading-[0.95] font-extrabold md:text-5xl">
          {f.name}
        </h2>
        <p className="mt-2 font-serif text-xl italic">{f.tagline}</p>
        <p className="mt-4 leading-relaxed">{f.story}</p>
        <div className="mt-6">
          <TasteMeter rows={f.taste} label="How it tastes, out of five" />
        </div>
        <p className="mt-6 text-sm">
          {f.calories} calories. {f.serve}
        </p>
      </div>
    </div>
  )
}

// Keeps Tab inside the open dialog.
function trapFocus(e: React.KeyboardEvent<HTMLElement>) {
  const items = e.currentTarget.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])')
  const first = items[0]
  const last = items[items.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}

/* ---------- 3. Exploded view ---------- */

const PARTS: { id: PartId; text: string }[] = [
  { id: 'body', text: 'The can. 355 mL of aluminum, endlessly recyclable.' },
  { id: 'lid', text: 'The lid. Sealed cold, so the fizz holds until you open it.' },
  { id: 'tab', text: 'The tab. One click, and the wind gets out.' },
  { id: 'yuzu', text: 'Yuzu. Bright, floral, a little wild.' },
  { id: 'ginger', text: 'Ginger root. Pressed fresh for the warmth that follows.' },
]

export function Exploded() {
  const items = useRef<(HTMLLIElement | null)[]>([])

  // Captions follow their piece as it separates (sceneState.explode, 0..1). On wide screens each one
  // pins beside its part; on phones they stay stacked under the can. Reduced motion: the scene holds
  // the exploded pose, so the captions simply show.
  useEffect(() => {
    // Reduced motion: no pinning or fading, the captions are simply there, stacked.
    if (prefersReducedMotion()) return
    let raf = 0
    const tick = () => {
      const wide = window.innerWidth >= 768
      PARTS.forEach(({ id }, i) => {
        const el = items.current[i]
        if (!el) return
        const p = sceneState.parts[id]
        const o = Math.min(sceneState.explode * 1.6, 1) * (wide && !p.visible ? 0 : 1)
        el.style.opacity = String(o)
        el.style.position = wide ? 'fixed' : ''
        el.style.transform = wide ? `translate(${p.x + 56}px, ${p.y}px) translateY(-50%)` : ''
      })
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <section id="exploded" className="flex min-h-[160svh] flex-col px-6 pt-28 pb-14 text-cream md:px-[8vw]">
      <div className="max-w-md">
        <Eyebrow>Inside the can</Eyebrow>
        <Heading>Everything in its place.</Heading>
        <p className="mt-5 text-base leading-relaxed md:text-lg">Keep scrolling. It all comes apart, then back together.</p>
      </div>
      <ol className="sticky top-[58svh] mt-6 space-y-2 md:static">
        {PARTS.map(({ id, text }, i) => (
          <li
            key={id}
            ref={(el) => {
              items.current[i] = el
            }}
            className="border-l-2 border-cream pl-3 text-sm leading-snug md:top-0 md:left-0 md:max-w-[16rem] md:text-base"
          >
            {text}
          </li>
        ))}
      </ol>
    </section>
  )
}

/* ---------- 2. Turn the can ---------- */

const HOTSPOTS: { id: HotspotId; title: string; text: string }[] = [
  { id: 'juice', title: 'Real Yuzu Juice', text: 'Not flavoring, juice. Squeezed in Kōchi and shipped cold, 2% of every can.' },
  { id: 'calories', title: '45 calories', text: "Lightly sweetened with cane sugar. That's the whole can, not a serving size trick." },
  { id: 'nutrition', title: 'Nutrition facts', text: "Carbonated water, cane sugar, yuzu juice, ginger root extract, citric acid, natural flavors. Nothing artificial." },
]

export function Turn() {
  const { hotspot } = useSceneState()
  const [hinted, setHinted] = useState(false)
  const dots = useRef<Partial<Record<HotspotId, HTMLButtonElement | null>>>({})
  const tap = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const id = window.setTimeout(() => setHinted(true), 4000)
    return () => window.clearTimeout(id)
  }, [])

  // Pin the hotspot buttons to the points the scene projects each frame.
  useEffect(() => {
    let raf = 0
    const tick = () => {
      for (const h of HOTSPOTS) {
        const el = dots.current[h.id]
        const p = sceneState.hotspots[h.id]
        if (!el) continue
        el.style.opacity = p.visible ? '1' : '0'
        el.style.pointerEvents = p.visible ? 'auto' : 'none'
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [])

  const open = (id: HotspotId | null) => {
    focusHotspot(id)
    if (id) announce(`${HOTSPOTS.find((h) => h.id === id)!.title}.`)
  }
  const closeCallout = () => {
    const was = sceneState.hotspot
    open(null)
    if (was) document.getElementById(`hs-${was}`)?.focus()
  }
  const active = HOTSPOTS.find((h) => h.id === hotspot)

  return (
    <section id="turn" className="relative flex min-h-svh flex-col px-6 pt-28 pb-14 text-teal md:px-[8vw]">
      <div className="relative z-10 max-w-md">
        <Eyebrow>In your hand</Eyebrow>
        <Heading>Turn it over.</Heading>
        <p className="mt-5 text-base leading-relaxed md:text-lg">Drag to spin. Tap a marker to look closer.</p>
      </div>

      {/* Drag surface over the can. Horizontal drags spin it; vertical swipes still scroll the page. */}
      <div
        id="spin-stage"
        tabIndex={0}
        role="group"
        aria-label="Spin the can"
        aria-describedby="spin-help"
        // The scene listens on this element for drags and Left/Right; Home is ours.
        onKeyDown={(e) => {
          if (e.key !== 'Home') return
          sceneState.spin.angle = 0
          sceneState.spin.velocity = 0
          e.preventDefault()
        }}
        onPointerDown={() => setHinted(true)}
        className="relative mt-6 h-[60svh] cursor-grab md:absolute md:inset-x-[15%] md:top-[25%] md:bottom-[15%] md:mt-0 md:h-auto touch-pan-y active:cursor-grabbing"
      >
        <span id="spin-help" className="sr-only">
          Use the left and right arrow keys to turn the can, and Home to face it forward.
        </span>
        {!hinted && (
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full bg-teal px-4 py-2 text-sm text-cream motion-safe:animate-pulse">
            ← Drag to spin →
          </span>
        )}
      </div>

      {HOTSPOTS.map((h) => (
        <button
          key={h.id}
          ref={(el) => {
            dots.current[h.id] = el
          }}
          type="button"
          tabIndex={-1}
          aria-hidden
          // Only a real tap opens it: a drag or scroll that ends on the dot doesn't count.
          onPointerDown={(e) => {
            e.preventDefault()
            tap.current = { x: e.clientX, y: e.clientY }
          }}
          onClick={(e) => {
            const t = tap.current
            tap.current = null
            if (t && Math.hypot(e.clientX - t.x, e.clientY - t.y) <= 6) open(h.id)
          }}
          style={{ pointerEvents: 'none' }}
          className="fixed top-0 left-0 z-20 grid size-11 cursor-pointer place-items-center opacity-0 transition-opacity"
        >
          <span className="size-3 rounded-full bg-cream ring-4 ring-teal motion-safe:animate-pulse" />
        </button>
      ))}

      <div className="relative z-10 mt-6 max-w-xs md:mt-auto">
        <h3 className="text-sm font-medium">Label details</h3>
        <ul className="mt-2 space-y-2">
          {HOTSPOTS.map((h) => (
            <li key={h.id}>
              <button
                id={`hs-${h.id}`}
                type="button"
                aria-expanded={hotspot === h.id}
                onClick={() => open(hotspot === h.id ? null : h.id)}
                className="min-h-11 rounded-full border-2 border-teal px-4 text-sm font-medium"
              >
                {h.title}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {active && (
        <div
          role="region"
          aria-label={active.title}
          onKeyDown={(e) => e.key === 'Escape' && closeCallout()}
          className="fixed right-6 bottom-6 z-30 max-w-xs rounded-2xl bg-teal p-5 text-cream shadow-xl md:right-[8vw] md:bottom-[20vh]"
        >
          <p className="font-display text-2xl font-bold">{active.title}</p>
          <p className="mt-2 text-sm leading-relaxed">{active.text}</p>
          <button type="button" autoFocus onClick={closeCallout} className="mt-3 min-h-11 text-sm font-medium underline underline-offset-4">
            Close
          </button>
        </div>
      )}
    </section>
  )
}

/* ---------- 5. Build your four-pack ---------- */

export function Pack() {
  const { pack } = useSceneState()
  const [toast, setToast] = useState(false)
  const full = pack.length >= PACK_SIZE

  // Buttons that would vanish or disable under focus hand it on, so keyboard users never land on <body>.
  const focusFirstAdd = () => document.getElementById(`add-${FLAVORS[0].id}`)?.focus()

  const add = (id: FlavorId) => {
    if (full) return
    const next = [...pack, id]
    savePack(next)
    announce(`${flavorById(id).name} added. ${next.length} of ${PACK_SIZE}.`)
  }
  const removeAt = (i: number) => {
    const name = flavorById(pack[i]).name
    savePack(pack.filter((_, j) => j !== i))
    announce(`${name} removed. ${pack.length - 1} of ${PACK_SIZE}.`)
  }
  const removeOne = (id: FlavorId) => {
    const i = pack.lastIndexOf(id)
    if (i >= 0) removeAt(i)
  }
  const removeChip = (i: number) => {
    removeAt(i)
    requestAnimationFrame(() => {
      const chips = document.querySelectorAll<HTMLElement>('#pack-chips button')
      if (chips.length) chips[Math.min(i, chips.length - 1)].focus()
      else focusFirstAdd()
    })
  }
  const startOver = () => {
    savePack([])
    announce('Carrier emptied.')
    requestAnimationFrame(focusFirstAdd)
  }

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(false), 2500)
    return () => window.clearTimeout(t)
  }, [toast])

  const counts = FLAVORS.map((f) => ({ f, n: pack.filter((id) => id === f.id).length })).filter((c) => c.n)
  const total = pack.reduce((sum, id) => sum + flavorById(id).calories, 0)

  return (
    <section id="pack" className="flex min-h-svh flex-col px-6 pt-24 pb-14 text-teal md:flex-row md:items-center md:px-[6vw]">
      <div className="max-w-md md:w-[40%]">
        <Heading>Build your four‑pack.</Heading>
        <p className="mt-5 text-base leading-relaxed md:text-lg">Any mix. Four cans, one carrier.</p>

        <ul className="mt-8 space-y-2">
          {FLAVORS.map((f) => {
            const n = pack.filter((id) => id === f.id).length
            return (
              <li key={f.id} className="flex items-center justify-between gap-3 border-b border-teal/30 py-1">
                <span className="font-display text-xl font-bold">{f.name}</span>
                <span className="flex items-center gap-2">
                  <button type="button" aria-label={`Remove ${f.name}`} aria-disabled={!n} onClick={() => removeOne(f.id)} className="size-11 rounded-full border-2 border-teal aria-disabled:opacity-30">
                    −
                  </button>
                  <span className="w-4 text-center font-medium" aria-hidden>
                    {n}
                  </span>
                  <button type="button" id={`add-${f.id}`} aria-label={`Add ${f.name}`} aria-disabled={full} onClick={() => add(f.id)} className="size-11 rounded-full border-2 border-teal aria-disabled:opacity-30">
                    +
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
        <p className="mt-4 text-sm font-medium">
          {pack.length} of {PACK_SIZE}
          {full && <span>. Carrier's full.</span>}
        </p>
      </div>

      {/* The scene drops the cans into a carrier drawn over this box. */}
      <div id="pack-stage" aria-hidden className="mt-8 h-[40vh] md:mt-0 md:h-[60vh] md:flex-1" />
      <div className="md:w-[30%]">
        {pack.length === 0 ? (
          <p className="font-serif text-xl italic">Your carrier is empty. Pick a can to start.</p>
        ) : (
          <ul id="pack-chips" className="flex flex-wrap gap-2" aria-label="In your carrier">
            {pack.map((id, i) => (
              <li key={i}>
                <button type="button" onClick={() => removeChip(i)} className="min-h-11 rounded-full bg-teal px-4 text-sm text-cream">
                  Remove {flavorById(id).name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {full && (
          <div className="mt-6">
            <p className="leading-relaxed">
              Your pack: {counts.map(({ f, n }) => `${n} ${f.name}`).join(', ')}. {total} calories across four cans.
            </p>
            <div className="mt-4 flex gap-3">
              <button type="button" onClick={startOver} className="min-h-11 rounded-full border-2 border-teal px-4 text-sm font-medium">
                Start over
              </button>
              <button type="button" onClick={() => setToast(true)} className="min-h-11 rounded-full bg-teal px-4 text-sm font-medium text-cream">
                Save pack
              </button>
            </div>
          </div>
        )}
        <p role="status" className="mt-3 h-5 text-sm">
          {toast && "Saved. It'll be here next time."}
        </p>
      </div>
    </section>
  )
}
