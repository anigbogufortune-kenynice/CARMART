import Link from 'next/link'

/** CarMart home (until the search-led home page in issue 027). */

const STEPS = [
  {
    title: 'Open a shop',
    body: 'Tell us where you sell from and verify your Australian mobile. Our team approves every shop before it goes public.',
  },
  {
    title: 'Add the car and its photos',
    body: 'Enter the make, model, VIN and price, then upload 4 to 20 photos. Each photo is checked: it has to be a real photo of a car, not AI-made and not taken from another seller.',
  },
  {
    title: 'It goes live',
    body: 'When every photo passes, the listing goes live on its own, usually within a minute. Photo details like GPS location are removed before anyone sees them.',
  },
]

/** The page's one bold element: an Australian-style number plate carrying the brand. */
function NumberPlate() {
  return (
    <figure aria-hidden className="mx-auto w-full max-w-[19rem] rotate-[-2deg] select-none sm:max-w-[26rem]">
      <div className="rounded-[1.25rem] bg-[#12355B] p-2 shadow-[0_18px_40px_-18px_rgba(18,53,91,0.55)]">
        <div className="rounded-[0.9rem] border-[3px] border-[#12355B] bg-[#F2C230] overflow-hidden px-4 pb-3 pt-4 text-center sm:px-6 text-[#12355B] ring-2 ring-inset ring-[#F7D75E]">
          <p className="text-[0.7rem] font-semibold tracking-[0.3em] sm:text-[0.8rem]">VERIFIED SELLER</p>
          <p className="my-1 whitespace-nowrap text-[2.5rem] font-black leading-none tracking-[0.08em] sm:text-[3.5rem]">CARMART</p>
          <p className="text-[0.7rem] font-semibold tracking-[0.3em] sm:text-[0.8rem]">AUSTRALIA</p>
        </div>
      </div>
    </figure>
  )
}

export default function Home() {
  return (
    <main className="overflow-x-hidden bg-[#F6F7F5] text-[#2A3138]">
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-14 md:grid-cols-[1.1fr_1fr] md:pt-20">
        <div className="max-w-xl">
          <h1 className="text-[2.6rem] font-bold leading-[1.08] tracking-tight text-[#12355B] sm:text-[3.4rem]">
            Cars from verified Australian sellers, with real photos only.
          </h1>
          <p className="mt-5 max-w-[34rem] text-lg leading-relaxed text-[#5E6670]">
            CarMart sells cars and nothing else. Every shop is approved by our team, and every photo is checked before
            buyers see it, so what you see is the actual car.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/sell"
              className="rounded-lg bg-[#12355B] px-5 py-3 font-semibold text-white hover:bg-[#0E2B4A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#12355B]">
              Start selling
            </Link>
            <Link href="/sign-up"
              className="rounded-lg border border-[#B9C0C7] bg-white px-5 py-3 font-semibold text-[#12355B] hover:border-[#12355B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#12355B]">
              Create an account
            </Link>
          </div>
        </div>
        <NumberPlate />
      </section>

      <section className="border-t border-[#D9DDE1] bg-white" aria-labelledby="how-heading">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 id="how-heading" className="text-2xl font-bold tracking-tight text-[#12355B]">How a car gets on CarMart</h2>
          <ol aria-label="How a car gets on CarMart" className="mt-10 grid gap-10 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="relative pl-14">
                <span aria-hidden
                  className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-md border-2 border-[#12355B] bg-[#F2C230] text-lg font-black text-[#12355B]">
                  {i + 1}
                </span>
                <h3 className="text-lg font-semibold text-[#12355B]">{step.title}</h3>
                <p className="mt-2 max-w-[22rem] leading-relaxed text-[#5E6670]">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="rounded-xl border border-[#D9DDE1] bg-white px-6 py-6 sm:flex sm:items-center sm:justify-between sm:gap-8">
          <div>
            <h2 className="text-lg font-semibold text-[#12355B]">Looking to buy?</h2>
            <p className="mt-1 max-w-[40rem] text-[#5E6670]">
              Car search opens soon. Sellers are adding cars now, and each listing shows the VIN so you can run a PPSR
              check before you buy.
            </p>
          </div>
          <Link href="/sign-up" className="mt-4 inline-block font-semibold text-[#12355B] underline underline-offset-4 sm:mt-0">
            Create a free account
          </Link>
        </div>
      </section>
    </main>
  )
}
