import type { ReactNode } from 'react'
import { FLAVORS, HERO_FLAVOR } from '../data'
import { useSceneState } from '../scene/state'
import { CanPicker, TiltChip } from './Features'

// Sits beneath the WebGL canvas so the can stands in front of the wordmark, like the label.
export function HeroWordmark() {
  return (
    <div className="absolute inset-x-0 top-0 z-0 grid h-svh place-items-center overflow-hidden">
      <h1 className="wordmark-shadow font-display text-[27vw] leading-none font-extrabold tracking-[-0.01em] text-teal select-none">
        ZEPHYR
        <span className="sr-only"> Yuzu + Ginger sparkling botanical soda</span>
      </h1>
    </div>
  )
}

export function Hero() {
  return (
    <section id="hero" className="flex min-h-svh items-end px-6 pb-10 md:px-[6vw] md:pb-12">
      <div className="flex w-full flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-md">
          <p className="font-serif text-3xl italic md:text-5xl">Born on the west wind.</p>
          <p className="mt-3 text-base leading-relaxed md:text-lg">
            Yuzu and fresh-pressed ginger, sparkling. Made in small batches on the West Coast.
          </p>
        </div>
        <div className="flex flex-col gap-3 md:items-end">
          <TiltChip />
          <p className="text-sm font-medium">Scroll to open a can</p>
        </div>
      </div>
    </section>
  )
}

function Story({
  id,
  side,
  className = '',
  children,
}: {
  id: string
  side: 'left' | 'right'
  className?: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      className={`flex min-h-svh items-end px-6 pt-28 pb-14 md:items-center md:px-[8vw] md:py-24 ${
        side === 'right' ? 'md:justify-end' : ''
      } ${className}`}
    >
      <div className="w-full max-w-md md:w-[38%]">{children}</div>
    </section>
  )
}

function Heading({ children }: { children: ReactNode }) {
  return <h2 className="font-display text-5xl leading-[0.92] font-extrabold md:text-7xl">{children}</h2>
}

function Body({ children }: { children: ReactNode }) {
  return <p className="mt-5 text-base leading-relaxed md:text-lg">{children}</p>
}

export function Fruit() {
  return (
    <Story id="fruit" side="left" className="text-teal">
      <Heading>Real yuzu, from the hills of Kōchi.</Heading>
      <Body>
        Yuzu grows in the mountain groves of Kōchi, Japan. It tastes somewhere between mandarin, lime and grapefruit,
        and every can carries the real juice, not a flavoring standing in for it.
      </Body>
      <dl className="mt-8 grid grid-cols-2 gap-6 border-t-2 border-teal pt-4">
        <div>
          <dt className="text-sm">In every can</dt>
          <dd className="font-display text-2xl font-bold">2% yuzu juice</dd>
        </div>
        <div>
          <dt className="text-sm">Grown in</dt>
          <dd className="font-display text-2xl font-bold">Kōchi, Japan</dd>
        </div>
      </dl>
    </Story>
  )
}

const TASTE = FLAVORS.find((f) => f.id === HERO_FLAVOR)!.taste

