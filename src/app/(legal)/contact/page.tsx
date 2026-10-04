import type { Metadata } from 'next'
import Link from 'next/link'
import { Email, LegalPage } from '../legal'

export const metadata: Metadata = { title: 'Contact | CarMart' }

export default function ContactPage() {
  return (
    <LegalPage title="Contact us">
      <p>Email <Email /> and we’ll reply as soon as we can.</p>
      <h2>Before you write</h2>
      <ul>
        <li>About a car: contact the seller from the car’s page. CarMart doesn’t sell cars itself.</li>
        <li>A listing looks fake: use <strong>Report</strong> on the listing, or tell us the link.</li>
        <li>Your data: see our <Link href="/privacy">Privacy policy</Link> for access and deletion requests.</li>
      </ul>
    </LegalPage>
  )
}
