type ServerLogLevel = 'info' | 'warn' | 'error'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return `${error || 'Unknown error'}`
}

function serializeContext(context?: Record<string, unknown>): string {
  if (!context || Object.keys(context).length === 0) return ''
  return JSON.stringify(context)
}

export function logServerEvent(
  level: ServerLogLevel,
  scope: string,
  message: string,
  context?: Record<string, unknown>
) {
  const parts = [`[${scope}]`, message]
  const serializedContext = serializeContext(context)
  if (serializedContext) parts.push(serializedContext)

  const output = parts.join(' ')
  if (level === 'error') {
    console.error(output)
    return
  }
  if (level === 'warn') {
    console.warn(output)
    return
  }

  console.info(output)
}

export function warnServerError(scope: string, error: unknown, context?: Record<string, unknown>) {
  logServerEvent('warn', scope, getErrorMessage(error), context)
}

export function infoServerEvent(scope: string, message: string, context?: Record<string, unknown>) {
  logServerEvent('info', scope, message, context)
}