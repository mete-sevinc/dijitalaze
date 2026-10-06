import { auth } from '@/auth'

export const proxy = auth((req) => {
  if (!req.auth) {
    const url = new URL('/api/auth/signin', req.nextUrl.origin)
    url.searchParams.set('callbackUrl', req.nextUrl.pathname + req.nextUrl.search)
    return Response.redirect(url)
  }
})

export const config = {
  matcher: ['/((?!api/auth|api/cron|sw.js|giris-hatasi|_next/static|_next/image|favicon.ico).*)'],
}
