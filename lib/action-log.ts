// Server-side error log for actions. Logs the action name and error type/message/stack only,
// never the request input (may contain personal data). Clients get generic messages.
export function logActionError(action: string, error: unknown) {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code
    console.error(`[action:${action}]`, error.name, typeof code === 'string' ? code : '', error.message, error.stack)
  } else {
    console.error(`[action:${action}]`, String(error))
  }
}

// Errors we throw on purpose with a Turkish, user-facing message. Everything else (database, driver,
// provider errors) is hidden behind a generic message.
export class UserError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserError'
  }
}

export function userMessage(error: unknown, fallback: string): string {
  return error instanceof UserError ? error.message : fallback
}
