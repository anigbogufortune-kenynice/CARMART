import type { Metadata } from 'next'
import { Email, LegalPage } from '../legal'

export const metadata: Metadata = { title: 'Buyer safety | CarMart' }

export default function BuyerSafetyPage() {
  return (
    <LegalPage title="Buyer safety">
      <p>Every CarMart seller is verified and every photo is checked, but you should still protect yourself. These steps help.</p>

      <h2>Inspect before you pay</h2>
      <ul>
        <li>See the car in person, in daylight, ideally with a mechanic you trust. Take a test drive.</li>
        <li>Meet at the seller’s shop or a busy public place. Take someone with you.</li>
      </ul>

      <h2>Check the VIN and the papers</h2>
      <ul>
        <li>Every listing shows the car’s VIN. Check that it matches the VIN on the car (usually on the dashboard and the door frame) and on the papers.</li>
        <li>For a foreign-used (Tokunbo) car, get a history report for the VIN (for example from Carfax) and check the customs duty papers.</li>
        <li>Ask for proof of ownership, the vehicle licence and the plate number details, and make sure the names match the seller.</li>
      </ul>

      <h2>Pay safely</h2>
      <ul>
        <li><strong>Never pay a deposit to someone you haven’t met, or to anyone who contacts you away from CarMart.</strong></li>
        <li>CarMart never asks you to pay through the site and never takes deposits.</li>
        <li>Be wary of prices far below the market, pressure to pay quickly, or a seller who won’t let you see the car.</li>
        <li>Pay by a traceable method and get a signed receipt and the transfer papers.</li>
      </ul>

      <h2>Report a problem</h2>
      <p>If a listing looks fake or a seller asks for money upfront, use <strong>Report</strong> on the listing, or email <Email />. Our team reviews every report.</p>
    </LegalPage>
  )
}
