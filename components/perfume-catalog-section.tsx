'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Activity,
  ArrowDownUp,
  ArrowRight,
  Bell,
  BellRing,
  Boxes,
  Calculator,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  Filter,
  LayoutDashboard,
  Loader2,
  Moon,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  ShoppingBag,
  Sparkles,
  Star,
  Sun,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  Users,
  Wallet,
  X,
  Zap,
} from 'lucide-react'
import {
  FILTROS_CATALOGO_INICIALES,
  useCatalogoPerfumes,
} from '@/hooks/useCatalogoPerfumes'
import {
  aplicarImportacionEnMemoria,
  generarPrevisualizacionImportacion,
  PLANTILLA_EJEMPLO_IMPORTACION,
} from '@/lib/importadorListas'
import {
  calcularRentabilidadUnitaria,
  construirUrlBusquedaMercadoLibre,
  construirUrlFragrantica,
  generarVariacionesRespaldo,
} from '@/lib/rentabilidad'
import { estaSupabaseConfigurado } from '@/lib/supabase/cliente'
import {
  MiniaturaPerfumeEditable,
  ModalEditorImagenPerfume,
  type ModoEditorImagen,
} from '@/components/image-editor-modal'
import {
  actualizarImagenProducto,
  actualizarPrecioVentaManualProducto,
  obtenerHistorialPorProducto,
  obtenerMapaVariacionesPrecios,
  obtenerTodoElCatalogo,
  subirImagenProductoOptimizada,
} from '@/services/catalogoService'
import {
  calcularResumenesPorProveedor,
  useCarritoStore,
} from '@/store/useCarritoStore'
import {
  CONFIG_RENTABILIDAD_INICIAL,
  COTIZACIONES_DOLAR_INICIALES,
  useConfiguracionStore,
} from '@/store/useConfiguracionStore'
import {
  necesitaReposicion,
  unidadesFaltantesReposicion,
  useStockPropioStore,
} from '@/store/useStockPropioStore'
import {
  evaluarAlertasWatchlist,
  useWatchlistStore,
} from '@/store/useWatchlistStore'
import type {
  AlertaWatchlistEvaluada,
  CategoriaPerfume,
  ConfiguracionRentabilidad,
  CotizacionesDolarDia,
  CriterioOrdenamiento,
  FilaVistaComparador,
  FiltrosCatalogo,
  FiltroInteligenciaPrecios,
  GeneroPerfume,
  ItemWatchlist,
  MapaVariacionesPrecios,
  ModoEscalaMayorista,
  Moneda,
  OfertaProveedor,
  ProductoComparado,
  PuntoHistorialGrafico,
  RegistroStockPropio,
  ResultadoSincronizacionImagenes,
  ResumenPrevisualizacionImportacion,
  TipoCotizacionDolar,
  TipoProducto,
} from '@/types/perfumeria'
import {
  type VistaActiva,
  OPCIONES_TAMANO_PAGINA,
  TAMANO_PAGINA_INICIAL,
  MAX_TAMANO_PAGINA,
  LIMITE_FILAS_RESUMEN,
  TIPOS_PRODUCTO_DISPONIBLES,
  obtenerEstiloTipoProducto,
  GENEROS_FILTRO,
  CATEGORIAS_FILTRO,
  obtenerEstiloCategoriaPerfume,
  OPCIONES_ORDENAMIENTO,
  OPCIONES_ESCALA,
  obtenerColorProveedor,
  formatearMoneda,
  FILAS_DEMO_RESPALDO,
  construirHistorialDemo,
  ImagenFrasco,
  SectionTitle,
  GraficoEvolucionPrecios,
} from './perfume-shared'

