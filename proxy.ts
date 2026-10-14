import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { buildCsp, isPublicPath, newNonce } from '@/lib/csp'

export const proxy = auth((req) => {
  if (!req.auth && !isPublicPath(req.nextUrl.pathname)) {
    const url = new URL('/giris', req.nextUrl.origin)
    url.searchParams.set('callbackUrl', req.nextUrl.pathname + req.nextUrl.search)
    return Response.redirect(url)
  }

  // Fresh nonce per request; Next reads it from the request CSP header and tags its own scripts.
  const nonce = newNonce()
  const csp = buildCsp(nonce, process.env.NODE_ENV === 'development')
  const headers = new Headers(req.headers)
  headers.set('x-nonce', nonce)
  headers.set('Content-Security-Policy', csp)
  const res = NextResponse.next({ request: { headers } })
  res.headers.set('Content-Security-Policy', csp)
  return res
})

export const config = {
  matcher: ['/((?!api/auth|api/cron|sw.js|_next/static|_next/image|favicon.ico).*)'],
}
