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

// Domain errors we throw ourselves carry a Turkish, user-facing message; database/driver errors never reach the client.
export function userMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && !/^Prisma|^Neon|^Error$/.test(error.name) && !('code' in error)) return error.message
  return fallback
}
