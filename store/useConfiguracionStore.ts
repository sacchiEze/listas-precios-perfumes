'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  esCategoriaPerfumeValida,
  esTipoProductoValido,
  FILTROS_CATALOGO_INICIALES,
  normalizarClaveMarca,
  TAMANO_PAGINA_INICIAL,
  type CategoriaPerfume,
  type ConfiguracionMarca,
  type ConfiguracionRentabilidad,
  type CotizacionesDolarDia,
  type FiltrosCatalogo,
  type Moneda,
  type TipoCotizacionDolar,
  type TipoProducto,
  type VistaActiva,
} from '@/types/perfumeria'

export type TabMonitorOportunidades = 'arbitraje' | 'bajaron' | 'watchlist'

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
  /** Preferencia de modo oscuro en la interfaz */
  modoOscuro: boolean
  /** Última vista principal abierta por el usuario */
  vistaActiva: VistaActiva
  /** Filtros activos del catálogo */
  filtrosCatalogo: FiltrosCatalogo
  /** Campo de texto para precio mínimo filtrado */
  precioMinInput: string
  /** Campo de texto para precio máximo filtrado */
  precioMaxInput: string
  /** Si el panel desplegable de filtros del catálogo está abierto */
  filtersOpen: boolean
  /** Si el selector de marcas dentro de filtros está expandido */
  marcasAbiertas: boolean
  /** Página actual de la tabla del catálogo */
  paginaCatalogo: number
  /** Cantidad de perfumes visibles por página */
  tamanoPaginaCatalogo: number
  /** Pestaña activa en el monitor de oportunidades */
  monitorTab: TabMonitorOportunidades
  /** ID del último perfume consultado en historial */
  productoHistorialId: number | null
  /** Pestaña de proveedor seleccionada en la vista de historial */
  historySupplierTab: 'GLOBAL' | string
  /** Categoría asignada por marca (clave normalizada -> categoría) */
  categoriasPorMarca: Record<string, CategoriaPerfume | null>
  /** Tipo/subcategoría asignado manualmente por producto (productoId -> TipoProducto) */
  tiposPorProducto: Record<number, TipoProducto>
  /** Tipo/subcategoría asignado manualmente por marca (clave normalizada -> TipoProducto) */
  tiposPorMarca: Record<string, TipoProducto>
  /** Marcas eliminadas permanentemente (clave normalizada -> nombre original) */
  marcasEliminadas: Record<string, string>
  setDolarDelDia: (nuevoValor: number) => void
  setTipoDolarActivo: (tipo: TipoCotizacionDolar) => void
  setCotizacionesDolar: (cotizaciones: CotizacionesDolarDia) => void
  aplicarCotizacionAutomatica: (
    tipo: Exclude<TipoCotizacionDolar, 'manual'>,
    cotizaciones: CotizacionesDolarDia,
  ) => void
  setMonedaVisualizacion: (moneda: Moneda) => void
  alternarMonedaVisualizacion: () => void
  setModoOscuro: (valor: boolean | ((prev: boolean) => boolean)) => void
  setVistaActiva: (vista: VistaActiva) => void
  setFiltrosCatalogo: (
    actualizador: FiltrosCatalogo | ((prev: FiltrosCatalogo) => FiltrosCatalogo),
  ) => void
  setPrecioMinInput: (valor: string) => void
  setPrecioMaxInput: (valor: string) => void
  setFiltersOpen: (valor: boolean | ((prev: boolean) => boolean)) => void
  setMarcasAbiertas: (valor: boolean | ((prev: boolean) => boolean)) => void
  setPaginaCatalogo: (pagina: number | ((prev: number) => number)) => void
  setTamanoPaginaCatalogo: (tamano: number) => void
  setMonitorTab: (tab: TabMonitorOportunidades) => void
  setProductoHistorialId: (id: number | null) => void
  setHistorySupplierTab: (tab: 'GLOBAL' | string) => void
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
  setCategoriaMarca: (marca: string, categoria: CategoriaPerfume | null) => void
  setTipoProducto: (productoId: number, tipo: TipoProducto) => void
  setTipoMarca: (marca: string, tipo: TipoProducto) => void
  eliminarMarcaParaSiempre: (marca: string) => void
  restaurarMarcaEliminada: (marcaNorm: string) => void
  sincronizarConfiguracionMarcasDesdeDB: (registros: ConfiguracionMarca[]) => void
}

