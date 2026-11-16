import { NextResponse } from 'next/server'
import {
  crearTokenSesion,
  DURACION_SESION_SEGUNDOS,
  NOMBRE_COOKIE_SESION,
  validarClaveAcceso,
} from '@/lib/auth/sesion'

interface CuerpoLogin {
  clave?: string
}

/**
 * POST /api/auth/login
 * Valida la clave privada configurada en CLAVE_ACCESO_APP e inyecta una cookie
 * HTTP-only firmada válida por 90 días.
 */
export async function POST(request: Request) {
  const claveEsperada = process.env.CLAVE_ACCESO_APP?.trim() ?? ''

  if (!claveEsperada) {
    return NextResponse.json(
      {
        error:
          'CLAVE_ACCESO_APP no está definida en el servidor. Configurala en .env.local o Vercel.',
      },
      { status: 500 },
    )
  }

  let cuerpo: CuerpoLogin = {}
  try {
    cuerpo = (await request.json()) as CuerpoLogin
  } catch {
    return NextResponse.json(
      { error: 'Formato de solicitud inválido.' },
      { status: 400 },
    )
  }

  const claveIngresada = typeof cuerpo.clave === 'string' ? cuerpo.clave.trim() : ''
  if (!claveIngresada) {
    return NextResponse.json(
      { error: 'Ingresá la clave de acceso.' },
      { status: 400 },
    )
  }

  if (!validarClaveAcceso(claveIngresada, claveEsperada)) {
    return NextResponse.json(
      { error: 'La clave ingresada es incorrecta.' },
      { status: 401 },
    )
  }

  const token = await crearTokenSesion(claveEsperada)
  const respuesta = NextResponse.json({ autenticado: true })

  respuesta.cookies.set({
    name: NOMBRE_COOKIE_SESION,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: DURACION_SESION_SEGUNDOS,
    path: '/',
  })

  return respuesta
}

/**
 * DELETE /api/auth/login
 * Elimina la cookie de sesión para cerrar el acceso desde este dispositivo.
 */
export async function DELETE() {
  const respuesta = NextResponse.json({ autenticado: false })
  respuesta.cookies.delete(NOMBRE_COOKIE_SESION)
  return respuesta
}
