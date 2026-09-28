export type AppError = {
  code: string
  message: string
}

export type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E }

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value })

export const err = <E = AppError>(error: E): Result<never, E> => ({ ok: false, error })
