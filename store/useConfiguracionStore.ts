'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  ConfiguracionRentabilidad,
  CotizacionesDolarDia,
  Moneda,
  TipoCotizacionDolar,
  TipoProducto,
} from '@/types/perfumeria'

export const CONFIG_RENTABILIDAD_INICIAL: ConfiguracionRentabilidad = {
  margenGeneralPorcentaje: 35,
  margenPorTipo: {},
  comisionPlataformaPorcentaje: 0,
  costoFijoEnvioEmbalajeARS: 0,
  costoEnvioPorPerfumeUSD: 0,
  gananciaFijaAdicionalARS: 0,
  preciosVentaManualesARS: {},
  mostrarRentabilidadEnCatalogo: true,
}

export const COTIZACIONES_DOLAR_INICIALES: CotizacionesDolarDia = {
  blue: null,
  mep: null,
  oficial: null,
  updatedAt: null,
  fuente: 'respaldo',
}

interface EstadoConfiguracion extends ConfiguracionRentabilidad {
  /** Cotización del dólar utilizada para convertir listas ARS <-> USD */
  dolarDelDia: number
  /** Fuente activa de cotización (manual o automática) */
  tipoDolarActivo: TipoCotizacionDolar
  /** Últimas cotizaciones automáticas recuperadas */
  cotizacionesDolar: CotizacionesDolarDia
  /** Moneda principal en la que se comparan y muestran los precios equivalentes */
  monedaVisualizacion: Moneda
  setDolarDelDia: (nuevoValor: number) => void
  setTipoDolarActivo: (tipo: TipoCotizacionDolar) => void
  setCotizacionesDolar: (cotizaciones: CotizacionesDolarDia) => void
  aplicarCotizacionAutomatica: (
    tipo: Exclude<TipoCotizacionDolar, 'manual'>,
    cotizaciones: CotizacionesDolarDia,
  ) => void
  setMonedaVisualizacion: (moneda: Moneda) => void
  alternarMonedaVisualizacion: () => void
  setMargenGeneralPorcentaje: (valor: number) => void
  setMargenPorTipo: (tipo: TipoProducto, valor: number | null) => void
  setComisionPlataformaPorcentaje: (valor: number) => void
  setCostoFijoEnvioEmbalajeARS: (valor: number) => void
  setCostoEnvioPorPerfumeUSD: (valor: number) => void
  setGananciaFijaAdicionalARS: (valor: number) => void
  setPrecioVentaManualProducto: (
    productoId: number,
    precioARS: number | null,
  ) => void
  sincronizarPreciosManualesDesdeCatalogo: (
    mapaDesdeDB: Record<number, number>,
  ) => void
  setMostrarRentabilidadEnCatalogo: (mostrar: boolean) => void
  restaurarRentabilidadPorDefecto: () => void
}

/**
 * Store global de configuración persistido en localStorage.
 * Mantiene la cotización del dólar (automática o manual), la moneda de comparación y los parámetros de rentabilidad.
 */