export function CatalogSection({
  productos,
  totalSinFiltrar,
  proveedoresDisponibles,
  marcasDisponibles,
  tiposDisponibles,
  filtros,
  setFiltros,
  precioMinInput,
  setPrecioMinInput,
  precioMaxInput,
  setPrecioMaxInput,
  onLimpiarFiltros,
  alternarMarcaFiltro,
  cantidadFiltrosActivos,
  monedaVisualizacion,
  dolarDelDia,
  configRentabilidad,
  conteosInteligencia,
  itemsWatchlist,
  alertasPorProductoId,
  registrosStockPropio,
  onAjustarStock,
  onSetStockProducto,
  onSetStockMinimo,
  onQuitarStock,
  onAgregarFaltantesAlCarrito,
  onAbrirModalAlerta,
  onAbrirRentabilidad,
  onAbrirImportador,
  onGuardarPrecioManual,
  onCambiarCategoria,
  cargandoCatalogo,
  onAdd,
  onHistory,
  onFiltrarMarca,
  onEditImage,
  onAll,
  filtersOpen,
  setFiltersOpen,
  maxRows,
  paginaActual,
  onCambiarPagina,
  tamanoPagina,
  onCambiarTamanoPagina,
  mapIndicesProveedores,
}: {
  productos: ProductoComparado[]
  totalSinFiltrar: number
  proveedoresDisponibles: string[]
  marcasDisponibles: string[]
  tiposDisponibles: TipoProducto[]
  filtros: FiltrosCatalogo
  setFiltros: React.Dispatch<React.SetStateAction<FiltrosCatalogo>>
  precioMinInput: string
  setPrecioMinInput: (value: string) => void
  precioMaxInput: string
  setPrecioMaxInput: (value: string) => void
  onLimpiarFiltros: () => void
  alternarMarcaFiltro: (marca: string) => void
  cantidadFiltrosActivos: number
  monedaVisualizacion: Moneda
  dolarDelDia: number
  configRentabilidad: ConfiguracionRentabilidad
  conteosInteligencia: {
    bajaron: number
    subieron: number
    arbitraje: number
    seguimiento: number
    alertasActivas: number
    faltaReponer: number
  }
  itemsWatchlist: Record<number, ItemWatchlist>
  alertasPorProductoId: Map<number, AlertaWatchlistEvaluada>
  registrosStockPropio: Record<number, RegistroStockPropio>
  onAjustarStock: (productoId: number, delta: number) => void
  onSetStockProducto: (
    productoId: number,
    cantidadActual: number,
    stockMinimo?: number,
  ) => void
  onSetStockMinimo: (productoId: number, stockMinimo: number) => void
  onQuitarStock: (productoId: number) => void
  onAgregarFaltantesAlCarrito: () => void
  onAbrirModalAlerta: (producto: ProductoComparado) => void
  onAbrirRentabilidad: () => void
  onAbrirImportador: () => void
  onGuardarPrecioManual: (
    producto: ProductoComparado,
    nuevoPrecioARS: number | null,
  ) => Promise<void>
  cargandoCatalogo: boolean
  onCambiarCategoria: (
    producto: ProductoComparado,
    nuevaCategoria: CategoriaPerfume | null,
  ) => Promise<void>
  onAdd: (producto: ProductoComparado, oferta: OfertaProveedor) => void
  onHistory: (producto: ProductoComparado) => void
  onFiltrarMarca: (marca: string) => void
  onEditImage: (
    producto: ProductoComparado,
    modo?: ModoEditorImagen,
    archivo?: File | null,
  ) => void
  onAll?: () => void
  filtersOpen: boolean
  setFiltersOpen: (value: boolean) => void
  maxRows?: number
  paginaActual: number
  onCambiarPagina: (pagina: number) => void
  tamanoPagina: number
  onCambiarTamanoPagina: (tamano: number) => void
  mapIndicesProveedores: Map<string, number>
}) {
    const filtroArbitrajeActivo = filtros.filtroInteligencia === 'ARBITRAJE'

  const alternarOportunidadesArbitraje = () => {
    if (filtroArbitrajeActivo) {
      setFiltros((prev) => ({
        ...prev,
        filtroInteligencia: 'TODOS',
      }))
    } else {
      setFiltros((prev) => ({
        ...prev,
        filtroInteligencia: 'ARBITRAJE',
        ordenarPor: 'mayor_brecha',
        pestanaActiva: 'GLOBAL',
      }))
    }
    onCambiarPagina(1)
  }

  const displayedSuppliers =
    filtros.pestanaActiva === 'GLOBAL'
      ? proveedoresDisponibles
      : [filtros.pestanaActiva]

  const [editandoPrecioId, setEditandoPrecioId] = useState<number | null>(null)
  const [precioManualInput, setPrecioManualInput] = useState<string>('')
  const [guardandoPrecioId, setGuardandoPrecioId] = useState<number | null>(null)

  const iniciarEdicionPrecioManual = (
    item: ProductoComparado,
    pvpActualARS: number,
  ) => {
    setEditandoPrecioId(item.producto_id)
    setPrecioManualInput(String(Math.round(pvpActualARS)))
  }

  const confirmarPrecioManualFila = async (item: ProductoComparado) => {
    const numero = Number(precioManualInput)
    if (!Number.isFinite(numero) || numero <= 0) return
    setGuardandoPrecioId(item.producto_id)
    try {
      await onGuardarPrecioManual(item, Math.round(numero))
      setEditandoPrecioId(null)
    } finally {
      setGuardandoPrecioId(null)
    }
  }

  const limpiarPrecioManualFila = async (item: ProductoComparado) => {
    setGuardandoPrecioId(item.producto_id)
    try {
      await onGuardarPrecioManual(item, null)
      setEditandoPrecioId(null)
    } finally {
      setGuardandoPrecioId(null)
    }
  }

  const totalPaginas = maxRows
    ? 1
    : Math.max(1, Math.ceil(productos.length / tamanoPagina))
  const paginaSegura = Math.min(paginaActual, totalPaginas)
  const indiceInicio = maxRows ? 0 : (paginaSegura - 1) * tamanoPagina
  const indiceFin = maxRows
    ? Math.min(maxRows, productos.length)
    : Math.min(indiceInicio + tamanoPagina, productos.length)

  const siguienteTamanoPagina =
    OPCIONES_TAMANO_PAGINA.find((opcion) => opcion > tamanoPagina) ??
    MAX_TAMANO_PAGINA
  const puedeCargarMasEnPagina =
    !maxRows &&
    indiceFin < productos.length &&
    tamanoPagina < MAX_TAMANO_PAGINA

  const filasVisibles = productos.slice(indiceInicio, indiceFin)

  const pildorasInteligencia: Array<{
    id: FiltroInteligenciaPrecios
    etiqueta: string
    count?: number
    destacado?: boolean
  }> = [
    { id: 'TODOS', etiqueta: 'Todos' },
    {
      id: 'BAJARON',
      etiqueta: '↓ Bajaron de precio',
      count: conteosInteligencia.bajaron,
    },
    {
      id: 'SUBIERON',
      etiqueta: '↑ Subas recientes',
      count: conteosInteligencia.subieron,
    },
    {
      id: 'ARBITRAJE',
      etiqueta: '⚡ Más baratos vs otros (≥5%)',
      count: conteosInteligencia.arbitraje,
    },
    {
      id: 'SEGUIMIENTO',
      etiqueta: '★ En seguimiento',
      count: conteosInteligencia.seguimiento,
    },
    {
      id: 'ALERTAS_ACTIVAS',
      etiqueta: '🔔 Alertas cumplidas',
      count: conteosInteligencia.alertasActivas,
      destacado: conteosInteligencia.alertasActivas > 0,
    },
  ]

  return (
    <section className="dashboard-card overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">
            Catálogo y comparador
          </h2>
          <p className="mt-1 text-[11px] text-slate-400">
            {productos.length} de {totalSinFiltrar} productos
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={alternarOportunidadesArbitraje}
            title="Mostrar perfumes que están significativamente más baratos en un proveedor respecto a los demás en la lista"
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
              filtroArbitrajeActivo
                ? 'border-amber-400 bg-amber-500 text-white shadow-xs hover:bg-amber-600'
                : 'border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-400 hover:bg-amber-100'
            }`}
          >
            <Zap
              size={13}
              className={
                filtroArbitrajeActivo
                  ? 'fill-white text-white'
                  : 'fill-amber-600 text-amber-600'
              }
            />
            <span>Más baratos entre listas</span>
            {conteosInteligencia.arbitraje > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  filtroArbitrajeActivo
                    ? 'bg-white/25 text-white'
                    : 'bg-amber-200 text-amber-950'
                }`}
              >
                {conteosInteligencia.arbitraje}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onAbrirImportador}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <FileSpreadsheet size={12} className="text-violet-600" />
            <span>Importar lista</span>
          </button>

          <button
            type="button"
            onClick={onAbrirRentabilidad}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50"
          >
            <Calculator size={12} className="text-violet-600" />
            <span>
              Reventa +{configRentabilidad.margenGeneralPorcentaje}%
            </span>
          </button>

          {onAll ? (
            <button
              type="button"
              onClick={onAll}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-700 hover:text-violet-900"
            >
              Ver catálogo completo <ArrowRight size={13} />
            </button>
          ) : (
            !maxRows && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium text-slate-400">
                  Por página:
                </span>
                <div
                  role="group"
                  aria-label="Cantidad de perfumes por página"
                  className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5"
                >
                  {OPCIONES_TAMANO_PAGINA.map((opcion) => (
                    <button
                      key={opcion}
                      type="button"
                      onClick={() => onCambiarTamanoPagina(opcion)}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                        tamanoPagina === opcion
                          ? 'bg-violet-600 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-white hover:text-slate-900'
                      }`}
                    >
                      {opcion}
                    </button>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:px-5 lg:flex-row lg:items-center">
        <label className="relative min-w-0 flex-1 lg:max-w-[320px]">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={filtros.busqueda}
            onChange={(event) =>
              setFiltros((prev) => ({ ...prev, busqueda: event.target.value }))
            }
            placeholder="Buscar perfume, marca, ml o EAN6"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[11px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
        </label>

        <div className="scrollbar-none flex min-w-0 gap-1 overflow-x-auto">
          {(['GLOBAL', ...proveedoresDisponibles] as const).map((nombre) => (
            <button
              type="button"
              key={nombre}
              onClick={() =>
                setFiltros((prev) => ({ ...prev, pestanaActiva: nombre }))
              }
              className={`shrink-0 rounded-md px-3 py-2 text-[11px] font-medium transition ${
                filtros.pestanaActiva === nombre
                  ? 'bg-violet-50 text-violet-800'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {nombre === 'GLOBAL' ? 'Todos los proveedores' : nombre}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <select
            aria-label="Ordenar catálogo"
            value={filtros.ordenarPor}
            onChange={(event) =>
              setFiltros((prev) => ({
                ...prev,
                ordenarPor: event.target.value as CriterioOrdenamiento,
              }))
            }
            className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-600 outline-none"
          >
            {OPCIONES_ORDENAMIENTO.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setFiltersOpen(!filtersOpen)}
            aria-expanded={filtersOpen}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-medium transition ${
              filtersOpen
                ? 'border-violet-200 bg-violet-50 text-violet-800'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Filter size={13} />
            <span>Filtros</span>
            {cantidadFiltrosActivos > 0 && (
              <span className="flex size-4 items-center justify-center rounded-full bg-violet-700 text-[9px] font-semibold text-white">
                {cantidadFiltrosActivos}
              </span>
            )}
            <ChevronDown size={12} />
          </button>

          <span className="hidden h-5 border-l border-slate-200 sm:block" />
          <span className="hidden text-[10px] text-slate-400 sm:inline">
            Precios en USD y ARS
          </span>
        </div>
      </div>

      {/* Píldoras rápidas de Inteligencia de Precios, Watchlist y Reposición */}
      <div className="scrollbar-none flex items-center gap-1.5 overflow-x-auto border-b border-slate-100 bg-slate-50/70 px-4 py-2.5 sm:px-5">
        <span className="mr-1 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Inteligencia
        </span>
        {pildorasInteligencia.map((pildora) => {
          const activo = filtros.filtroInteligencia === pildora.id
          return (
            <button
              key={pildora.id}
              type="button"
              onClick={() =>
                setFiltros((prev) => ({
                  ...prev,
                  filtroInteligencia:
                    prev.filtroInteligencia === pildora.id && pildora.id !== 'TODOS'
                      ? 'TODOS'
                      : pildora.id,
                }))
              }
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                activo
                  ? 'border-violet-300 bg-[#34294d] text-white'
                  : pildora.destacado
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>{pildora.etiqueta}</span>
              {pildora.count !== undefined && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-semibold ${
                    activo
                      ? 'bg-white/20 text-white'
                      : pildora.destacado
                        ? 'bg-emerald-200/70 text-emerald-800'
                        : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {pildora.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {filtersOpen && (
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3.5 sm:px-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Género
              </span>
              {GENEROS_FILTRO.map(({ etiqueta, valor }) => (
                <button
                  type="button"
                  key={etiqueta}
                  onClick={() =>
                    setFiltros((prev) => ({ ...prev, genero: valor }))
                  }
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                    filtros.genero === valor
                      ? 'bg-[#34294d] text-white'
                      : 'bg-white text-slate-500 ring-1 ring-slate-200'
                  }`}
                >
                  {etiqueta}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Categoría
              </span>
              {CATEGORIAS_FILTRO.map(({ etiqueta, valor }) => (
                <button
                  type="button"
                  key={etiqueta}
                  onClick={() =>
                    setFiltros((prev) => ({ ...prev, categoria: valor }))
                  }
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                    filtros.categoria === valor
                      ? 'bg-[#34294d] text-white'
                      : 'bg-white text-slate-500 ring-1 ring-slate-200'
                  }`}
                >
                  {etiqueta}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Tipo
              </span>
              <select
                aria-label="Filtrar por tipo de producto"
                value={filtros.tiposSeleccionados[0] ?? 'TODOS'}
                onChange={(event) => {
                  const valor = event.target.value
                  setFiltros((prev) => ({
                    ...prev,
                    tiposSeleccionados: valor === 'TODOS' ? [] : [valor],
                  }))
                }}
                className="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none"
              >
                <option value="TODOS">Todos</option>
                {(tiposDisponibles.length > 0
                  ? tiposDisponibles
                  : TIPOS_PRODUCTO_DISPONIBLES
                ).map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Precio (USD)
              </span>
              <input
                aria-label="Precio mínimo"
                type="number"
                min="0"
                value={precioMinInput}
                onChange={(event) => setPrecioMinInput(event.target.value)}
                placeholder="Mín"
                className="h-7 w-20 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none"
              />
              <span className="text-[10px] text-slate-400">-</span>
              <input
                aria-label="Precio máximo"
                type="number"
                min="0"
                value={precioMaxInput}
                onChange={(event) => setPrecioMaxInput(event.target.value)}
                placeholder="Máx"
                className="h-7 w-20 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none"
              />
            </div>

            <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={filtros.soloEnStock}
                onChange={(event) =>
                  setFiltros((prev) => ({
                    ...prev,
                    soloEnStock: event.target.checked,
                  }))
                }
                className="size-3.5 accent-violet-700"
              />
              Solo con stock
            </label>

            <button
              type="button"
              onClick={onLimpiarFiltros}
              className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-700"
            >
              <X size={12} />
              Limpiar
            </button>
          </div>

          {marcasDisponibles.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-200/70 pt-2.5">
              <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Marcas
              </span>
              <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                <button
                  type="button"
                  onClick={() =>
                    setFiltros((prev) => ({ ...prev, marcasSeleccionadas: [] }))
                  }
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${
                    filtros.marcasSeleccionadas.length === 0
                      ? 'bg-[#34294d] text-white'
                      : 'bg-white text-slate-500 ring-1 ring-slate-200'
                  }`}
                >
                  Todas
                </button>
                {marcasDisponibles.map((marca) => {
                  const seleccionada =
                    filtros.marcasSeleccionadas.includes(marca)
                  return (
                    <button
                      type="button"
                      key={marca}
                      onClick={() => alternarMarcaFiltro(marca)}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${
                        seleccionada
                          ? 'bg-[#34294d] text-white'
                          : 'bg-white text-slate-500 ring-1 ring-slate-200'
                      }`}
                    >
                      {marca}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {filtroArbitrajeActivo && (
        <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50/90 px-4 py-2.5 text-xs sm:px-5">
          <div className="flex items-center gap-2 text-amber-900">
            <Zap size={14} className="shrink-0 fill-amber-500 text-amber-600" />
            <span>
              Mostrando perfumes donde un proveedor está <strong>notablemente más barato (≥5%)</strong> respecto a los demás en la lista.
            </span>
          </div>
          <button
            type="button"
            onClick={alternarOportunidadesArbitraje}
            className="inline-flex shrink-0 items-center gap-1 rounded border border-amber-300 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 transition hover:bg-amber-100"
          >
            <X size={11} />
            Mostrar todos
          </button>
        </div>
      )}

      {cargandoCatalogo ? (
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-[12px] text-slate-500">
          <Loader2 size={20} className="animate-spin text-violet-600" />
          <span>Cargando catálogo mayorista...</span>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 sm:px-5">Tipo</th>
                  <th className="px-4 py-3 sm:px-5">Producto</th>
                  {displayedSuppliers.map((nombre) => (
                    <th key={nombre} className="px-3 py-3">
                      <span className="flex items-center gap-2">
                        <span
                          className="size-1.5 rounded-full"
                          style={{
                            backgroundColor: obtenerColorProveedor(
                              nombre,
                              mapIndicesProveedores.get(nombre) ?? 0,
                            ),
                          }}
                        />
                        {nombre}
                      </span>
                    </th>
                  ))}
                  <th className="px-3 py-3">Mejor precio</th>
                  {configRentabilidad.mostrarRentabilidadEnCatalogo && (
                    <th className="px-3 py-3">Reventa sugerida</th>
                  )}
                  <th className="px-4 py-3 text-right sm:px-5">Acción</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filasVisibles.map((item) => {
                  const mejorProveedor = item.proveedorMasBarato
                  const mejorOferta = mejorProveedor
                    ? item.ofertas[mejorProveedor]
                    : undefined
                  const mejorPrecioMostrado =
                    monedaVisualizacion === 'USD'
                      ? item.mejorPrecioUSD
                      : item.mejorPrecioARS
                  const estiloTipo = obtenerEstiloTipoProducto(item.tipo)
                  const enWatchlist = Boolean(itemsWatchlist[item.producto_id])
                  const alertaEvaluada = alertasPorProductoId.get(
                    item.producto_id,
                  )
                  const registroStock = registrosStockPropio[item.producto_id]
                  const faltaReponer = necesitaReposicion(registroStock)
                  const faltantesStock =
                    unidadesFaltantesReposicion(registroStock)

                  const costoMlMostrado =
                    monedaVisualizacion === 'USD'
                      ? item.mejorCostoPorMlUSD
                      : item.mejorCostoPorMlARS
                  const costo100MlMostrado =
                    monedaVisualizacion === 'USD'
                      ? item.mejorCostoPor100MlUSD
                      : item.mejorCostoPor100MlARS
                  const ahorroArbitrajeMostrado =
                    monedaVisualizacion === 'USD'
                      ? item.ahorroArbitrajeUSD
                      : item.ahorroArbitrajeARS

                  const rentabilidadProducto =
                    configRentabilidad.mostrarRentabilidadEnCatalogo &&
                    item.tieneStockDisponible &&
                    item.mejorPrecioARS !== null
                      ? calcularRentabilidadUnitaria({
                          productoId: item.producto_id,
                          costoARS: item.mejorPrecioARS,
                          costoUSD: item.mejorPrecioUSD,
                          ml: item.ml,
                          tipo: item.tipo,
                          dolarDelDia,
                          config: configRentabilidad,
                          precioVentaManualARS: item.precioVentaManualARS,
                        })
                      : null

                  const urlMercadoLibre = construirUrlBusquedaMercadoLibre({
                    marca: item.marca,
                    nombre: item.nombre,
                    concentracion: item.concentracion,
                    ml: item.ml,
                  })

                  return (
                    <tr
                      key={item.producto_id}
                      className="catalog-row group transition hover:bg-slate-50/70"
                    >
                      <td className="whitespace-nowrap px-4 py-3 sm:px-5">
                        <div className="mb-1">
                          <select
                            aria-label={`Categoría de ${item.marca} ${item.nombre}`}
                            value={item.categoria ?? ''}
                            onChange={(event) => {
                              const val = event.target.value
                              const nuevaCat: CategoriaPerfume | null =
                                val === 'Arabe' || val === 'Premium'
                                  ? val
                                  : null
                              void onCambiarCategoria(item, nuevaCat)
                            }}
                            className={`h-6 cursor-pointer rounded-md border px-1.5 text-[10px] font-semibold outline-none transition ${obtenerEstiloCategoriaPerfume(item.categoria)}`}
                          >
                            <option value="">Sin categoría</option>
                            <option value="Arabe">Árabe</option>
                            <option value="Premium">Premium</option>
                          </select>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-[11px] font-medium ${estiloTipo.badgeClass}`}
                        >
                          {item.tipo}
                        </span>
                      </td>

                      <td className={`px-4 py-1.5 sm:px-5 ${estiloTipo.cellClass}`}>
                        <div className="flex min-w-[245px] items-center gap-3">
                          <MiniaturaPerfumeEditable
                            producto={item}
                            onAbrirEditor={onEditImage}
                            tamanoClase="size-[72px]"
                          />

                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onHistory(item)}
                                title={`Abrir ficha, precios e historial de ${item.marca} ${item.nombre}`}
                                className="truncate text-left text-[13px] font-bold text-slate-900 transition hover:text-violet-700 hover:underline"
                              >
                                {item.nombre}
                              </button>
                              {alertaEvaluada?.cumplePrecioObjetivo && (
                                <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                                  Objetivo
                                </span>
                              )}
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                              <button
                                type="button"
                                onClick={() => onFiltrarMarca(item.marca)}
                                title={`Buscar todos los perfumes de ${item.marca} en la tabla`}
                                className="font-medium text-slate-500 transition hover:text-violet-700 hover:underline"
                              >
                                {item.marca}
                              </button>{' '}
                              · {item.concentracion ?? item.tipo}
                              {item.ml !== null ? ` · ${item.ml} ml` : ''}
                              {item.genero ? ` · ${item.genero}` : ''}
                            </span>
                          </span>
                        </div>
                      </td>

                      {displayedSuppliers.map((nombre) => {
                        const oferta = item.ofertas[nombre]
                        const variacion = oferta?.variacionPorcentaje ?? null
                        const mostrarVariacion =
                          variacion !== null && Math.abs(variacion) >= 0.1
                        const tituloVariacion =
                          oferta?.precioAnterior !== null &&
                          oferta?.precioAnterior !== undefined
                            ? `Precio anterior: ${formatearMoneda(
                                oferta.precioAnterior,
                                oferta.moneda,
                              )}${
                                oferta.fechaPrecioAnterior
                                  ? ` (${oferta.fechaPrecioAnterior})`
                                  : ''
                              }`
                            : undefined

                        return (
                          <td key={nombre} className="px-3 py-3">
                            {oferta && oferta.precioBase !== null ? (
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span
                                      className={`text-[13px] font-bold tracking-tight ${
                                        oferta.disponible
                                          ? 'text-slate-900'
                                          : 'text-slate-400 line-through text-[12px]'
                                      }`}
                                    >
                                      {oferta.precioBaseEnUSD !== null
                                        ? formatearMoneda(
                                            oferta.precioBaseEnUSD,
                                            'USD',
                                          )
                                        : '—'}
                                    </span>

                                    {mostrarVariacion && variacion !== null && (
                                      <span
                                        title={tituloVariacion}
                                        className={`inline-flex items-center rounded px-1.5 py-0.2 text-[10px] font-semibold ${
                                          variacion < 0
                                            ? 'bg-emerald-50 text-emerald-700'
                                            : 'bg-rose-50 text-rose-600'
                                        }`}
                                      >
                                        {variacion < 0
                                          ? `↓ ${Math.abs(variacion).toFixed(1)}%`
                                          : `↑ +${variacion.toFixed(1)}%`}
                                      </span>
                                    )}
                                  </div>

                                  {oferta.disponible &&
                                    oferta.precioBaseEnARS !== null && (
                                      <span className="block text-[11px] font-medium text-slate-500">
                                        {formatearMoneda(
                                          oferta.precioBaseEnARS,
                                          'ARS',
                                        )}
                                      </span>
                                    )}

                                  {(oferta.precio12 !== null ||
                                    oferta.precio24 !== null) && (
                                    <span className="block text-[10px] text-slate-500">
                                      {oferta.precio12 !== null
                                        ? `12+ ${formatearMoneda(
                                            oferta.precio12EnUSD ?? oferta.precio12,
                                            'USD',
                                          )} (${formatearMoneda(
                                            oferta.precio12EnARS ?? (oferta.precio12 * dolarDelDia),
                                            'ARS',
                                          )})`
                                        : ''}
                                      {oferta.precio12 !== null &&
                                      oferta.precio24 !== null
                                        ? ' · '
                                        : ''}
                                      {oferta.precio24 !== null
                                        ? `24+ ${formatearMoneda(
                                            oferta.precio24EnUSD ?? oferta.precio24,
                                            'USD',
                                          )} (${formatearMoneda(
                                            oferta.precio24EnARS ?? (oferta.precio24 * dolarDelDia),
                                            'ARS',
                                          )})`
                                        : ''}
                                    </span>
                                  )}

                                  {!oferta.disponible && (
                                    <span className="block text-[10px] font-medium text-rose-500">
                                      {oferta.estadoStock || 'Sin stock'}
                                    </span>
                                  )}
                                </div>

                                {oferta.disponible && (
                                  <button
                                    type="button"
                                    onClick={() => onAdd(item, oferta)}
                                    title={`Agregar oferta de ${nombre} al carrito`}
                                    aria-label={`Agregar ${item.nombre} de ${nombre} al carrito`}
                                    className="row-action flex size-6 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:border-violet-300 hover:text-violet-700"
                                  >
                                    <Plus size={12} />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-300">
                                —
                              </span>
                            )}
                          </td>
                        )
                      })}

                      <td className="px-3 py-3">
                        {item.tieneStockDisponible &&
                        mejorOferta &&
                        item.mejorPrecioUSD !== null ? (
                          <div className="min-w-[130px]">
                            <span className="text-[13px] font-extrabold text-slate-900">
                              {formatearMoneda(item.mejorPrecioUSD, 'USD')}
                            </span>
                            {item.mejorPrecioARS !== null && (
                              <span className="block text-[11px] font-bold text-slate-700">
                                {formatearMoneda(item.mejorPrecioARS, 'ARS')}
                              </span>
                            )}
                            <span className="block text-[11px] font-semibold text-emerald-700">
                              Mejor oferta · {mejorProveedor}
                            </span>

                            {item.brechaArbitrajePorcentaje !== null &&
                              item.brechaArbitrajePorcentaje >= 2 &&
                              item.proveedorSegundoMasBarato && (
                                <span
                                  title={
                                    item.ahorroArbitrajeUSD !== null &&
                                    item.ahorroArbitrajeARS !== null
                                      ? `Ahorro unitario: ${formatearMoneda(
                                          item.ahorroArbitrajeUSD,
                                          'USD',
                                        )} / ${formatearMoneda(
                                          item.ahorroArbitrajeARS,
                                          'ARS',
                                        )}`
                                      : undefined
                                  }
                                  className="mt-0.5 inline-flex items-center gap-1 rounded bg-violet-50 px-1.5 py-0.2 text-[10px] font-semibold text-violet-700"
                                >
                                  <Zap size={9} />
                                  Ahorrás{' '}
                                  {item.brechaArbitrajePorcentaje.toFixed(1)}% vs{' '}
                                  {item.proveedorSegundoMasBarato}
                                </span>
                              )}

                            {item.mejorCostoPor100MlUSD !== null && (
                              <span className="block text-[10px] text-slate-400">
                                {formatearMoneda(
                                  item.mejorCostoPor100MlUSD,
                                  'USD',
                                )}
                                {item.mejorCostoPor100MlARS !== null &&
                                  ` (${formatearMoneda(
                                    item.mejorCostoPor100MlARS,
                                    'ARS',
                                  )})`}
                                /100ml
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            Sin stock
                          </span>
                        )}
                      </td>

                      {configRentabilidad.mostrarRentabilidadEnCatalogo && (
                        <td className="px-3 py-3">
                          {rentabilidadProducto ? (
                            <div className="min-w-[155px]">
                              {editandoPrecioId === item.producto_id ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] font-semibold text-slate-400">
                                    ARS
                                  </span>
                                  <input
                                    type="number"
                                    min="1"
                                    aria-label={`Precio de venta manual en ARS para ${item.nombre}`}
                                    value={precioManualInput}
                                    onChange={(e) =>
                                      setPrecioManualInput(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        void confirmarPrecioManualFila(item)
                                      } else if (e.key === 'Escape') {
                                        setEditandoPrecioId(null)
                                      }
                                    }}
                                    placeholder="ARS"
                                    className="h-7 w-20 rounded border border-violet-300 bg-white px-2 text-xs font-semibold text-slate-800 outline-none"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void confirmarPrecioManualFila(item)
                                    }
                                    title="Guardar"
                                    className="flex size-6 items-center justify-center rounded bg-violet-600 text-white hover:bg-violet-700"
                                  >
                                    <Check size={11} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditandoPrecioId(null)}
                                    title="Cancelar"
                                    className="flex size-6 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50"
                                  >
                                    <X size={11} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex flex-col items-start gap-0.5">
                                  <div className="flex flex-wrap items-center gap-1">
                                    <span className="text-[13px] font-bold text-slate-900">
                                      PVP: {formatearMoneda(
                                        rentabilidadProducto.precioVentaSugeridoUSD,
                                        'USD',
                                      )}
                                    </span>
                                    {rentabilidadProducto.esPrecioManual && (
                                      <span className="rounded bg-violet-100 px-1 py-0.2 text-[8px] font-bold uppercase text-violet-700">
                                        Manual
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        iniciarEdicionPrecioManual(
                                          item,
                                          rentabilidadProducto.precioVentaSugeridoARS,
                                        )
                                      }
                                      title="Fijar precio de venta manual (ARS)"
                                      aria-label={`Fijar precio manual de ${item.nombre}`}
                                      className="rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-violet-700"
                                    >
                                      <Pencil size={10} />
                                    </button>
                                    {rentabilidadProducto.esPrecioManual && (
                                      <button
                                        type="button"
                                        disabled={
                                          guardandoPrecioId === item.producto_id
                                        }
                                        onClick={() =>
                                          void limpiarPrecioManualFila(item)
                                        }
                                        title="Volver al precio automático por fórmula"
                                        aria-label={`Restaurar precio automático de ${item.nombre}`}
                                        className="rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-rose-600"
                                      >
                                        <RotateCcw size={10} />
                                      </button>
                                    )}
                                  </div>
                                  <span className="text-[11px] font-bold text-slate-700">
                                    {formatearMoneda(
                                      rentabilidadProducto.precioVentaSugeridoARS,
                                      'ARS',
                                    )}
                                  </span>
                                </div>
                              )}

                              <span
                                className={`block text-[11px] font-semibold ${
                                  rentabilidadProducto.gananciaNetaARS >= 0
                                    ? 'text-emerald-700'
                                    : 'text-rose-600'
                                }`}
                              >
                                {rentabilidadProducto.gananciaNetaARS >= 0
                                  ? '+'
                                  : ''}
                                {formatearMoneda(
                                  rentabilidadProducto.gananciaNetaUSD,
                                  'USD',
                                )}{' '}
                                ({formatearMoneda(
                                  rentabilidadProducto.gananciaNetaARS,
                                  'ARS',
                                )}) · {rentabilidadProducto.roiPorcentaje.toFixed(0)}% ROI
                              </span>

                              <a
                                href={urlMercadoLibre}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1 inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 transition hover:bg-amber-100"
                                title={`Buscar ${item.marca} ${item.nombre} en MercadoLibre Argentina`}
                              >
                                <ExternalLink size={9} />
                                Buscar en ML
                              </a>
                            </div>
                          ) : (
                            <div className="min-w-[120px]">
                              <span className="block text-[11px] text-slate-300">
                                —
                              </span>
                              <a
                                href={urlMercadoLibre}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1 inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 transition hover:bg-amber-100"
                              >
                                <ExternalLink size={9} />
                                Buscar en ML
                              </a>
                            </div>
                          )}
                        </td>
                      )}

                      <td className="px-4 py-3 text-right sm:px-5">
                        <div className="inline-flex items-center gap-1.5">
                          {!configRentabilidad.mostrarRentabilidadEnCatalogo && (
                            <a
                              href={urlMercadoLibre}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Buscar ${item.nombre} en MercadoLibre`}
                              title="Buscar en MercadoLibre"
                              className="row-action flex size-8 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 transition hover:bg-amber-100"
                            >
                              <ExternalLink size={13} />
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() => onAbrirModalAlerta(item)}
                            aria-label={`Configurar seguimiento y alerta para ${item.nombre}`}
                            title={
                              alertaEvaluada?.tieneAlertaActiva
                                ? 'Alerta activa · Click para editar'
                                : enWatchlist
                                  ? 'En seguimiento · Click para editar alerta'
                                  : 'Seguir perfume y configurar alerta'
                            }
                            className={`row-action flex size-8 items-center justify-center rounded-lg border transition ${
                              alertaEvaluada?.tieneAlertaActiva
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                : enWatchlist
                                  ? 'border-amber-300 bg-amber-50 text-amber-700'
                                  : 'border-slate-200 text-slate-500 hover:border-violet-200 hover:text-violet-700'
                            }`}
                          >
                            {alertaEvaluada?.tieneAlertaActiva ? (
                              <BellRing size={14} />
                            ) : (
                              <Star
                                size={14}
                                className={enWatchlist ? 'fill-current' : ''}
                              />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => onHistory(item)}
                            aria-label={`Ver historial de ${item.nombre}`}
                            title="Ver historial de precios"
                            className="row-action flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-violet-200 hover:text-violet-700"
                          >
                            <TrendingDown size={14} />
                          </button>
                          {mejorOferta && mejorOferta.disponible && (
                            <button
                              type="button"
                              onClick={() => onAdd(item, mejorOferta)}
                              aria-label={`Agregar mejor oferta de ${item.nombre} (${mejorOferta.proveedor}) al carrito`}
                              title={`Agregar mejor oferta (${mejorOferta.proveedor})`}
                              className="primary-action row-action flex size-8 items-center justify-center rounded-lg bg-[#34294d] text-white transition hover:bg-[#45365f]"
                            >
                              <Plus size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {productos.length === 0 && (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <Search size={20} className="mb-2 text-slate-300" />
              <p className="text-[12px] font-medium text-slate-600">
                No se encontraron productos
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Probá con otra búsqueda o ajustá los filtros.
              </p>
              <button
                type="button"
                onClick={onLimpiarFiltros}
                className="mt-3 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
              >
                Limpiar filtros
              </button>
            </div>
          )}

          {!maxRows && productos.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-[11px] text-slate-500 sm:px-5">
              <span>
                Mostrando {indiceInicio + 1}–{indiceFin} de {productos.length}{' '}
                productos
              </span>

              <div className="flex flex-wrap items-center gap-2">
                {puedeCargarMasEnPagina && (
                  <button
                    type="button"
                    onClick={() => onCambiarTamanoPagina(siguienteTamanoPagina)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11px] font-medium text-violet-700 transition hover:border-violet-300 hover:bg-violet-100"
                  >
                    <Plus size={13} />
                    Cargar más perfumes (ver {siguienteTamanoPagina})
                  </button>
                )}

                {totalPaginas > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={paginaSegura <= 1}
                      onClick={() => onCambiarPagina(paginaSegura - 1)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                    >
                      <ChevronLeft size={13} />
                      Anterior
                    </button>
                    <span className="px-2 text-[11px] font-medium text-slate-600">
                      Página {paginaSegura} de {totalPaginas}
                    </span>
                    <button
                      type="button"
                      disabled={paginaSegura >= totalPaginas}
                      onClick={() => onCambiarPagina(paginaSegura + 1)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                    >
                      Siguiente
                      <ChevronRight size={13} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}

