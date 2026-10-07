import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { err, ok, type AppError, type Page, type Result } from '@/types/result'

/**
 * Buyer ↔ seller messaging (docs/api-contracts.md → Conversations and messages). Guards live in
 * security-definer RPCs; reads go through RLS (participants only).
 */

const MessageBodySchema = z.string().trim().min(1, 'Write a message').max(2000, 'Keep it under 2,000 characters')

const PAGE_SIZE = 24
const MESSAGE_PAGE = 50

export type Message = { id: string; conversation_id: string; sender_id: string; body: string; read_at: string | null; created_at: string }
export type ConversationRole = 'buyer' | 'seller'
export type ConversationSummary = {
  id: string; listing_id: string; listing_title: string; listing_status: string; thumbnail_url: string | null
  other_party: string; role: ConversationRole; unread_count: number; blocked: boolean; last_message_at: string
  last_message: { body: string; created_at: string; mine: boolean } | null
}
type ConversationRow = Omit<ConversationSummary, 'thumbnail_url'> & { thumbnail_path: string | null }

const PUBLIC_BUCKET = 'listing-public'

const MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: 'Sign in to message sellers',
  NOT_FOUND: 'Conversation not found',
  OWN_LISTING: 'This is your own listing',
  FORBIDDEN: 'Your account can’t send messages right now',
  CONVERSATION_BLOCKED: 'This conversation is blocked',
  CONVERSATION_LIMIT: 'You’ve started the maximum number of new conversations for today. Try again tomorrow.',
  RATE_LIMITED: 'You’re sending messages too quickly. Wait a little, then try again.',
  VALIDATION_ERROR: 'Messages must be 1 to 2,000 characters',
}

function rpcError(error: PostgrestError, notFound = 'Conversation not found'): AppError {
  const code = Object.keys(MESSAGES).find((c) => error.message === c)
  if (!code) return { code: 'INTERNAL_ERROR', message: error.message }
  return { code, message: code === 'NOT_FOUND' ? notFound : MESSAGES[code] }
}

function toSummary(db: SupabaseClient, { thumbnail_path, ...row }: ConversationRow): ConversationSummary {
  return { ...row, thumbnail_url: thumbnail_path ? db.storage.from(PUBLIC_BUCKET).getPublicUrl(thumbnail_path).data.publicUrl : null }
}

function validBody(body: string): Result<string, AppError> {
  const parsed = MessageBodySchema.safeParse(body)
  return parsed.success ? ok(parsed.data) : err({ code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? MESSAGES.VALIDATION_ERROR })
}

/** Start (or continue) the caller's thread about a live listing; `created` is false when it existed. */
export async function startConversation(
  db: SupabaseClient, listingId: string, body: string,
): Promise<Result<{ conversation_id: string; created: boolean }, AppError>> {
  const text = validBody(body)
  if (!text.ok) return text
  const { data, error } = await db.rpc('start_conversation', { p_listing_id: listingId, p_body: text.value })
  if (error) return err(rpcError(error, 'Listing not found'))
  const row = (data as { conversation_id: string; created: boolean }[])[0]
  return ok({ conversation_id: row.conversation_id, created: row.created })
}

export async function sendMessage(db: SupabaseClient, conversationId: string, body: string): Promise<Result<Message, AppError>> {
  const text = validBody(body)
  if (!text.ok) return text
  const { data, error } = await db.rpc('send_message', { p_conversation_id: conversationId, p_body: text.value })
  if (error) return err(rpcError(error))
  return ok(data as Message)
}

/**
 * The caller's threads, newest activity first, with unread counts and the listing thumbnail.
 * `role` narrows to the buyer inbox or the seller inbox; omitted, both.
 */
export async function listConversations(
  db: SupabaseClient, page: number, role?: ConversationRole,
): Promise<Result<Page<ConversationSummary>, AppError>> {
  const { data, error } = await db.rpc('my_conversations', { p_page: page, p_page_size: PAGE_SIZE, p_role: role ?? null })
  if (error) return err({ code: 'INTERNAL_ERROR', message: error.message })
  const result = data as { total: number; items: ConversationRow[] }
  return ok({
    items: result.items.map((row) => toSummary(db, row)),
    page: { number: page, size: PAGE_SIZE, total: result.total },
  })
}

/** One of the caller's threads (header info for the thread page); NOT_FOUND for non-participants. */
export async function getConversation(db: SupabaseClient, conversationId: string): Promise<Result<ConversationSummary, AppError>> {
  const { data, error } = await db.rpc('my_conversations', { p_page: 1, p_page_size: 1, p_conversation_id: conversationId })
  if (error) return err({ code: 'INTERNAL_ERROR', message: error.message })
  const row = (data as { items: ConversationRow[] }).items[0]
  if (!row) return err({ code: 'NOT_FOUND', message: 'Conversation not found' })
  return ok(toSummary(db, row))
}

/** Block a thread (either participant). Nobody can send in it afterwards; both can still read it. */
export async function blockConversation(db: SupabaseClient, conversationId: string): Promise<Result<null, AppError>> {
  const { error } = await db.rpc('block_conversation', { p_conversation_id: conversationId })
  return error ? err(rpcError(error)) : ok(null)
}

export type UnreadCount = { total: number; buyer: number; seller: number }

/** Unread incoming messages across the caller's threads, split by side (one query; header badge). */
export async function unreadCount(db: SupabaseClient): Promise<Result<UnreadCount, AppError>> {
  const { data, error } = await db.rpc('my_unread_count')
  if (error) return err({ code: 'INTERNAL_ERROR', message: error.message })
  const { buyer, seller } = data as { buyer: number; seller: number }
  return ok({ total: buyer + seller, buyer, seller })
}

/**
 * The seller's verified phone for a live listing whose shop opted in (show_phone). Signed in only:
 * visitors get UNAUTHENTICATED when a number exists, PHONE_NOT_AVAILABLE otherwise.
 */
export async function getShopPhone(db: SupabaseClient, listingId: string): Promise<Result<{ phone: string }, AppError>> {
  const { data, error } = await db.rpc('listing_phone', { p_listing_id: listingId })
  if (!error) return ok({ phone: data as string })
  if (error.message === 'UNAUTHENTICATED') return err({ code: 'UNAUTHENTICATED', message: 'Sign in to see the phone number' })
  if (error.message === 'PHONE_NOT_AVAILABLE') return err({ code: 'PHONE_NOT_AVAILABLE', message: 'This seller’s phone number isn’t available' })
  return err({ code: 'INTERNAL_ERROR', message: error.message })
}

/**
 * A thread's messages, oldest first: the latest 50, or the 50 before `before`. Marks the other
 * party's messages as read.
 */
export async function listMessages(
  db: SupabaseClient, conversationId: string, opts: { before?: string },
): Promise<Result<Message[], AppError>> {
  let query = db.from('messages').select('id,conversation_id,sender_id,body,read_at,created_at')
    .eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(MESSAGE_PAGE)
  if (opts.before) query = query.lt('created_at', opts.before)
  const [{ data, error }, { data: conv }] = await Promise.all([
    query,
    db.from('conversations').select('id').eq('id', conversationId).maybeSingle(),
  ])
  if (error) return err({ code: 'INTERNAL_ERROR', message: error.message })
  if (!conv) return err({ code: 'NOT_FOUND', message: 'Conversation not found' })
  const { error: readError } = await db.rpc('mark_conversation_read', { p_conversation_id: conversationId })
  if (readError) return err(rpcError(readError))
  return ok(((data ?? []) as Message[]).reverse())
}
