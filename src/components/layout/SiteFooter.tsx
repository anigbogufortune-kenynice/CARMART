import Link from 'next/link'

const LINKS: [string, string][] = [
  ['/cars', 'Browse cars'], ['/sell', 'Sell a car'], ['/buyer-safety', 'Buyer safety'], ['/prohibited-listings', 'Prohibited listings'],
  ['/terms', 'Terms'], ['/privacy', 'Privacy'], ['/contact', 'Contact'],
]

/** Site-wide footer: navigation, the buy-safely reminder and the copyright line. */
export function SiteFooter() {
  return (
    <footer className="border-t border-[#DDE3EC] bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[1fr_2fr]">
        <div>
          <p className="text-lg font-semibold text-[#14284B]" style={{ fontFamily: "'Archivo Variable', var(--font-geist-sans), sans-serif", fontStretch: '125%' }}>CarMart</p>
          <nav aria-label="Footer" className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#425066]">
            {LINKS.map(([href, label]) => <Link key={href} href={href} className="hover:underline">{label}</Link>)}
          </nav>
        </div>
        <div className="text-sm leading-relaxed text-[#5A6578]">
          <p>Buy safely: inspect the car and its papers in person, and only pay once you’re satisfied. CarMart never asks you to pay a deposit through the site.</p>
          <p className="mt-3">© {new Date().getFullYear()} CarMart. Cars only, from verified Nigerian sellers.</p>
        </div>
      </div>
    </footer>
  )
}
