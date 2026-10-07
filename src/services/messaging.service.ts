import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { err, ok, type AppError, type Page, type Result } from '@/types/result'

/**
 * Buyer ↔ seller messaging (docs/api-contracts.md → Conversations and messages). Guards live in
 * security-definer RPCs; reads go through RLS (participants only).
 */

export const MessageBodySchema = z.string().trim().min(1, 'Write a message').max(2000, 'Keep it under 2,000 characters')

const PAGE_SIZE = 24
const MESSAGE_PAGE = 50

export type Message = { id: string; conversation_id: string; sender_id: string; body: string; read_at: string | null; created_at: string }
export type ConversationSummary = {
  id: string; listing_id: string; listing_title: string; other_party: string; role: 'buyer' | 'seller'
  unread_count: number; blocked: boolean; last_message_at: string
  last_message: { body: string; created_at: string; mine: boolean } | null
}

const MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: 'Sign in to message sellers',
  NOT_FOUND: 'Conversation not found',
  OWN_LISTING: 'This is your own listing',
  FORBIDDEN: 'Your account can’t send messages right now',
  CONVERSATION_BLOCKED: 'This conversation has been blocked',
  CONVERSATION_LIMIT: 'You’ve started the maximum number of new conversations for today. Try again tomorrow.',
  VALIDATION_ERROR: 'Messages must be 1 to 2,000 characters',
}

function rpcError(error: PostgrestError, notFound = 'Conversation not found'): AppError {
  const code = Object.keys(MESSAGES).find((c) => error.message === c)
  if (!code) return { code: 'INTERNAL_ERROR', message: error.message }
  return { code, message: code === 'NOT_FOUND' ? notFound : MESSAGES[code] }
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

/** The caller's threads (buyer or seller side), newest activity first, with unread counts. */
export async function listConversations(db: SupabaseClient, page: number): Promise<Result<Page<ConversationSummary>, AppError>> {
  const { data, error } = await db.rpc('my_conversations', { p_page: page, p_page_size: PAGE_SIZE })
  if (error) return err({ code: 'INTERNAL_ERROR', message: error.message })
  const result = data as { total: number; items: ConversationSummary[] }
  return ok({ items: result.items, page: { number: page, size: PAGE_SIZE, total: result.total } })
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
