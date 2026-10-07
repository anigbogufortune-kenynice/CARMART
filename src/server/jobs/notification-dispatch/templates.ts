import { formatDate } from '@/lib/format'
import { err, ok, type AppError, type Result } from '@/types/result'

/**
 * Email templates for the outbox (ADR-010). Each feature issue adds its own kinds.
 * Payload values are escaped for HTML; links use NEXT_PUBLIC_SITE_URL.
 */
export type RenderedEmail = { subject: string; text: string; html: string }
type Payload = Record<string, unknown>
type Template = (p: Payload, site: string) => { subject: string; lines: string[]; link: { href: string; label: string } }

const str = (v: unknown) => (v === undefined || v === null ? '' : String(v))

const PREVIEW_CHARS = 200
const preview = (v: unknown) => {
  const t = str(v).trim()
  return t.length > PREVIEW_CHARS ? `${t.slice(0, PREVIEW_CHARS)}…` : t
}

const TEMPLATES: Record<string, Template> = {
  shop_approved: (p, site) => ({
    subject: `Your shop ${str(p.shopName)} is live on CarMart`,
    lines: [
      `Good news: ${str(p.shopName)} has been approved and is now visible to buyers.`,
      'You can now submit car listings. Each photo is checked automatically before it goes live.',
    ],
    link: { href: `${site}/shops/${str(p.slug)}`, label: 'View your shop' },
  }),
  shop_rejected: (p, site) => ({
    subject: `Your shop ${str(p.shopName)} needs changes`,
    lines: [
      `We couldn't approve ${str(p.shopName)} yet.`,
      `Reason: ${str(p.reason)}`,
      'Update your shop details and submit it again.',
    ],
    link: { href: `${site}/sell`, label: 'Update your shop' },
  }),
  listing_live: (p, site) => ({
    subject: `Your ${str(p.title)} is live on CarMart`,
    lines: [
      `Good news: every photo passed our checks and your ${str(p.title)} is now visible to buyers.`,
      'It stays live for 60 days. We’ll remind you before it expires.',
    ],
    link: { href: `${site}/cars/${str(p.listingId)}`, label: 'See your listing' },
  }),
  listing_rejected: (p, site) => {
    const photos = Array.isArray(p.photos) ? (p.photos as { position?: unknown; reason?: unknown }[]) : []
    return {
      subject: `Your ${str(p.title)} needs new photos`,
      lines: [
        `We couldn’t publish your ${str(p.title)} because some photos didn’t pass our checks.`,
        ...photos.map((ph) => `Photo ${str(ph.position)}: ${str(ph.reason)}`),
        'Delete or replace those photos, then submit the listing again.',
      ],
      link: { href: `${site}/sell/listings/${str(p.listingId)}`, label: 'Fix your listing' },
    }
  },
  listing_expiring: (p, site) => {
    const when = p.expiresAt ? formatDate(str(p.expiresAt)) : 'soon'
    return {
      subject: `Your ${str(p.title)} expires on ${when}`,
      lines: [
        `Your ${str(p.title)} listing expires on ${when}.`,
        'Sold it already? Mark it as sold. Still selling? After it expires you can renew it for another 60 days.',
      ],
      link: { href: `${site}/sell/listings/${str(p.listingId)}`, label: 'Manage your listing' },
    }
  },
  new_message: (p, site) => {
    const car = p.recipientRole === 'seller' ? `your ${str(p.title)}` : `the ${str(p.title)}`
    return {
      subject: `New message about ${car}`,
      lines: [`${str(p.senderName)} sent you a message about ${car}:`, `“${preview(p.preview)}”`],
      link: { href: `${site}${str(p.path)}`, label: 'Read and reply' },
    }
  },
  listing_in_review: (p, site) => ({
    subject: `Your ${str(p.title)} is being reviewed`,
    lines: [
      `Our team is taking a closer look at your ${str(p.title)} before it goes live.`,
      'This usually takes less than a day. We’ll email you when it’s done.',
    ],
    link: { href: `${site}/sell/listings/${str(p.listingId)}`, label: 'View your listing' },
  }),
}

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

export function render(kind: string, payload: Payload): Result<RenderedEmail, AppError> {
  const template = TEMPLATES[kind]
  if (!template) return err({ code: 'UNKNOWN_TEMPLATE', message: `No email template for kind "${kind}"` })
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  const { subject, lines, link } = template(payload, site)
  const text = [...lines, '', `${link.label}: ${link.href}`, '', '— CarMart'].join('\n')
  const html = [
    '<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#111">',
    ...lines.map((l) => `<p>${escape(l)}</p>`),
    `<p><a href="${escape(link.href)}" style="color:#111">${escape(link.label)}</a></p>`,
    '<p style="color:#666">— CarMart</p>',
    '</div>',
  ].join('')
  return ok({ subject, text, html })
}
