'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useCarritoStore } from '@/store/useCarritoStore'
import { useConfiguracionStore } from '@/store/useConfiguracionStore'
import { useStockPropioStore } from '@/store/useStockPropioStore'
import { useWatchlistStore } from '@/store/useWatchlistStore'

interface EstadoDuplicadosDescartados {
  /** Claves `menor-mayor` de pares que el usuario marcó como "no son el mismo". */
  pares: string[]
  descartarPar: (clave: string) => void
}

/** Pares sugeridos que el usuario rechazó (solo en este navegador). */
export const useDuplicadosDescartadosStore =
  create<EstadoDuplicadosDescartados>()(
    persist(
      (set) => ({
        pares: [],
        descartarPar: (clave) =>
          set((estado) =>
            estado.pares.includes(clave)
              ? estado
              : { pares: [...estado.pares, clave] },
          ),
      }),
      { name: 'perfumeria-duplicados-descartados' },
    ),
  )

/**
 * Tras fusionar `origenId` dentro de `destinoId` en la base, reapunta los datos
 * guardados en este navegador (carrito, seguimiento, stock propio, precio manual).
 */
export function reapuntarDatosLocalesFusion(
  origenId: number,
  destinoId: number,
  nombreFinal: string,
): void {
  useCarritoStore.setState((estado) => {
    const resultado = estado.items
      .filter((item) => item.productoId !== origenId)
      .map((item) => ({ ...item }))
    for (const item of estado.items) {
      if (item.productoId !== origenId) continue
      const existente = resultado.find(
        (i) => i.productoId === destinoId && i.proveedor === item.proveedor,
      )
      if (existente) {
        existente.cantidad += item.cantidad
      } else {
        resultado.push({ ...item, productoId: destinoId, nombre: nombreFinal })
      }
    }
    return { items: resultado }
  })

  useWatchlistStore.setState((estado) => {
    const origen = estado.items[origenId]
    if (!origen) return estado
    const siguientes = { ...estado.items }
    delete siguientes[origenId]
    if (!siguientes[destinoId]) {
      siguientes[destinoId] = { ...origen, productoId: destinoId }
    }
    return { items: siguientes }
  })

  useStockPropioStore.setState((estado) => {
    const origen = estado.registros[origenId]
    if (!origen) return estado
    const siguientes = { ...estado.registros }
    delete siguientes[origenId]
    const destino = siguientes[destinoId]
    siguientes[destinoId] = destino
      ? {
          ...destino,
          cantidadActual: destino.cantidadActual + origen.cantidadActual,
          stockMinimo: Math.max(destino.stockMinimo, origen.stockMinimo),
          updatedAt: new Date().toISOString(),
        }
      : { ...origen, productoId: destinoId }
    return { registros: siguientes }
  })

  useConfiguracionStore.setState((estado) => {
    const manuales = estado.preciosVentaManualesARS ?? {}
    if (manuales[origenId] === undefined) return estado
    const siguientes = { ...manuales }
    const valorOrigen = siguientes[origenId]
    delete siguientes[origenId]
    if (siguientes[destinoId] === undefined) siguientes[destinoId] = valorOrigen
    return { preciosVentaManualesARS: siguientes }
  })
}
