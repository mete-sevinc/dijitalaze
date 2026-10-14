// Content-Security-Policy with a per-request nonce. Scripts are locked to the nonce ('strict-dynamic');
// styles keep 'unsafe-inline' because React renders inline style attributes.

export function newNonce(): string {
  return btoa(crypto.randomUUID())
}

export function buildCsp(nonce: string, dev = false): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ')
}

// Pages that must stay reachable without a session.
export function isPublicPath(pathname: string): boolean {
  return pathname === '/giris' || pathname === '/giris-hatasi'
}
