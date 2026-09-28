/** Structured JSON logger: one line per entry (docs/architecture.md → Observability). */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
type Fields = Record<string, unknown>

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

export type Logger = Record<LogLevel, (msg: string, fields?: Fields) => void>

export function createLogger(opts: { level?: LogLevel; write?: (line: string) => void } = {}): Logger {
  const min = ORDER[opts.level ?? 'info']
  const write = opts.write ?? ((line: string) => process.stdout.write(line + '\n'))
  const log = (level: LogLevel) => (msg: string, fields: Fields = {}) => {
    if (ORDER[level] < min) return
    write(JSON.stringify({ level, msg, time: new Date().toISOString(), ...fields }))
  }
  return { debug: log('debug'), info: log('info'), warn: log('warn'), error: log('error') }
}

const envLevel = process.env.LOG_LEVEL
export const logger: Logger = createLogger({
  level: envLevel === 'debug' || envLevel === 'warn' || envLevel === 'error' ? envLevel : 'info',
})
