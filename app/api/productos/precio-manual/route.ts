import { NextResponse } from 'next/server'
import {
  crearClienteSupabaseAdmin,
  estaSupabaseConfigurado,
} from '@/lib/supabase/cliente'

interface CuerpoActualizarPrecioManual {
  productoId?: unknown
  precioVentaManualARS?: unknown
}

/**
 * POST /api/productos/precio-manual
 *
 * Guarda o limpia `precio_venta_manual_ars` en `catalogo_productos` de Supabase
 * para sincronizar el precio de reventa definido a mano entre dispositivos.
 */
export async function POST(request: Request) {
  if (!estaSupabaseConfigurado()) {
    return NextResponse.json({ ok: true, modoDemo: true })
  }

  let cuerpo: CuerpoActualizarPrecioManual
  try {
    cuerpo = (await request.json()) as CuerpoActualizarPrecioManual
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

  let valorManual: number | null = null
  if (
    cuerpo.precioVentaManualARS !== null &&
    cuerpo.precioVentaManualARS !== undefined &&
    cuerpo.precioVentaManualARS !== ''
  ) {
    const num = Number(cuerpo.precioVentaManualARS)
    if (!Number.isFinite(num) || num <= 0) {
      return NextResponse.json(
        { error: 'El precio manual debe ser mayor a 0 o null para eliminarlo.' },
        { status: 400 },
      )
    }
    valorManual = Number(num.toFixed(2))
  }

  const supabaseAdmin = crearClienteSupabaseAdmin()
  const { error } = await supabaseAdmin
    .from('catalogo_productos')
    .update({ precio_venta_manual_ars: valorManual })
    .eq('id', productoId)

  if (error) {
    return NextResponse.json(
      {
        error: `No se pudo guardar el precio manual del producto ${productoId}: ${error.message}`,
      },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    productoId,
    precioVentaManualARS: valorManual,
  })
}