function normalizarFiltrosPersistidos(crudo: unknown): FiltrosCatalogo {
  if (!crudo || typeof crudo !== 'object') {
    return FILTROS_CATALOGO_INICIALES
  }
  const f = crudo as Partial<FiltrosCatalogo>
  const rangoCrudo = Array.isArray(f.rangoPrecioARS) ? f.rangoPrecioARS : []
  const rangoMin =
    typeof rangoCrudo[0] === 'number' && Number.isFinite(rangoCrudo[0])
      ? rangoCrudo[0]
      : null
  const rangoMax =
    typeof rangoCrudo[1] === 'number' && Number.isFinite(rangoCrudo[1])
      ? rangoCrudo[1]
      : null

  return {
    ...FILTROS_CATALOGO_INICIALES,
    ...f,
    busqueda: typeof f.busqueda === 'string' ? f.busqueda : '',
    marcasSeleccionadas: Array.isArray(f.marcasSeleccionadas)
      ? f.marcasSeleccionadas.filter((m): m is string => typeof m === 'string')
      : [],
    marcasOcultas: Array.isArray(f.marcasOcultas)
      ? f.marcasOcultas.filter((m): m is string => typeof m === 'string')
      : [],
    tiposSeleccionados: Array.isArray(f.tiposSeleccionados)
      ? f.tiposSeleccionados.filter((t): t is string => typeof t === 'string')
      : [],
    genero: typeof f.genero === 'string' ? f.genero : null,
    categoria: esCategoriaPerfumeValida(f.categoria)
      ? f.categoria
      : f.categoria === 'SIN_CATEGORIA'
        ? 'SIN_CATEGORIA'
        : null,
    soloEnStock: Boolean(f.soloEnStock),
    rangoPrecioARS: [rangoMin, rangoMax],
    ordenarPor: f.ordenarPor ?? FILTROS_CATALOGO_INICIALES.ordenarPor,
    pestanaActiva:
      typeof f.pestanaActiva === 'string' && f.pestanaActiva.trim() !== ''
        ? f.pestanaActiva
        : 'GLOBAL',
    filtroInteligencia:
      f.filtroInteligencia ?? FILTROS_CATALOGO_INICIALES.filtroInteligencia,
  }
}

/**
 * Store global de configuración persistido en localStorage.
 * Mantiene la cotización del dólar (automática o manual), la moneda de comparación,
 * los parámetros de rentabilidad, las opciones de vista/tema y los filtros de navegación.
 */
