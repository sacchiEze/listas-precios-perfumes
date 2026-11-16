import { NextResponse } from 'next/server'
import { generarSlugProducto } from '@/lib/importadorListas'
import {
  crearClienteSupabaseAdmin,
  estaSupabaseConfigurado,
} from '@/lib/supabase/cliente'
import type {
  ItemPrevisualizacionImportacion,
  Moneda,
} from '@/types/perfumeria'

interface CuerpoImportarLista {
  proveedor?: unknown
  moneda?: unknown
  items?: unknown
}

/**
 * POST /api/listas/importar
 *
 * Aplica en Supabase una lista de proveedor previsualizada:
 * 1. Crea los productos nuevos en `catalogo_productos` cuando no existían.
 * 2. Actualiza o inserta las ofertas del proveedor en `precios_proveedores`.
 * 3. Registra los precios del día en `historial_precios` para alimentar la evolución histórica.
 */
export async function POST(request: Request) {
  let cuerpo: CuerpoImportarLista
  try {
    cuerpo = (await request.json()) as CuerpoImportarLista
  } catch {
    return NextResponse.json(
      { error: 'El cuerpo de la petición no es un JSON válido.' },
      { status: 400 },
    )
  }

  const proveedor =
    typeof cuerpo.proveedor === 'string' ? cuerpo.proveedor.trim() : ''
  if (!proveedor) {
    return NextResponse.json(
      { error: 'Indicá el nombre del proveedor para importar la lista.' },
      { status: 400 },
    )
  }

  const moneda: Moneda = cuerpo.moneda === 'ARS' ? 'ARS' : 'USD'
  const items = Array.isArray(cuerpo.items)
    ? (cuerpo.items as ItemPrevisualizacionImportacion[])
    : []

  if (items.length === 0) {
    return NextResponse.json(
      { error: 'No hay filas válidas para importar.' },
      { status: 400 },
    )
  }

  if (!estaSupabaseConfigurado()) {
    return NextResponse.json({
      ok: true,
      modoDemo: true,
      procesados: items.length,
      nuevosProductos: items.filter((i) => i.productoExistenteId === null).length,
      actualizados: items.filter((i) => i.productoExistenteId !== null).length,
      idsAsignados: {},
    })
  }

  const supabaseAdmin = crearClienteSupabaseAdmin()
  const fechaHoy = new Date().toISOString().slice(0, 10)
  const ahoraIso = new Date().toISOString()

  let nuevosProductos = 0
  let actualizados = 0
  const idsAsignados: Record<number, number> = {}

  for (const item of items) {
    if (!item?.fila || !Number.isFinite(item.fila.precioBase)) continue

    let productoId = item.productoExistenteId

    if (!productoId) {
      const slugBase = generarSlugProducto(
        item.fila.marca,
        item.fila.nombre,
        item.fila.ml,
      )
      const slugUnico = `${slugBase}-${Date.now().toString(36).slice(-4)}`

      const { data: insertado, error: errorInsertCatalogo } =
        await supabaseAdmin
          .from('catalogo_productos')
          .insert({
            slug: slugUnico,
            ean6: item.fila.ean6,
            marca: item.fila.marca,
            nombre: item.fila.nombre,
            tipo: item.fila.tipo,
            concentracion: item.fila.concentracion,
            ml: item.fila.ml,
            genero: item.fila.genero,
          })
          .select('id')
          .single()

      if (errorInsertCatalogo || !insertado?.id) {
        return NextResponse.json(
          {
            error: `No se pudo crear el producto "${item.fila.marca} ${item.fila.nombre}": ${errorInsertCatalogo?.message ?? 'error desconocido'}`,
          },
          { status: 500 },
        )
      }

      productoId = Number(insertado.id)
      idsAsignados[item.fila.lineaNumero] = productoId
      nuevosProductos += 1
    } else {
      actualizados += 1
    }

    const { data: ofertaExistente, error: errorBuscarOferta } =
      await supabaseAdmin
        .from('precios_proveedores')
        .select('id')
        .eq('producto_id', productoId)
        .eq('proveedor', proveedor)
        .maybeSingle()

    if (errorBuscarOferta) {
      return NextResponse.json(
        {
          error: `Error al consultar precios de ${proveedor}: ${errorBuscarOferta.message}`,
        },
        { status: 500 },
      )
    }

    const cargaPrecio = {
      producto_id: productoId,
      proveedor,
      moneda,
      precio_base: item.fila.precioBase,
      precio_12: item.fila.precio12,
      precio_24: item.fila.precio24,
      estado_stock: item.fila.estadoStock,
      updated_at: ahoraIso,
    }

    if (ofertaExistente?.id) {
      const { error: errorUpdate } = await supabaseAdmin
        .from('precios_proveedores')
        .update(cargaPrecio)
        .eq('id', ofertaExistente.id)

      if (errorUpdate) {
        return NextResponse.json(
          {
            error: `Error al actualizar precio de ${item.fila.nombre}: ${errorUpdate.message}`,
          },
          { status: 500 },
        )
      }
    } else {
      const { error: errorInsert } = await supabaseAdmin
        .from('precios_proveedores')
        .insert(cargaPrecio)

      if (errorInsert) {
        return NextResponse.json(
          {
            error: `Error al insertar precio de ${item.fila.nombre}: ${errorInsert.message}`,
          },
          { status: 500 },
        )
      }
    }

    const { data: historialHoy } = await supabaseAdmin
      .from('historial_precios')
      .select('id')
      .eq('producto_id', productoId)
      .eq('proveedor', proveedor)
      .eq('fecha', fechaHoy)
      .maybeSingle()

    if (historialHoy?.id) {
      await supabaseAdmin
        .from('historial_precios')
        .update({
          moneda,
          precio_base: item.fila.precioBase,
          precio_12: item.fila.precio12,
          precio_24: item.fila.precio24,
        })
        .eq('id', historialHoy.id)
    } else {
      await supabaseAdmin.from('historial_precios').insert({
        producto_id: productoId,
        proveedor,
        moneda,
        precio_base: item.fila.precioBase,
        precio_12: item.fila.precio12,
        precio_24: item.fila.precio24,
        fecha: fechaHoy,
      })
    }
  }

  return NextResponse.json({
    ok: true,
    modoDemo: false,
    procesados: items.length,
    nuevosProductos,
    actualizados,
    idsAsignados,
  })
}
