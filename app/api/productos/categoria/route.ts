import { NextResponse } from 'next/server'
import {
  crearClienteSupabaseAdmin,
  estaSupabaseConfigurado,
} from '@/lib/supabase/cliente'
import {
  esCategoriaPerfumeValida,
  type CategoriaPerfume,
} from '@/types/perfumeria'

interface CuerpoActualizarCategoria {
  productoId?: unknown
  categoria?: unknown
}

/**
 * POST /api/productos/categoria
 *
 * Actualiza `categoria` ('Arabe', 'Premium' o null) de un perfume en `catalogo_productos`.
 */
export async function POST(request: Request) {
  if (!estaSupabaseConfigurado()) {
    return NextResponse.json({ ok: true, modoDemo: true })
  }

  let cuerpo: CuerpoActualizarCategoria
  try {
    cuerpo = (await request.json()) as CuerpoActualizarCategoria
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

  let categoriaFinal: CategoriaPerfume | null = null
  if (
    cuerpo.categoria !== null &&
    cuerpo.categoria !== undefined &&
    cuerpo.categoria !== ''
  ) {
    if (!esCategoriaPerfumeValida(cuerpo.categoria)) {
      return NextResponse.json(
        {
          error:
            'La categoría debe ser "Arabe", "Nicho", "Disenador", "Catalogo", "Asiatico" o null.',
        },
        { status: 400 },
      )
    }
    categoriaFinal = cuerpo.categoria
  }

  const supabaseAdmin = crearClienteSupabaseAdmin()
  const { error } = await supabaseAdmin
    .from('catalogo_productos')
    .update({ categoria: categoriaFinal })
    .eq('id', productoId)

  if (error) {
    return NextResponse.json(
      {
        error: `No se pudo actualizar la categoría del producto ${productoId}: ${error.message}`,
      },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    productoId,
    categoria: categoriaFinal,
  })
}
