import { NextResponse } from 'next/server'
import type { CotizacionesDolarDia } from '@/types/perfumeria'

export const dynamic = 'force-dynamic'

interface DolarApiItem {
  casa?: string
  venta?: number | null
  compra?: number | null
  fechaActualizacion?: string
}

const RESPALDO_DOLAR: CotizacionesDolarDia = {
  blue: 1400,
  mep: 1380,
  oficial: 1120,
  updatedAt: null,
  fuente: 'respaldo',
}

function extraerValorVenta(item: DolarApiItem | undefined): number | null {
  if (!item) return null
  const valor = Number(item.venta ?? item.compra)
  return Number.isFinite(valor) && valor > 0 ? Number(valor.toFixed(2)) : null
}

/**
 * GET /api/cotizacion/dolar
 *
 * Consulta las cotizaciones actuales de dólar Blue, MEP y Oficial desde DolarApi
 * y devuelve valores de respaldo si el servicio externo no responde a tiempo.
 */
export async function GET() {
  try {
    const respuesta = await fetch('https://dolarapi.com/v1/dolares', {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
      headers: {
        Accept: 'application/json',
      },
    })

    if (!respuesta.ok) {
      return NextResponse.json({
        ...RESPALDO_DOLAR,
        updatedAt: new Date().toISOString(),
      })
    }

    const lista = (await respuesta.json()) as DolarApiItem[]
    if (!Array.isArray(lista) || lista.length === 0) {
      return NextResponse.json({
        ...RESPALDO_DOLAR,
        updatedAt: new Date().toISOString(),
      })
    }

    const blue = extraerValorVenta(lista.find((item) => item.casa === 'blue'))
    const mep = extraerValorVenta(lista.find((item) => item.casa === 'bolsa'))
    const oficial = extraerValorVenta(
      lista.find((item) => item.casa === 'oficial'),
    )

    if (blue === null && mep === null && oficial === null) {
      return NextResponse.json({
        ...RESPALDO_DOLAR,
        updatedAt: new Date().toISOString(),
      })
    }

    const payload: CotizacionesDolarDia = {
      blue: blue ?? RESPALDO_DOLAR.blue,
      mep: mep ?? RESPALDO_DOLAR.mep,
      oficial: oficial ?? RESPALDO_DOLAR.oficial,
      updatedAt:
        lista.find((item) => item.casa === 'blue')?.fechaActualizacion ??
        new Date().toISOString(),
      fuente: 'en_vivo',
    }

    return NextResponse.json(payload)
  } catch {
    return NextResponse.json({
      ...RESPALDO_DOLAR,
      updatedAt: new Date().toISOString(),
    })
  }
}
