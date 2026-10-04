import type { Metadata } from 'next'
import { Email, LegalPage } from '../legal'

export const metadata: Metadata = { title: 'Privacy policy | CarMart' }

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <p>This policy explains what personal data CarMart collects, why, and your rights under the Nigeria Data Protection Act 2023.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account:</strong> your email address, display name and password (stored encrypted).</li>
        <li><strong>Sellers:</strong> your shop details and a verified Nigerian mobile number. Your number is shown to buyers only if you choose to show it.</li>
        <li><strong>Listings and photos:</strong> the car details and photos you upload.</li>
        <li><strong>Messages:</strong> messages between buyers and sellers sent through CarMart.</li>
        <li><strong>Technical data:</strong> basic logs (such as IP address and browser) used to keep the service secure.</li>
      </ul>

      <h2>Photos and metadata</h2>
      <p>Photos are checked for authenticity before they appear. Location and camera details (EXIF metadata) are <strong>stripped from every public photo</strong>; the original upload is kept privately for checking and review only.</p>

      <h2>Why we use your data</h2>
      <ul>
        <li>To run CarMart: accounts, listings, search and messages.</li>
        <li>To keep it safe: verifying sellers, checking photos and handling reports.</li>
        <li>To send emails about your account and listings (for example, when a car goes live).</li>
      </ul>
      <p>We don’t sell your personal data.</p>

      <h2>Who processes it, and where</h2>
      <p>Our data is stored with Supabase in <strong>London, United Kingdom</strong>, and the website runs on Netlify. Photo checks use Anthropic and Sightengine, and emails are sent by Resend. These providers process data for us under their own security and privacy commitments. Because some processing happens outside Nigeria, we rely on the transfer safeguards allowed under the Nigeria Data Protection Act 2023.</p>

      <h2>How long we keep it</h2>
      <p>We keep account data while your account is open. Sold listings stop being public after 7 days. When you ask us to delete your account, we delete or anonymise your personal data unless the law requires us to keep it.</p>

      <h2>Your rights</h2>
      <p>You can ask to access, correct or delete your personal data, object to its use, or ask for a copy. Email <Email /> from the address on your account. You can also complain to the Nigeria Data Protection Commission.</p>
    </LegalPage>
  )
}
