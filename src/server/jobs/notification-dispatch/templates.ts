import { err, ok, type AppError, type Result } from '@/types/result'

/**
 * Email templates for the outbox (ADR-010). Each feature issue adds its own kinds.
 * Payload values are escaped for HTML; links use NEXT_PUBLIC_SITE_URL.
 */
export type RenderedEmail = { subject: string; text: string; html: string }
type Payload = Record<string, unknown>
type Template = (p: Payload, site: string) => { subject: string; lines: string[]; link: { href: string; label: string } }

const str = (v: unknown) => (v === undefined || v === null ? '' : String(v))

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
