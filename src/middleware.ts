export { auth as middleware } from '@/lib/auth'

export const runtime = 'nodejs'

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|manifest.json|icons).*)'],
}
