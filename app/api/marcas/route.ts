import { NextResponse } from 'next/server'
import {
  crearClienteSupabaseAdmin,
  estaSupabaseConfigurado,
} from '@/lib/supabase/cliente'
import {
  esCategoriaPerfumeValida,
  normalizarClaveMarca,
  type CategoriaPerfume,
} from '@/types/perfumeria'

interface CuerpoGestionMarca {
  accion?: unknown
  marca?: unknown
  categoria?: unknown
}

function escaparPatronIlike(texto: string): string {
  return texto.replace(/[\\%_]/g, (caracter) => `\\${caracter}`)
}

/**
 * GET /api/marcas
 *
 * Devuelve la configuración persistida de marcas (categoría asignada y marcas eliminadas).
 */
export async function GET() {
  if (!estaSupabaseConfigurado()) {
    return NextResponse.json({ marcas: [] })
  }

  const { data, error } = await crearClienteSupabaseAdmin()
    .from('configuracion_marcas')
    .select('marca_norm, marca, categoria, eliminada')
    .order('marca', { ascending: true })

  if (error) {
    return NextResponse.json({ marcas: [] })
  }

  return NextResponse.json({ marcas: data ?? [] })
}

/**
 * POST /api/marcas
 *
 * Gestiona acciones sobre una marca completa:
 * - 'categoria': guarda la categoría de la marca y la aplica a todos sus productos.
 * - 'eliminar': marca la marca como eliminada permanentemente y borra todos sus productos.
 * - 'restaurar': quita el bloqueo de eliminación permanente de una marca.
 */
export async function POST(request: Request) {
  if (!estaSupabaseConfigurado()) {
    return NextResponse.json({ ok: true, modoDemo: true })
  }

  let cuerpo: CuerpoGestionMarca
  try {
    cuerpo = (await request.json()) as CuerpoGestionMarca
  } catch {
    return NextResponse.json(
      { error: 'El cuerpo de la petición no es un JSON válido.' },
      { status: 400 },
    )
  }

  const accion = cuerpo.accion
  if (
    accion !== 'categoria' &&
    accion !== 'eliminar' &&
    accion !== 'restaurar'
  ) {
    return NextResponse.json(
      { error: 'La acción debe ser "categoria", "eliminar" o "restaurar".' },
      { status: 400 },
    )
  }

  const marcaLimpia =
    typeof cuerpo.marca === 'string' ? cuerpo.marca.trim() : ''
  const marcaNorm = normalizarClaveMarca(marcaLimpia)
  if (!marcaNorm) {
    return NextResponse.json(
      { error: 'Indicá una marca válida.' },
      { status: 400 },
    )
  }

  const supabaseAdmin = crearClienteSupabaseAdmin()
  const ahoraIso = new Date().toISOString()

  if (accion === 'categoria') {
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

    const { error: errorConfig } = await supabaseAdmin
      .from('configuracion_marcas')
      .upsert(
        {
          marca_norm: marcaNorm,
          marca: marcaLimpia,
          categoria: categoriaFinal,
          eliminada: false,
          updated_at: ahoraIso,
        },
        { onConflict: 'marca_norm' },
      )

    if (errorConfig) {
      return NextResponse.json(
        {
          error: `No se pudo guardar la configuración de la marca ${marcaLimpia}: ${errorConfig.message}`,
        },
        { status: 500 },
      )
    }

    const { error: errorProductos } = await supabaseAdmin
      .from('catalogo_productos')
      .update({ categoria: categoriaFinal })
      .ilike('marca', escaparPatronIlike(marcaLimpia))

    if (errorProductos) {
      return NextResponse.json(
        {
          error: `No se pudo actualizar la categoría de los productos de ${marcaLimpia}: ${errorProductos.message}`,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ok: true,
      accion,
      marca: marcaLimpia,
      marca_norm: marcaNorm,
      categoria: categoriaFinal,
    })
  }

  if (accion === 'eliminar') {
    const { error: errorConfig } = await supabaseAdmin
      .from('configuracion_marcas')
      .upsert(
        {
          marca_norm: marcaNorm,
          marca: marcaLimpia,
          categoria: null,
          eliminada: true,
          updated_at: ahoraIso,
        },
        { onConflict: 'marca_norm' },
      )

    if (errorConfig) {
      return NextResponse.json(
        {
          error: `No se pudo registrar la eliminación de la marca ${marcaLimpia}: ${errorConfig.message}`,
        },
        { status: 500 },
      )
    }

    const { error: errorEliminar } = await supabaseAdmin
      .from('catalogo_productos')
      .delete()
      .ilike('marca', escaparPatronIlike(marcaLimpia))

    if (errorEliminar) {
      return NextResponse.json(
        {
          error: `No se pudieron eliminar los productos de ${marcaLimpia}: ${errorEliminar.message}`,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ok: true,
      accion,
      marca: marcaLimpia,
      marca_norm: marcaNorm,
    })
  }

  const { error: errorRestaurar } = await supabaseAdmin
    .from('configuracion_marcas')
    .update({ eliminada: false, updated_at: ahoraIso })
    .eq('marca_norm', marcaNorm)

  if (errorRestaurar) {
    return NextResponse.json(
      {
        error: `No se pudo restaurar la marca ${marcaLimpia}: ${errorRestaurar.message}`,
      },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    accion,
    marca: marcaLimpia,
    marca_norm: marcaNorm,
  })
}
