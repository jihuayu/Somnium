function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return `${error || 'Unknown error'}`
}

export function warnServerError(scope: string, error: unknown, context?: Record<string, unknown>) {
  const parts = [`[${scope}]`, getErrorMessage(error)]
  if (context && Object.keys(context).length > 0) {
    parts.push(JSON.stringify(context))
  }

  console.warn(parts.join(' '))
}