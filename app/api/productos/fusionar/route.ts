import { NextResponse } from 'next/server'
import { normalizarTextoImportacion } from '@/lib/importadorListas'
import {
  crearClienteSupabaseAdmin,
  estaSupabaseConfigurado,
} from '@/lib/supabase/cliente'

interface CuerpoFusionar {
  origenId?: unknown
  destinoId?: unknown
  nombre?: unknown
}

/**
 * POST /api/productos/fusionar
 *
 * Fusiona el perfume `origenId` dentro de `destinoId` (precios, historial y datos
 * faltantes) y guarda los nombres del origen como alias para que futuras
 * importaciones se asocien al perfume destino en vez de recrear el duplicado.
 */
export async function POST(request: Request) {
  if (!estaSupabaseConfigurado()) {
    return NextResponse.json({ ok: true, modoDemo: true })
  }

  let cuerpo: CuerpoFusionar
  try {
    cuerpo = (await request.json()) as CuerpoFusionar
  } catch {
    return NextResponse.json(
      { error: 'El cuerpo de la petición no es un JSON válido.' },
      { status: 400 },
    )
  }

  const origenId = Number(cuerpo.origenId)
  const destinoId = Number(cuerpo.destinoId)
  if (
    !Number.isInteger(origenId) ||
    !Number.isInteger(destinoId) ||
    origenId <= 0 ||
    destinoId <= 0 ||
    origenId === destinoId
  ) {
    return NextResponse.json(
      { error: 'Indicá dos productos distintos para fusionar.' },
      { status: 400 },
    )
  }
  const nombre =
    typeof cuerpo.nombre === 'string' && cuerpo.nombre.trim()
      ? cuerpo.nombre.trim()
      : null

  const supabaseAdmin = crearClienteSupabaseAdmin()

  const { data: productos, error: errorLectura } = await supabaseAdmin
    .from('catalogo_productos')
    .select('id, marca, nombre, ml')
    .in('id', [origenId, destinoId])

  if (errorLectura || !productos || productos.length !== 2) {
    return NextResponse.json(
      { error: 'No se encontraron los dos perfumes a fusionar.' },
      { status: 404 },
    )
  }

  const origen = productos.find((p) => p.id === origenId)!
  const destino = productos.find((p) => p.id === destinoId)!

  const { error: errorFusion } = await supabaseAdmin.rpc('fusionar_productos', {
    p_origen: origenId,
    p_destino: destinoId,
    p_nombre: nombre,
  })

  if (errorFusion) {
    return NextResponse.json(
      { error: `No se pudo fusionar: ${errorFusion.message}` },
      { status: 409 },
    )
  }

  // Alias: el nombre del origen (y el viejo del destino si se renombró) apuntan al destino.
  const alias = [
    { marca: origen.marca, nombre: origen.nombre, ml: origen.ml },
    ...(nombre && nombre !== destino.nombre
      ? [{ marca: destino.marca, nombre: destino.nombre, ml: destino.ml }]
      : []),
  ].map((a) => ({
    marca_norm: normalizarTextoImportacion(a.marca),
    nombre_norm: normalizarTextoImportacion(a.nombre),
    ml: a.ml ?? 0,
    producto_id: destinoId,
  }))

  const { error: errorAlias } = await supabaseAdmin
    .from('alias_productos')
    .upsert(alias, { onConflict: 'marca_norm,nombre_norm,ml' })

  return NextResponse.json({
    ok: true,
    origenId,
    destinoId,
    advertencia: errorAlias
      ? `Se fusionó, pero no se pudo guardar el alias: ${errorAlias.message}`
      : undefined,
  })
}
