// Section ids, in scroll order. The hero can has one pose per section (see scene/HeroCan.tsx).
export const SECTIONS = ['hero', 'fruit', 'ginger', 'bubbles', 'exploded', 'label', 'turn', 'lineup', 'pack'] as const
export type SectionId = (typeof SECTIONS)[number]

// Page colour behind each section; the frame loop blends between neighbours.
export const SECTION_BG: Record<SectionId, string> = {
  hero: '#F2B705',
  fruit: '#F4C430',
  ginger: '#B9461A',
  bubbles: '#0F3F49',
  exploded: '#123A44',
  label: '#D6E5E1',
  turn: '#EDE6D6',
  lineup: '#B8A795',
  pack: '#C9B89F',
}

// Whether the fixed header should use light ink over that section.
export const SECTION_DARK: Record<SectionId, boolean> = {
  hero: false,
  fruit: false,
  ginger: true,
  bubbles: true,
  exploded: true,
  label: false,
  turn: false,
  lineup: false,
  pack: false,
}

export type FlavorId = 'lime' | 'yuzu' | 'blood' | 'grapefruit'

export interface Flavor {
  id: FlavorId
  name: string
  tagline: string
  calories: number
  labelColor: string // label background, used on the pedestal band
  story: string
  serve: string
  taste: [string, number][] // out of five, shown in the flavour panel
}

// Podium order matches the lineup render: lime, yuzu, blood orange, grapefruit.
export const FLAVORS: Flavor[] = [
  { id: 'lime', name: 'Key Lime + Mint', tagline: 'Cool shade, sharp zest.', calories: 40, labelColor: '#103A28',
    story: 'Picked when the limes are still green and loud. Fresh mint from the garden row softens the edge, so every sip feels like stepping into shade.',
    serve: 'Best with a lime wheel, very cold.',
    taste: [['Citrus', 5], ['Spice', 1], ['Sweet', 2]],
  },
  { id: 'yuzu', name: 'Yuzu + Ginger', tagline: 'Born on the west wind.', calories: 45, labelColor: '#0F3F49',
    story: 'Real yuzu from the hills of Kōchi meets fresh-pressed ginger root. Bright first, warm after, carried in on the west wind.',
    serve: 'Best at 38°F, over ice or from the can.',
    taste: [['Citrus', 5], ['Spice', 3], ['Sweet', 2]],
  },
  { id: 'blood', name: 'Blood Orange + Hibiscus', tagline: 'Sunset, bottled.', calories: 50, labelColor: '#43132C',
    story: 'Sicilian blood oranges and steeped hibiscus petals, the color of the last hour of light. Juicy up front, gently floral at the finish.',
    serve: 'Best on a warm evening, over ice.',
    taste: [['Citrus', 4], ['Spice', 1], ['Sweet', 4]],
  },
  { id: 'grapefruit', name: 'Pink Grapefruit + Rosemary', tagline: 'Bittersweet, by design.', calories: 45, labelColor: '#1B285A',
    story: 'Ruby grapefruit for the bitter-bright bite, a sprig of rosemary for something to think about. Grown-up, never sweet for the sake of it.',
    serve: 'Best with dinner, or instead of it.',
    taste: [['Citrus', 4], ['Spice', 2], ['Sweet', 2]],
  },
]

export const HERO_FLAVOR: FlavorId = 'yuzu'

export const modelUrl = (id: FlavorId) => `/models/zephyr_${id}.glb`
