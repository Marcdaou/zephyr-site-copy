export function Header({ dark }: { dark: boolean }) {
  return (
    <header
      className={`fixed inset-x-0 top-0 z-30 flex items-center justify-between px-6 py-5 transition-colors duration-500 md:px-[6vw] ${
        dark ? 'text-cream' : 'text-teal'
      }`}
    >
      <a href="#hero" className="font-display text-2xl font-extrabold tracking-wide">
        ZEPHYR
      </a>
      <nav className="flex gap-6 text-sm font-medium md:gap-10 md:text-base">
        <a href="#fruit" className="underline-offset-4 hover:underline">
          What's inside
        </a>
        <a href="#lineup" className="underline-offset-4 hover:underline">
          Flavors
        </a>
      </nav>
    </header>
  )
}
