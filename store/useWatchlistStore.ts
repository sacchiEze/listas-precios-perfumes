'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AlertaWatchlistEvaluada,
  ItemWatchlist,
  Moneda,
  ProductoComparado,
} from '@/types/perfumeria'

export interface DatosAlertaProducto {
  precioObjetivo: number | null
  monedaObjetivo: Moneda
  avisarStock: boolean
  avisarBajaPrecio: boolean
  nota?: string
}

interface EstadoWatchlist {
  items: Record<number, ItemWatchlist>
  alternarSeguimiento: (
    productoId: number,
    inicial?: Partial<DatosAlertaProducto>,
  ) => void
  guardarAlertaProducto: (productoId: number, datos: DatosAlertaProducto) => void
  quitarSeguimiento: (productoId: number) => void
  vaciarWatchlist: () => void
}

/**
 * Store de seguimiento y alertas de precios objetivo persistido en localStorage.
 */
export const useWatchlistStore = create<EstadoWatchlist>()(
  persist(
    (set) => ({
      items: {},

      alternarSeguimiento: (
        productoId: number,
        inicial?: Partial<DatosAlertaProducto>,
      ) => {
        set((estado) => {
          const siguientes = { ...estado.items }
          if (siguientes[productoId]) {
            delete siguientes[productoId]
          } else {
            siguientes[productoId] = {
              productoId,
              precioObjetivo: inicial?.precioObjetivo ?? null,
              monedaObjetivo: inicial?.monedaObjetivo ?? 'USD',
              avisarStock: inicial?.avisarStock ?? true,
              avisarBajaPrecio: inicial?.avisarBajaPrecio ?? true,
              nota: inicial?.nota,
              createdAt: new Date().toISOString(),
            }
          }
          return { items: siguientes }
        })
      },

      guardarAlertaProducto: (
        productoId: number,
        datos: DatosAlertaProducto,
      ) => {
        set((estado) => {
          const existente = estado.items[productoId]
          const objetivoNormalizado =
            datos.precioObjetivo !== null &&
            Number.isFinite(datos.precioObjetivo) &&
            datos.precioObjetivo > 0
              ? datos.precioObjetivo
              : null

          return {
            items: {
              ...estado.items,
              [productoId]: {
                productoId,
                precioObjetivo: objetivoNormalizado,
                monedaObjetivo: datos.monedaObjetivo,
                avisarStock: datos.avisarStock,
                avisarBajaPrecio: datos.avisarBajaPrecio,
                nota: datos.nota?.trim() || undefined,
                createdAt: existente?.createdAt ?? new Date().toISOString(),
              },
            },
          }
        })
      },

      quitarSeguimiento: (productoId: number) => {
        set((estado) => {
          if (!estado.items[productoId]) return estado
          const siguientes = { ...estado.items }
          delete siguientes[productoId]
          return { items: siguientes }
        })
      },

      vaciarWatchlist: () => {
        set({ items: {} })
      },
    }),
    {
      name: 'perfumeria-watchlist-storage',
    },
  ),
)

/**
 * Evalúa cada producto del Watchlist contra el catálogo actual para determinar
 * qué alertas están activas (precio objetivo alcanzado, baja reciente o reposición de stock).
 */
export function evaluarAlertasWatchlist(
  items: Record<number, ItemWatchlist>,
  productosGlobales: ProductoComparado[],
  dolarDelDia: number,
): AlertaWatchlistEvaluada[] {
  const cotizacionSegura =
    Number.isFinite(dolarDelDia) && dolarDelDia > 0 ? dolarDelDia : 1400
  const mapaProductos = new Map<number, ProductoComparado>(
    productosGlobales.map((p) => [p.producto_id, p]),
  )

  const evaluaciones: AlertaWatchlistEvaluada[] = []

  for (const item of Object.values(items)) {
    const producto = mapaProductos.get(item.productoId)
    if (!producto) continue

    const mejorPrecioEnMoneda =
      item.monedaObjetivo === 'USD'
        ? producto.mejorPrecioUSD ??
          (producto.mejorPrecioARS !== null
            ? producto.mejorPrecioARS / cotizacionSegura
            : null)
        : producto.mejorPrecioARS ??
          (producto.mejorPrecioUSD !== null
            ? producto.mejorPrecioUSD * cotizacionSegura
            : null)

    const diferenciaObjetivoPorcentaje =
      item.precioObjetivo !== null &&
      item.precioObjetivo > 0 &&
      mejorPrecioEnMoneda !== null
        ? Number(
            (
              ((mejorPrecioEnMoneda - item.precioObjetivo) /
                item.precioObjetivo) *
              100
            ).toFixed(1),
          )
        : null

    const cumplePrecioObjetivo =
      item.precioObjetivo !== null &&
      item.precioObjetivo > 0 &&
      producto.tieneStockDisponible &&
      mejorPrecioEnMoneda !== null &&
      mejorPrecioEnMoneda <= item.precioObjetivo

    const cumpleStockDisponible =
      item.avisarStock && producto.tieneStockDisponible

    const cumpleBajaPrecio =
      item.avisarBajaPrecio && (producto.menorVariacionPorcentaje ?? 0) < -0.5

    const tieneAlertaActiva =
      cumplePrecioObjetivo ||
      cumpleBajaPrecio ||
      (item.avisarStock &&
        producto.tieneStockDisponible &&
        item.precioObjetivo === null)

    evaluaciones.push({
      item,
      producto,
      cumplePrecioObjetivo,
      cumpleStockDisponible,
      cumpleBajaPrecio,
      tieneAlertaActiva,
      diferenciaObjetivoPorcentaje,
    })
  }

  return evaluaciones.sort((a, b) => {
    if (a.cumplePrecioObjetivo !== b.cumplePrecioObjetivo) {
      return a.cumplePrecioObjetivo ? -1 : 1
    }
    if (a.tieneAlertaActiva !== b.tieneAlertaActiva) {
      return a.tieneAlertaActiva ? -1 : 1
    }
    return a.producto.nombre.localeCompare(b.producto.nombre, 'es-AR')
  })
}