export const useConfiguracionStore = create<EstadoConfiguracion>()(
  persist(
    (set) => ({
      dolarDelDia: 1400,
      tipoDolarActivo: 'manual',
      cotizacionesDolar: COTIZACIONES_DOLAR_INICIALES,
      monedaVisualizacion: 'USD',
      modoOscuro: false,
      vistaActiva: 'overview',
      filtrosCatalogo: FILTROS_CATALOGO_INICIALES,
      precioMinInput: '',
      precioMaxInput: '',
      filtersOpen: false,
      marcasAbiertas: false,
      paginaCatalogo: 1,
      tamanoPaginaCatalogo: TAMANO_PAGINA_INICIAL,
      monitorTab: 'arbitraje',
      productoHistorialId: null,
      historySupplierTab: 'GLOBAL',
      categoriasPorMarca: {},
      tiposPorProducto: {},
      tiposPorMarca: {},
      marcasEliminadas: {},
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

      setModoOscuro: (valor) => {
        set((estado) => ({
          modoOscuro:
            typeof valor === 'function' ? valor(estado.modoOscuro) : Boolean(valor),
        }))
      },

      setVistaActiva: (vista: VistaActiva) => {
        set({ vistaActiva: vista })
      },

      setFiltrosCatalogo: (actualizador) => {
        set((estado) => ({
          filtrosCatalogo:
            typeof actualizador === 'function'
              ? actualizador(estado.filtrosCatalogo)
              : actualizador,
        }))
      },

      setPrecioMinInput: (valor: string) => {
        set({ precioMinInput: valor })
      },

      setPrecioMaxInput: (valor: string) => {
        set({ precioMaxInput: valor })
      },

      setFiltersOpen: (valor) => {
        set((estado) => ({
          filtersOpen:
            typeof valor === 'function' ? valor(estado.filtersOpen) : Boolean(valor),
        }))
      },

      setMarcasAbiertas: (valor) => {
        set((estado) => ({
          marcasAbiertas:
            typeof valor === 'function'
              ? valor(estado.marcasAbiertas)
              : Boolean(valor),
        }))
      },

      setPaginaCatalogo: (pagina) => {
        set((estado) => {
          const siguiente =
            typeof pagina === 'function' ? pagina(estado.paginaCatalogo) : pagina
          const normalizada =
            Number.isFinite(siguiente) && siguiente >= 1
              ? Math.floor(siguiente)
              : 1
          if (normalizada === estado.paginaCatalogo) return estado
          return { paginaCatalogo: normalizada }
        })
      },

      setTamanoPaginaCatalogo: (tamano: number) => {
        const normalizado =
          Number.isFinite(tamano) && tamano > 0
            ? Math.floor(tamano)
            : TAMANO_PAGINA_INICIAL
        set({ tamanoPaginaCatalogo: normalizado })
      },

      setMonitorTab: (tab: TabMonitorOportunidades) => {
        set({ monitorTab: tab })
      },

      setProductoHistorialId: (id: number | null) => {
        set({
          productoHistorialId:
            id !== null && Number.isFinite(id) && id > 0 ? id : null,
        })
      },

      setHistorySupplierTab: (tab: 'GLOBAL' | string) => {
        set({ historySupplierTab: tab || 'GLOBAL' })
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

      setCategoriaMarca: (marca: string, categoria: CategoriaPerfume | null) => {
        const clave = normalizarClaveMarca(marca)
        if (!clave) return
        set((estado) => ({
          categoriasPorMarca: {
            ...estado.categoriasPorMarca,
            [clave]: esCategoriaPerfumeValida(categoria) ? categoria : null,
          },
        }))
      },

      setTipoProducto: (productoId: number, tipo: TipoProducto) => {
        if (!Number.isInteger(productoId) || productoId <= 0) return
        if (!esTipoProductoValido(tipo)) return
        set((estado) => ({
          tiposPorProducto: {
            ...estado.tiposPorProducto,
            [productoId]: tipo,
          },
        }))
      },

      setTipoMarca: (marca: string, tipo: TipoProducto) => {
        const clave = normalizarClaveMarca(marca)
        if (!clave || !esTipoProductoValido(tipo)) return
        set((estado) => ({
          tiposPorMarca: {
            ...estado.tiposPorMarca,
            [clave]: tipo,
          },
        }))
      },

      eliminarMarcaParaSiempre: (marca: string) => {
        const marcaLimpia = marca.trim()
        const clave = normalizarClaveMarca(marcaLimpia)
        if (!clave) return
        set((estado) => {
          const siguientesCategorias = { ...estado.categoriasPorMarca }
          delete siguientesCategorias[clave]
          return {
            marcasEliminadas: {
              ...estado.marcasEliminadas,
              [clave]: marcaLimpia,
            },
            categoriasPorMarca: siguientesCategorias,
            filtrosCatalogo: {
              ...estado.filtrosCatalogo,
              marcasSeleccionadas: estado.filtrosCatalogo.marcasSeleccionadas.filter(
                (m) => normalizarClaveMarca(m) !== clave,
              ),
              marcasOcultas: (estado.filtrosCatalogo.marcasOcultas ?? []).filter(
                (m) => normalizarClaveMarca(m) !== clave,
              ),
            },
          }
        })
      },

      restaurarMarcaEliminada: (marcaNorm: string) => {
        const clave = normalizarClaveMarca(marcaNorm)
        if (!clave) return
        set((estado) => {
          if (!(clave in estado.marcasEliminadas)) return estado
          const siguientes = { ...estado.marcasEliminadas }
          delete siguientes[clave]
          return { marcasEliminadas: siguientes }
        })
      },

      sincronizarConfiguracionMarcasDesdeDB: (registros: ConfiguracionMarca[]) => {
        if (!Array.isArray(registros) || registros.length === 0) return
        set((estado) => {
          const siguientesCategorias = { ...estado.categoriasPorMarca }
          const siguientesEliminadas = { ...estado.marcasEliminadas }

          for (const reg of registros) {
            const clave = normalizarClaveMarca(reg.marca_norm || reg.marca)
            if (!clave) continue
            if (reg.eliminada) {
              siguientesEliminadas[clave] = reg.marca || clave
              delete siguientesCategorias[clave]
            } else {
              delete siguientesEliminadas[clave]
              siguientesCategorias[clave] = esCategoriaPerfumeValida(reg.categoria)
                ? reg.categoria
                : null
            }
          }

          return {
            categoriasPorMarca: siguientesCategorias,
            marcasEliminadas: siguientesEliminadas,
          }
        })
      },
    }),
    {
      name: 'perfumeria-configuracion-storage',
      merge: (persistedState, currentState) => {
        if (!persistedState || typeof persistedState !== 'object') {
          return currentState
        }
        const p = persistedState as Partial<EstadoConfiguracion>
        const vistaValida: VistaActiva =
          p.vistaActiva === 'overview' ||
          p.vistaActiva === 'catalog' ||
          p.vistaActiva === 'history' ||
          p.vistaActiva === 'cart'
            ? p.vistaActiva
            : currentState.vistaActiva
        const monitorTabValido: TabMonitorOportunidades =
          p.monitorTab === 'arbitraje' ||
          p.monitorTab === 'bajaron' ||
          p.monitorTab === 'watchlist'
            ? p.monitorTab
            : currentState.monitorTab

        return {
          ...currentState,
          ...p,
          modoOscuro:
            typeof p.modoOscuro === 'boolean'
              ? p.modoOscuro
              : currentState.modoOscuro,
          vistaActiva: vistaValida,
          filtrosCatalogo: normalizarFiltrosPersistidos(p.filtrosCatalogo),
          precioMinInput:
            typeof p.precioMinInput === 'string'
              ? p.precioMinInput
              : currentState.precioMinInput,
          precioMaxInput:
            typeof p.precioMaxInput === 'string'
              ? p.precioMaxInput
              : currentState.precioMaxInput,
          filtersOpen:
            typeof p.filtersOpen === 'boolean'
              ? p.filtersOpen
              : currentState.filtersOpen,
          marcasAbiertas:
            typeof p.marcasAbiertas === 'boolean'
              ? p.marcasAbiertas
              : currentState.marcasAbiertas,
          paginaCatalogo:
            typeof p.paginaCatalogo === 'number' &&
            Number.isFinite(p.paginaCatalogo) &&
            p.paginaCatalogo >= 1
              ? Math.floor(p.paginaCatalogo)
              : currentState.paginaCatalogo,
          tamanoPaginaCatalogo:
            typeof p.tamanoPaginaCatalogo === 'number' &&
            Number.isFinite(p.tamanoPaginaCatalogo) &&
            p.tamanoPaginaCatalogo > 0
              ? Math.floor(p.tamanoPaginaCatalogo)
              : currentState.tamanoPaginaCatalogo,
          monitorTab: monitorTabValido,
          productoHistorialId:
            typeof p.productoHistorialId === 'number' &&
            Number.isFinite(p.productoHistorialId) &&
            p.productoHistorialId > 0
              ? p.productoHistorialId
              : null,
          historySupplierTab:
            typeof p.historySupplierTab === 'string' &&
            p.historySupplierTab.trim() !== ''
              ? p.historySupplierTab
              : currentState.historySupplierTab,
          margenPorTipo:
            p.margenPorTipo && typeof p.margenPorTipo === 'object'
              ? p.margenPorTipo
              : currentState.margenPorTipo,
          preciosVentaManualesARS:
            p.preciosVentaManualesARS &&
            typeof p.preciosVentaManualesARS === 'object'
              ? p.preciosVentaManualesARS
              : currentState.preciosVentaManualesARS,
          cotizacionesDolar:
            p.cotizacionesDolar && typeof p.cotizacionesDolar === 'object'
              ? { ...currentState.cotizacionesDolar, ...p.cotizacionesDolar }
              : currentState.cotizacionesDolar,
          categoriasPorMarca:
            p.categoriasPorMarca &&
            typeof p.categoriasPorMarca === 'object' &&
            !Array.isArray(p.categoriasPorMarca)
              ? p.categoriasPorMarca
              : currentState.categoriasPorMarca,
          tiposPorProducto:
            p.tiposPorProducto &&
            typeof p.tiposPorProducto === 'object' &&
            !Array.isArray(p.tiposPorProducto)
              ? p.tiposPorProducto
              : currentState.tiposPorProducto,
          tiposPorMarca:
            p.tiposPorMarca &&
            typeof p.tiposPorMarca === 'object' &&
            !Array.isArray(p.tiposPorMarca)
              ? p.tiposPorMarca
              : currentState.tiposPorMarca,
          marcasEliminadas:
            p.marcasEliminadas &&
            typeof p.marcasEliminadas === 'object' &&
            !Array.isArray(p.marcasEliminadas)
              ? p.marcasEliminadas
              : currentState.marcasEliminadas,
        }
      },
    },
  ),
)

const CLAVE_SCROLL_NAVEGACION = 'perfumeria-scroll-navegacion'

export interface EstadoScrollNavegacion {
  scrollY: number
  scrollLeft: number
}

/**
 * Lee desde localStorage la última posición de desplazamiento vertical y horizontal de la tabla.
 */
export function leerScrollNavegacion(): EstadoScrollNavegacion {
  if (typeof window === 'undefined') {
    return { scrollY: 0, scrollLeft: 0 }
  }
  try {
    const crudo = window.localStorage.getItem(CLAVE_SCROLL_NAVEGACION)
    if (!crudo) return { scrollY: 0, scrollLeft: 0 }
    const parsed = JSON.parse(crudo) as Partial<EstadoScrollNavegacion>
    return {
      scrollY:
        typeof parsed.scrollY === 'number' &&
        Number.isFinite(parsed.scrollY) &&
        parsed.scrollY > 0
          ? parsed.scrollY
          : 0,
      scrollLeft:
        typeof parsed.scrollLeft === 'number' &&
        Number.isFinite(parsed.scrollLeft) &&
        parsed.scrollLeft > 0
          ? parsed.scrollLeft
          : 0,
    }
  } catch {
    return { scrollY: 0, scrollLeft: 0 }
  }
}

/**
 * Persiste en localStorage la posición actual de desplazamiento (vertical u horizontal).
 */
export function guardarScrollNavegacion(
  parcial: Partial<EstadoScrollNavegacion>,
): void {
  if (typeof window === 'undefined') return
  try {
    const actual = leerScrollNavegacion()
    const siguiente: EstadoScrollNavegacion = {
      scrollY:
        parcial.scrollY !== undefined &&
        Number.isFinite(parcial.scrollY) &&
        parcial.scrollY >= 0
          ? Math.round(parcial.scrollY)
          : actual.scrollY,
      scrollLeft:
        parcial.scrollLeft !== undefined &&
        Number.isFinite(parcial.scrollLeft) &&
        parcial.scrollLeft >= 0
          ? Math.round(parcial.scrollLeft)
          : actual.scrollLeft,
    }
    window.localStorage.setItem(
      CLAVE_SCROLL_NAVEGACION,
      JSON.stringify(siguiente),
    )
  } catch {
    // Ignorar errores de almacenamiento (modo privado / cuota llena)
  }
}
