import { NextResponse } from 'next/server'
import {
  crearClienteSupabaseAdmin,
  estaSupabaseConfigurado,
} from '@/lib/supabase/cliente'

interface CuerpoActualizarImagen {
  productoId?: unknown
  imagenUrl?: unknown
}

/**
 * POST /api/imagenes/actualizar
 *
 * Actualiza manualmente `imagen_url` de un producto en `catalogo_productos`
 * utilizando el cliente administrador del servidor (protegido por sesión en middleware).
 */
export async function POST(request: Request) {
  if (!estaSupabaseConfigurado()) {
    return NextResponse.json(
      { error: 'Supabase no está configurado en el servidor.' },
      { status: 500 },
    )
  }

  let cuerpo: CuerpoActualizarImagen
  try {
    cuerpo = (await request.json()) as CuerpoActualizarImagen
  } catch {
    return NextResponse.json(
      { error: 'El cuerpo de la petición no es un JSON válido.' },
      { status: 400 },
    )
  }

  const productoId = Number(cuerpo.productoId)
  if (!Number.isInteger(productoId) || productoId <= 0) {
    return NextResponse.json(
      { error: 'El productoId debe ser un entero positivo.' },
      { status: 400 },
    )
  }

  const imagenUrl =
    typeof cuerpo.imagenUrl === 'string' ? cuerpo.imagenUrl.trim() : ''
  if (!imagenUrl) {
    return NextResponse.json(
      { error: 'La URL de la imagen no puede estar vacía.' },
      { status: 400 },
    )
  }

  const supabaseAdmin = crearClienteSupabaseAdmin()
  const { error } = await supabaseAdmin
    .from('catalogo_productos')
    .update({ imagen_url: imagenUrl })
    .eq('id', productoId)

  if (error) {
    return NextResponse.json(
      {
        error: `No se pudo actualizar la imagen del producto ${productoId}: ${error.message}`,
      },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, productoId, imagenUrl })
}
