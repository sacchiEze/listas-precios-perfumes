import { NextResponse } from 'next/server'
import {
  crearClienteSupabaseAdmin,
  estaSupabaseConfigurado,
} from '@/lib/supabase/cliente'
import {
  esCategoriaPerfumeValida,
  esTipoProductoValido,
  type CategoriaPerfume,
  type TipoProducto,
} from '@/types/perfumeria'

interface CuerpoActualizarCategoria {
  productoId?: unknown
  categoria?: unknown
  tipo?: unknown
}

/**
 * POST /api/productos/categoria
 *
 * Actualiza `categoria` y/o `tipo` de un producto en `catalogo_productos`.
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

  const camposActualizar: {
    categoria?: CategoriaPerfume | null
    tipo?: TipoProducto
  } = {}

  if ('categoria' in cuerpo) {
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
    camposActualizar.categoria = categoriaFinal
  }

  if ('tipo' in cuerpo) {
    if (!esTipoProductoValido(cuerpo.tipo)) {
      return NextResponse.json(
        {
          error:
            'El tipo debe ser "Perfume", "Kit", "Body Splash", "Desodorante", "Crema", "Aceite" u "Otro".',
        },
        { status: 400 },
      )
    }
    camposActualizar.tipo = cuerpo.tipo
  }

  if (Object.keys(camposActualizar).length === 0) {
    return NextResponse.json(
      { error: 'Indicá "categoria" o "tipo" para actualizar.' },
      { status: 400 },
    )
  }

  const supabaseAdmin = crearClienteSupabaseAdmin()
  const { error } = await supabaseAdmin
    .from('catalogo_productos')
    .update(camposActualizar)
    .eq('id', productoId)

  if (error) {
    return NextResponse.json(
      {
        error: `No se pudo actualizar el producto ${productoId}: ${error.message}`,
      },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    productoId,
    ...camposActualizar,
  })
}