export const useConfiguracionStore = create<EstadoConfiguracion>()(
  persist(
    (set) => ({
      dolarDelDia: 1400,
      tipoDolarActivo: 'manual',
      cotizacionesDolar: COTIZACIONES_DOLAR_INICIALES,
      monedaVisualizacion: 'USD',
      ...CONFIG_RENTABILIDAD_INICIAL,

      setDolarDelDia: (nuevoValor: number) => {
        const valorNormalizado =
          Number.isFinite(nuevoValor) && nuevoValor > 0 ? nuevoValor : 1400
        set({ dolarDelDia: valorNormalizado, tipoDolarActivo: 'manual' })
      },

      setTipoDolarActivo: (tipo: TipoCotizacionDolar) => {
        set((estado) => {
          if (tipo === 'manual') {
            return { tipoDolarActivo: 'manual' }
          }
          const valorCotizado = estado.cotizacionesDolar[tipo]
          return {
            tipoDolarActivo: tipo,
            dolarDelDia:
              valorCotizado !== null && valorCotizado > 0
                ? Math.round(valorCotizado)
                : estado.dolarDelDia,
          }
        })
      },

      setCotizacionesDolar: (cotizaciones: CotizacionesDolarDia) => {
        set({ cotizacionesDolar: cotizaciones })
      },

      aplicarCotizacionAutomatica: (
        tipo: Exclude<TipoCotizacionDolar, 'manual'>,
        cotizaciones: CotizacionesDolarDia,
      ) => {
        const valorCotizado = cotizaciones[tipo]
        set((estado) => ({
          cotizacionesDolar: cotizaciones,
          tipoDolarActivo: tipo,
          dolarDelDia:
            valorCotizado !== null && valorCotizado > 0
              ? Math.round(valorCotizado)
              : estado.dolarDelDia,
        }))
      },

      setMonedaVisualizacion: (moneda: Moneda) => {
        set({ monedaVisualizacion: moneda })
      },

      alternarMonedaVisualizacion: () => {
        set((estado) => ({
          monedaVisualizacion: estado.monedaVisualizacion === 'USD' ? 'ARS' : 'USD',
        }))
      },

      setMargenGeneralPorcentaje: (valor: number) => {
        const normalizado =
          Number.isFinite(valor) && valor >= 0 ? Math.min(500, valor) : 0
        set({ margenGeneralPorcentaje: normalizado })
      },

      setMargenPorTipo: (tipo: TipoProducto, valor: number | null) => {
        set((estado) => {
          const siguientes = { ...estado.margenPorTipo }
          if (valor === null || !Number.isFinite(valor) || valor < 0) {
            delete siguientes[tipo]
          } else {
            siguientes[tipo] = Math.min(500, valor)
          }
          return { margenPorTipo: siguientes }
        })
      },

      setComisionPlataformaPorcentaje: (valor: number) => {
        const normalizado =
          Number.isFinite(valor) && valor >= 0 ? Math.min(85, valor) : 0
        set({ comisionPlataformaPorcentaje: normalizado })
      },

      setCostoFijoEnvioEmbalajeARS: (valor: number) => {
        const normalizado = Number.isFinite(valor) && valor >= 0 ? valor : 0
        set({ costoFijoEnvioEmbalajeARS: normalizado })
      },

      setCostoEnvioPorPerfumeUSD: (valor: number) => {
        const normalizado =
          Number.isFinite(valor) && valor >= 0 ? Number(valor.toFixed(2)) : 0
        set({ costoEnvioPorPerfumeUSD: normalizado })
      },

      setGananciaFijaAdicionalARS: (valor: number) => {
        const normalizado = Number.isFinite(valor) && valor >= 0 ? valor : 0
        set({ gananciaFijaAdicionalARS: normalizado })
      },

      setPrecioVentaManualProducto: (
        productoId: number,
        precioARS: number | null,
      ) => {
        set((estado) => {
          const siguientes = { ...estado.preciosVentaManualesARS }
          if (
            precioARS === null ||
            !Number.isFinite(precioARS) ||
            precioARS <= 0
          ) {
            delete siguientes[productoId]
          } else {
            siguientes[productoId] = Math.round(precioARS)
          }
          return { preciosVentaManualesARS: siguientes }
        })
      },

      sincronizarPreciosManualesDesdeCatalogo: (
        mapaDesdeDB: Record<number, number>,
      ) => {
        set((estado) => ({
          preciosVentaManualesARS: {
            ...estado.preciosVentaManualesARS,
            ...mapaDesdeDB,
          },
        }))
      },

      setMostrarRentabilidadEnCatalogo: (mostrar: boolean) => {
        set({ mostrarRentabilidadEnCatalogo: mostrar })
      },

      restaurarRentabilidadPorDefecto: () => {
        set((estado) => ({
          ...CONFIG_RENTABILIDAD_INICIAL,
          preciosVentaManualesARS: estado.preciosVentaManualesARS,
        }))
      },
    }),
    {
      name: 'perfumeria-configuracion-storage',
    },
  ),
)
