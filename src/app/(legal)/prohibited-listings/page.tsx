import type { Metadata } from 'next'
import { LegalPage } from '../legal'
import { BODY_TYPES, BODY_TYPE_LABELS } from '@/types/domain'

export const metadata: Metadata = { title: 'Prohibited listings | CarMart' }

export default function ProhibitedListingsPage() {
  return (
    <LegalPage title="Prohibited listings">
      <h2>Cars only</h2>
      <p>CarMart is for cars. You can list these body types: {BODY_TYPES.map((b) => BODY_TYPE_LABELS[b]).join(', ')}.</p>
      <p><strong>Not allowed:</strong></p>
      <ul>
        <li>Trucks, lorries, tippers and other commercial vehicles</li>
        <li>Large buses and coaches (small minivans for passengers are fine)</li>
        <li>Motorbikes, tricycles (keke) and scooters</li>
        <li>Caravans, trailers and boats</li>
        <li>Car parts, accessories or anything that isn’t a whole car</li>
        <li>Cars you don’t own or have no right to sell, stolen cars, or cars with false papers</li>
      </ul>

      <h2>Real photos of the actual car</h2>
      <ul>
        <li>Every photo must show the actual car you are selling, taken by you or for you.</li>
        <li><strong>AI-generated images, stock photos, or photos copied from other listings or websites are prohibited.</strong></li>
        <li>No screenshots, photos of screens or printed pictures, and no photos with phone numbers or adverts drawn on them.</li>
      </ul>

      <h2>Honest details</h2>
      <p>The price, kilometres, condition (brand new, foreign used or Nigerian used), VIN and location must be true.</p>

      <h2>What happens if rules are broken</h2>
      <p>Photos that break these rules are rejected automatically or after review. Listings may be removed, and shops or accounts that break the rules, especially with fake or AI-generated photos, may be suspended.</p>
    </LegalPage>
  )
}