export function Ginger() {
  return (
    <Story id="ginger" side="right" className="text-cream">
      <Heading>Then the ginger kicks in.</Heading>
      <Body>
        Fresh-pressed ginger root brings a slow, warm bite at the back of the throat. Just enough to keep the citrus
        honest.
      </Body>
      <div className="mt-8">
        <p className="text-sm">How it tastes, out of five</p>
        <ul className="mt-3 space-y-2">
          {TASTE.map(([name, score]) => (
            <li key={name} className="grid grid-cols-[4.5rem_1fr] items-center">
              <span className="font-display text-xl font-bold">{name}</span>
              <span className="flex gap-1.5" aria-label={`${score} out of 5`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <span
                    key={i}
                    className={`size-3.5 rounded-full border-2 border-cream ${i < score ? 'bg-cream' : ''}`}
                  />
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Story>
  )
}

export function Bubbles() {
  return (
    <Story id="bubbles" side="left" className="text-cream">
      <Heading>Crack it open.</Heading>
      <Body>
        Fine, lively bubbles and nothing poured from a syrup jug. Straight from the fridge it tastes like a cool breeze
        off the coast.
      </Body>
      <p className="mt-6 font-serif text-xl italic md:text-2xl">Best at 38°F, over ice or from the can.</p>
    </Story>
  )
}

const NUTRITION: { name: string; amount: string; dv?: string; indent?: boolean }[] = [
  { name: 'Sodium', amount: '15mg', dv: '1%' },
  { name: 'Total carbohydrate', amount: '11g', dv: '4%' },
  { name: 'Total sugars', amount: '10g', indent: true },
  { name: 'Includes added sugars', amount: '10g', dv: '20%', indent: true },
  { name: 'Potassium', amount: '40mg' },
]

export function Label() {
  return (
    <Story id="label" side="right" className="text-teal">
      <Heading>It's all on the back.</Heading>
      <Body>Cane sugar, real juice and ginger root. Nothing artificial, and 45 calories a can.</Body>
      <div className="mt-6 max-w-xs border-2 border-teal px-4 py-3">
        <p className="font-display text-3xl leading-none font-extrabold">Nutrition Facts</p>
        <p className="border-b border-teal pt-1 pb-2 text-sm">1 serving per can (355 mL)</p>
        <div className="flex items-end justify-between border-b-8 border-teal py-1">
          <span className="font-display text-2xl font-bold">Calories</span>
          <span className="font-display text-4xl leading-none font-extrabold">45</span>
        </div>
        <p className="border-b border-teal py-1 text-right text-xs font-medium">% Daily Value</p>
        <dl className="text-sm">
          {NUTRITION.map((row) => (
            <div key={row.name} className={`flex justify-between border-b border-teal/40 py-1 ${row.indent ? 'pl-4' : ''}`}>
              <dt>
                {row.name} <span className="font-medium">{row.amount}</span>
              </dt>
              <dd className="font-medium">{row.dv}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="mt-4 max-w-xs text-sm leading-relaxed">
        Ingredients: carbonated water, cane sugar, yuzu juice (2%), ginger root extract, citric acid, natural flavors.
      </p>
    </Story>
  )
}

export function Lineup() {
  // Steps aside while a can is picked, so the grown can and the panel have the stage to themselves.
  const { picked } = useSceneState()
  return (
    <section id="lineup" className="relative min-h-svh px-6 pt-24 text-center text-teal md:px-[6vw]">
      <div aria-hidden={picked !== null} className={`transition-opacity duration-200 ${picked ? 'opacity-0' : ''}`}>
      <h2 className="font-display text-5xl leading-[0.92] font-extrabold md:text-6xl">Four flavors, one west wind.</h2>
      <p className="mx-auto mt-4 max-w-md text-base leading-relaxed md:text-lg">
        Each is built on real fruit juice and a single botanical.
      </p>
      </div>
      {/* The podium labels are drawn in the 3D scene; this list is what screen readers get. */}
      <ul className="sr-only">
        {FLAVORS.map((f) => (
          <li key={f.id}>
            {f.name}: {f.tagline} {f.calories} calories.
          </li>
        ))}
      </ul>
      <div className="absolute inset-x-0 bottom-4 px-6">
        <CanPicker />
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="relative z-20 px-6 pt-16 pb-10 text-teal md:px-[6vw]">
      <div className="flex flex-col gap-8 border-t-2 border-teal pt-8 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="font-display text-4xl font-extrabold">ZEPHYR</p>
          <p className="mt-2 max-w-xs font-serif italic">Sparkling botanical soda, made in small batches since 2026.</p>
        </div>
        <ul className="space-y-1 text-sm">
          {FLAVORS.map((f) => (
            <li key={f.id}>{f.name}</li>
          ))}
        </ul>
        <p className="max-w-xs text-sm leading-relaxed">
          12 fl oz cans. Crafted on the West Coast.
          <br />© 2026 Zephyr Beverage Co.
        </p>
      </div>
    </footer>
  )
}
