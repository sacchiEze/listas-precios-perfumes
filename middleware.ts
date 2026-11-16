import { NextResponse, type NextRequest } from 'next/server'
import { NOMBRE_COOKIE_SESION, verificarTokenSesion } from '@/lib/auth/sesion'

const RUTAS_PUBLICAS = ['/login', '/api/auth/login']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const claveAcceso = process.env.CLAVE_ACCESO_APP?.trim() ?? ''

  // Si todavía no se configuró la variable de entorno en desarrollo, no bloqueamos el acceso.
  if (!claveAcceso) {
    return NextResponse.next()
  }

  const esRutaPublica = RUTAS_PUBLICAS.some(
    (ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`),
  )

  const tokenCookie = request.cookies.get(NOMBRE_COOKIE_SESION)?.value
  const sesionValida = await verificarTokenSesion(tokenCookie, claveAcceso)

  if (esRutaPublica) {
    // Si ya tiene sesión válida e intenta entrar a /login, redirigimos directo al workspace.
    if (pathname === '/login' && sesionValida) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return NextResponse.next()
  }

  if (!sesionValida) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Sesión no válida o expirada. Iniciá sesión nuevamente.' },
        { status: 401 },
      )
    }

    const urlLogin = new URL('/login', request.url)
    if (pathname !== '/') {
      urlLogin.searchParams.set('siguiente', pathname)
    }
    return NextResponse.redirect(urlLogin)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
