'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { RegistroStockPropio } from '@/types/perfumeria'

interface EstadoStockPropio {
  registros: Record<number, RegistroStockPropio>
  setStockProducto: (
    productoId: number,
    cantidadActual: number,
    stockMinimo?: number,
  ) => void
  ajustarStockProducto: (productoId: number, delta: number) => void
  setStockMinimoProducto: (productoId: number, stockMinimo: number) => void
  quitarStockProducto: (productoId: number) => void
  vaciarStockPropio: () => void
}

/**
 * Determina si un producto con seguimiento de inventario propio está por debajo de su mínimo.
 */
export function necesitaReposicion(
  registro: RegistroStockPropio | undefined,
): boolean {
  return (
    registro !== undefined &&
    registro.stockMinimo > 0 &&
    registro.cantidadActual < registro.stockMinimo
  )
}

/**
 * Calcula cuántas unidades faltan comprar para alcanzar el stock mínimo configurado.
 */
export function unidadesFaltantesReposicion(
  registro: RegistroStockPropio | undefined,
): number {
  return registro ? Math.max(0, registro.stockMinimo - registro.cantidadActual) : 0
}

/**
 * Store persistido en localStorage para gestionar el stock propio de cada perfume
 * y detectar automáticamente qué productos necesitan reposición.
 */
export const useStockPropioStore = create<EstadoStockPropio>()(
  persist(
    (set) => ({
      registros: {},

      setStockProducto: (
        productoId: number,
        cantidadActual: number,
        stockMinimo?: number,
      ) => {
        set((estado) => {
          const existente = estado.registros[productoId]
          const cantidadSegura = Number.isFinite(cantidadActual)
            ? Math.max(0, Math.floor(cantidadActual))
            : 0
          const minimoSeguro = Number.isFinite(stockMinimo)
            ? Math.max(0, Math.floor(stockMinimo!))
            : (existente?.stockMinimo ?? 1)

          return {
            registros: {
              ...estado.registros,
              [productoId]: {
                productoId,
                cantidadActual: cantidadSegura,
                stockMinimo: minimoSeguro,
                updatedAt: new Date().toISOString(),
              },
            },
          }
        })
      },

      ajustarStockProducto: (productoId: number, delta: number) => {
        set((estado) => {
          const existente = estado.registros[productoId]
          const base = existente?.cantidadActual ?? 0
          const siguiente = Math.max(0, Math.floor(base + delta))
          const minimoSeguro = existente?.stockMinimo ?? 1

          return {
            registros: {
              ...estado.registros,
              [productoId]: {
                productoId,
                cantidadActual: siguiente,
                stockMinimo: minimoSeguro,
                updatedAt: new Date().toISOString(),
              },
            },
          }
        })
      },

      setStockMinimoProducto: (productoId: number, stockMinimo: number) => {
        set((estado) => {
          const existente = estado.registros[productoId]
          const minimoSeguro = Number.isFinite(stockMinimo)
            ? Math.max(0, Math.floor(stockMinimo))
            : 0

          return {
            registros: {
              ...estado.registros,
              [productoId]: {
                productoId,
                cantidadActual: existente?.cantidadActual ?? 0,
                stockMinimo: minimoSeguro,
                updatedAt: new Date().toISOString(),
              },
            },
          }
        })
      },

      quitarStockProducto: (productoId: number) => {
        set((estado) => {
          if (!estado.registros[productoId]) return estado
          const siguientes = { ...estado.registros }
          delete siguientes[productoId]
          return { registros: siguientes }
        })
      },

      vaciarStockPropio: () => {
        set({ registros: {} })
      },
    }),
    {
      name: 'perfumeria-stock-propio-storage',
    },
  ),
)
