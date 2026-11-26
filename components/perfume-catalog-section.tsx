'use client'

import { useMemo, useState } from 'react'
import {
  ArrowRight,
  BellRing,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  Filter,
  GitMerge,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  Tags,
  TrendingDown,
  X,
  Zap,
} from 'lucide-react'
import {
  normalizarTextoBusqueda,
  obtenerProveedorExclusivo,
} from '@/hooks/useCatalogoPerfumes'
import {
  calcularCostoPerfume,
  calcularRentabilidadUnitaria,
  construirUrlBusquedaMercadoLibre,
  esProveedorSinCostosAgregados,
  obtenerCostosAgregadosParaProveedor,
  obtenerRecargoUnitarioARS,
} from '@/lib/rentabilidad'
import {
  MiniaturaPerfumeEditable,
  type ModoEditorImagen,
} from '@/components/image-editor-modal'
import {
  esTipoProductoValido,
  TIPOS_PRODUCTO_OPCIONES,
  type AlertaWatchlistEvaluada,
  type ConfiguracionRentabilidad,
  type CriterioOrdenamiento,
  type FiltrosCatalogo,
  type FiltroInteligenciaPrecios,
  type ItemWatchlist,
  type Moneda,
  type OfertaProveedor,
  type ProductoComparado,
  type RegistroStockPropio,
  type TipoProducto,
} from '@/types/perfumeria'
import {
  CATEGORIAS_FILTRO,
  etiquetaCategoriaPerfume,
  formatearMoneda,
  GENEROS_FILTRO,
  MAX_TAMANO_PAGINA,
  obtenerColorProveedor,
  obtenerEstiloCategoriaPerfume,
  obtenerEstiloTipoProducto,
  OPCIONES_ORDENAMIENTO,
  OPCIONES_TAMANO_PAGINA,
} from './perfume-shared'

export interface CatalogSectionProps {
  productos: ProductoComparado[]
  totalSinFiltrar: number
  proveedoresDisponibles: string[]
  proveedoresActivos: string[]
  proveedoresDesactivados: string[]
  onAlternarProveedor: (proveedor: string) => void
  onActivarTodosLosProveedores: () => void
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
  alternarMarcaOculta: (marca: string) => void
  conteoProductosPorMarca?: Map<string, number>
  cantidadFiltrosActivos: number
  monedaVisualizacion: Moneda
  dolarDelDia: number
  configRentabilidad: ConfiguracionRentabilidad
  conteosInteligencia: {
    bajaron: number
    subieron: number
    arbitraje: number
    exclusivos: number
    exclusivosPorProveedor: Record<string, number>
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
  onAbrirCalcularCosto: () => void
  onAbrirRentabilidad: () => void
  onAbrirImportador: () => void
  onGuardarPrecioManual: (
    producto: ProductoComparado,
    nuevoPrecioARS: number | null,
  ) => Promise<void>
  onCambiarTipoProducto: (
    producto: ProductoComparado,
    nuevoTipo: TipoProducto,
  ) => Promise<void> | void
  cargandoCatalogo: boolean
  onEditarMarca: (marca: string) => void
  onFusionar: (producto: ProductoComparado) => void
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
  cantidadesEnCarritoPorProducto?: Map<number, number>
}

export function CatalogSection({
  productos,
  totalSinFiltrar,
  proveedoresDisponibles,
  proveedoresActivos,
  proveedoresDesactivados,
  onAlternarProveedor,
  onActivarTodosLosProveedores,
  marcasDisponibles,
  filtros,
  setFiltros,
  precioMinInput,
  setPrecioMinInput,
  precioMaxInput,
  setPrecioMaxInput,
  onLimpiarFiltros,
  alternarMarcaFiltro,
  alternarMarcaOculta,
  conteoProductosPorMarca,
  cantidadFiltrosActivos,
  monedaVisualizacion,
  dolarDelDia,
  configRentabilidad,
  conteosInteligencia,
  itemsWatchlist,
  alertasPorProductoId,
  onAbrirModalAlerta,
  onGuardarPrecioManual,
  onCambiarTipoProducto,
  cargandoCatalogo,
  onEditarMarca,
  onFusionar,
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
  cantidadesEnCarritoPorProducto,
}: CatalogSectionProps) {
  const filtroArbitrajeActivo = filtros.filtroInteligencia === 'ARBITRAJE'
  const filtroExclusivosActivo = filtros.filtroInteligencia === 'EXCLUSIVOS'

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

  const alternarProductosExclusivos = () => {
    if (filtroExclusivosActivo) {
      setFiltros((prev) => ({
        ...prev,
        filtroInteligencia: 'TODOS',
      }))
    } else {
      setFiltros((prev) => ({
        ...prev,
        filtroInteligencia: 'EXCLUSIVOS',
      }))
    }
    onCambiarPagina(1)
  }

  const hayProveedoresDesactivados =
    proveedoresActivos.length < proveedoresDisponibles.length
  const proveedoresExcluidos = proveedoresDisponibles.filter(
    (p) => !proveedoresActivos.includes(p),
  )
  const resumenComparados =
    proveedoresActivos.length === 2
      ? proveedoresActivos.join(' vs ')
      : proveedoresActivos.join(', ')

  const displayedSuppliers =
    filtros.pestanaActiva === 'GLOBAL' ||
    proveedoresDesactivados.includes(filtros.pestanaActiva)
      ? proveedoresActivos
      : [filtros.pestanaActiva]

  const [busquedaMarcaFiltro, setBusquedaMarcaFiltro] = useState('')
  const marcasOcultas = filtros.marcasOcultas ?? []
  const marcasFiltradasEnPanel = useMemo(() => {
    const termino = normalizarTextoBusqueda(busquedaMarcaFiltro)
    if (!termino) return marcasDisponibles
    return marcasDisponibles.filter((marca) =>
      normalizarTextoBusqueda(marca).includes(termino),
    )
  }, [marcasDisponibles, busquedaMarcaFiltro])

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

  const hayFiltrosChipsActivos =
    Boolean(filtros.genero) ||
    Boolean(filtros.categoria) ||
    filtros.soloEnStock ||
    Boolean(precioMinInput.trim()) ||
    Boolean(precioMaxInput.trim()) ||
    filtros.marcasSeleccionadas.length > 0 ||
    marcasOcultas.length > 0

  const pildorasInteligencia: Array<{
    id: FiltroInteligenciaPrecios
    etiqueta: string
    count?: number
    destacado?: boolean
    esArbitraje?: boolean
    esExclusivos?: boolean
  }> = [
    { id: 'TODOS', etiqueta: 'Todos' },
    {
      id: 'ARBITRAJE',
      etiqueta: 'Más baratos entre listas',
      count: conteosInteligencia.arbitraje,
      esArbitraje: true,
    },
    {
      id: 'EXCLUSIVOS',
      etiqueta: 'Exclusivos por tienda',
      count: conteosInteligencia.exclusivos,
      esExclusivos: true,
    },
    {
      id: 'BAJARON',
      etiqueta: '↓ Bajaron',
      count: conteosInteligencia.bajaron,
    },
    {
      id: 'SUBIERON',
      etiqueta: '↑ Subas',
      count: conteosInteligencia.subieron,
    },
    {
      id: 'SEGUIMIENTO',
      etiqueta: '★ Seguimiento',
      count: conteosInteligencia.seguimiento,
    },
    {
      id: 'ALERTAS_ACTIVAS',
      etiqueta: '🔔 Alertas',
      count: conteosInteligencia.alertasActivas,
      destacado: conteosInteligencia.alertasActivas > 0,
    },
  ]

  const vistaProveedorActual =
    filtros.pestanaActiva === 'GLOBAL' ||
    proveedoresDesactivados.includes(filtros.pestanaActiva)
      ? 'GLOBAL'
      : filtros.pestanaActiva

  return (
    <section className="dashboard-card overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* Cabecera compacta solo en vista previa del Resumen */}
      {onAll && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
          <div className="flex items-baseline gap-2.5">
            <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">
              Catálogo y comparador
            </h2>
            <span className="text-[11px] font-medium text-slate-400">
              {productos.length} de {totalSinFiltrar} productos
            </span>
          </div>
          <button
            type="button"
            onClick={onAll}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 hover:text-violet-900"
          >
            Ver catálogo completo <ArrowRight size={13} />
          </button>
        </div>
      )}

      {/* Fila 1: Buscador, ordenamiento, toggle de filtros y densidad */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-3 sm:gap-2.5 sm:px-5">
        <label className="relative w-full sm:min-w-[210px] sm:flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={filtros.busqueda}
            onChange={(event) =>
              setFiltros((prev) => ({ ...prev, busqueda: event.target.value }))
            }
            placeholder="Buscar perfume, marca, ml o EAN6..."
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-24 text-base text-slate-800 outline-none placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 sm:h-9 sm:text-xs"
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {filtros.busqueda && (
              <button
                type="button"
                onClick={() => setFiltros((prev) => ({ ...prev, busqueda: '' }))}
                aria-label="Limpiar búsqueda"
                className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={12} />
              </button>
            )}
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500">
              {productos.length} / {totalSinFiltrar}
            </span>
          </div>
        </label>

        <select
          aria-label="Ordenar catálogo"
          value={filtros.ordenarPor}
          onChange={(event) =>
            setFiltros((prev) => ({
              ...prev,
              ordenarPor: event.target.value as CriterioOrdenamiento,
            }))
          }
          className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 outline-none sm:h-9 sm:flex-none sm:text-[11px]"
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
          className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition sm:h-9 sm:text-[11px] ${
            filtersOpen
              ? 'border-violet-200 bg-violet-50 text-violet-800'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Filter size={13} />
          <span>Filtros</span>
          {cantidadFiltrosActivos > 0 && (
            <span className="flex size-4 items-center justify-center rounded-full bg-violet-700 text-[9px] font-bold text-white">
              {cantidadFiltrosActivos}
            </span>
          )}
          <ChevronDown
            size={12}
            className={`transition-transform ${filtersOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {!maxRows && !onAll && (
          <div className="hidden items-center gap-1.5 sm:flex">
            <span className="text-[11px] font-medium text-slate-400">
              Por pág:
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
                  className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
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
        )}
      </div>

      {/* Fila 2: Vistas rápidas de inteligencia + Control unificado de proveedores */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-3 py-2.5 sm:gap-2.5 sm:px-5">
        <div className="scrollbar-none flex w-full flex-nowrap items-center gap-1.5 overflow-x-auto pb-0.5 sm:w-auto sm:flex-wrap sm:overflow-visible sm:pb-0">
          {pildorasInteligencia.map((pildora) => {
            const activo = filtros.filtroInteligencia === pildora.id
            if (pildora.esArbitraje) {
              return (
                <button
                  key={pildora.id}
                  type="button"
                  onClick={alternarOportunidadesArbitraje}
                  title="Mostrar perfumes que están significativamente más baratos en un proveedor respecto a los demás en la lista"
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                    activo
                      ? 'border-amber-500 bg-amber-500 text-white shadow-xs hover:bg-amber-600'
                      : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                  }`}
                >
                  <Zap
                    size={12}
                    className={
                      activo
                        ? 'fill-white text-white'
                        : 'fill-amber-500 text-amber-600'
                    }
                  />
                  <span>{pildora.etiqueta}</span>
                  {pildora.count !== undefined && (
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums ${
                        activo
                          ? 'bg-white/25 text-white'
                          : 'bg-amber-200 text-amber-950 dark:bg-amber-500/30 dark:text-amber-100'
                      }`}
                    >
                      {pildora.count}
                    </span>
                  )}
                </button>
              )
            }

            if (pildora.esExclusivos) {
              return (
                <button
                  key={pildora.id}
                  type="button"
                  onClick={alternarProductosExclusivos}
                  title="Mostrar perfumes que solo vende una tienda y que las demás no tienen en su lista"
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                    activo
                      ? 'border-violet-600 bg-violet-600 text-white shadow-xs hover:bg-violet-700'
                      : 'border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100'
                  }`}
                >
                  <Sparkles
                    size={12}
                    className={
                      activo
                        ? 'fill-white text-white'
                        : 'text-violet-600'
                    }
                  />
                  <span>{pildora.etiqueta}</span>
                  {pildora.count !== undefined && (
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums ${
                        activo
                          ? 'bg-white/25 text-white'
                          : 'bg-violet-200 text-violet-950 dark:bg-violet-500/30 dark:text-violet-100'
                      }`}
                    >
                      {pildora.count}
                    </span>
                  )}
                </button>
              )
            }

            return (
              <button
                key={pildora.id}
                type="button"
                onClick={() =>
                  setFiltros((prev) => ({
                    ...prev,
                    filtroInteligencia:
                      prev.filtroInteligencia === pildora.id &&
                      pildora.id !== 'TODOS'
                        ? 'TODOS'
                        : pildora.id,
                  }))
                }
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
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
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-semibold tabular-nums ${
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

        {proveedoresDisponibles.length > 0 && (
          <div
            role="group"
            aria-label="Activar o desactivar proveedores en la comparación"
            className="scrollbar-none flex w-full flex-nowrap items-center gap-1.5 overflow-x-auto pb-0.5 sm:w-auto sm:flex-wrap sm:overflow-visible sm:pb-0"
          >
            <span className="mr-0.5 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Comparar
            </span>

            {proveedoresDisponibles.map((nombre) => {
              const activo = !proveedoresDesactivados.includes(nombre)
              const esUnicoActivo = activo && proveedoresActivos.length <= 1
              const color = obtenerColorProveedor(
                nombre,
                mapIndicesProveedores.get(nombre) ?? 0,
              )

              return (
                <button
                  key={nombre}
                  type="button"
                  role="switch"
                  aria-checked={activo}
                  aria-label={
                    activo
                      ? `Desactivar ${nombre} de la comparación`
                      : `Activar ${nombre} en la comparación`
                  }
                  title={
                    esUnicoActivo
                      ? 'Debe quedar al menos un proveedor activo'
                      : activo
                        ? `Quitar ${nombre} de la comparación`
                        : `Incluir ${nombre} en la comparación`
                  }
                  disabled={esUnicoActivo}
                  onClick={() => onAlternarProveedor(nombre)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                    activo
                      ? 'border-violet-200 bg-violet-50 text-slate-800 hover:bg-slate-50'
                      : 'border-dashed border-slate-200 bg-white text-slate-400 hover:text-slate-600'
                  } ${
                    esUnicoActivo
                      ? 'cursor-not-allowed opacity-70'
                      : 'cursor-pointer'
                  }`}
                >
                  <span
                    className={`size-2 shrink-0 rounded-full ${
                      activo ? '' : 'opacity-40'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                  <span className={activo ? '' : 'line-through'}>{nombre}</span>
                  {activo ? (
                    <Check size={11} className="text-violet-700" />
                  ) : (
                    <EyeOff size={11} className="text-slate-400" />
                  )}
                </button>
              )
            })}

            {hayProveedoresDesactivados && (
              <>
                <span className="shrink-0 text-[10px] font-medium text-slate-400">
                  {proveedoresActivos.length}/{proveedoresDisponibles.length}
                </span>
                <button
                  type="button"
                  onClick={onActivarTodosLosProveedores}
                  className="shrink-0 rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-700 transition hover:bg-slate-50"
                >
                  Activar todos
                </button>
              </>
            )}

            <select
              aria-label="Vista de proveedor"
              value={vistaProveedorActual}
              onChange={(event) =>
                setFiltros((prev) => ({
                  ...prev,
                  pestanaActiva: event.target.value,
                }))
              }
              className="h-7 shrink-0 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-600 outline-none"
            >
              <option value="GLOBAL">
                {hayProveedoresDesactivados
                  ? `Activos (${proveedoresActivos.length})`
                  : 'Todos los activos'}
              </option>
              {proveedoresActivos.map((nombre) => (
                <option key={nombre} value={nombre}>
                  Solo {nombre}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tira de filtros activos (siempre visible cuando hay algún filtro seleccionado) */}
      {hayFiltrosChipsActivos && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 bg-white px-3 py-2 sm:px-5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Activos:
          </span>

          {filtros.categoria && (
            <button
              type="button"
              onClick={() =>
                setFiltros((prev) => ({ ...prev, categoria: null }))
              }
              className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 hover:opacity-85"
            >
              <span>
                Categoría:{' '}
                {filtros.categoria === 'SIN_CATEGORIA'
                  ? 'Sin categoría'
                  : etiquetaCategoriaPerfume(filtros.categoria)}
              </span>
              <X size={10} />
            </button>
          )}

          {filtros.genero && (
            <button
              type="button"
              onClick={() => setFiltros((prev) => ({ ...prev, genero: null }))}
              className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 hover:opacity-85"
            >
              <span>Género: {filtros.genero}</span>
              <X size={10} />
            </button>
          )}

          {filtros.soloEnStock && (
            <button
              type="button"
              onClick={() =>
                setFiltros((prev) => ({ ...prev, soloEnStock: false }))
              }
              className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 hover:opacity-85"
            >
              <span>Solo con stock</span>
              <X size={10} />
            </button>
          )}

          {(precioMinInput.trim() || precioMaxInput.trim()) && (
            <button
              type="button"
              onClick={() => {
                setPrecioMinInput('')
                setPrecioMaxInput('')
              }}
              className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 hover:opacity-85"
            >
              <span>
                Precio ({monedaVisualizacion}):{' '}
                {precioMinInput.trim() || '0'} –{' '}
                {precioMaxInput.trim() || '∞'}
              </span>
              <X size={10} />
            </button>
          )}

          {filtros.marcasSeleccionadas.map((marca) => (
            <button
              type="button"
              key={`sel-${marca}`}
              onClick={() => alternarMarcaFiltro(marca)}
              className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 hover:opacity-85"
            >
              <span>Marca: {marca}</span>
              <X size={10} />
            </button>
          ))}

          {marcasOcultas.map((marca) => (
            <button
              type="button"
              key={`hide-${marca}`}
              onClick={() => alternarMarcaOculta(marca)}
              className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600 hover:opacity-85"
            >
              <EyeOff size={10} />
              <span>Oculta: {marca}</span>
              <X size={10} />
            </button>
          ))}

          <button
            type="button"
            onClick={onLimpiarFiltros}
            className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800"
          >
            <X size={11} />
            Limpiar todo
          </button>
        </div>
      )}

      {/* Panel desplegable de Filtros: Bottom Sheet en mobile (< lg), 3 columnas inline en desktop (lg:) */}
      {filtersOpen && (
        <div
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setFiltersOpen(false)
            }
          }}
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 lg:static lg:z-auto lg:block lg:bg-transparent"
        >
          <div className="mobile-sheet flex max-h-[85dvh] flex-col overflow-hidden rounded-t-2xl border-t border-slate-200 bg-white lg:block lg:max-h-none lg:rounded-none lg:border-b lg:border-t-0 lg:border-slate-100 lg:bg-slate-50/70">
            {/* Cabecera del Bottom Sheet solo en mobile */}
            <div className="flex shrink-0 flex-col border-b border-slate-100 px-4 pb-3 pt-2 lg:hidden">
              <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-slate-300" />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">Filtros</h3>
                  {cantidadFiltrosActivos > 0 && (
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                      {cantidadFiltrosActivos} activos
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  aria-label="Cerrar filtros"
                  className="flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5 lg:flex-none lg:overflow-visible">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1.25fr)]">
                {/* Columna 1: Clasificación */}
                <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
                  <fieldset className="min-w-0">
                    <legend className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Categoría
                    </legend>
                    <div className="flex flex-wrap gap-1.5">
                      {CATEGORIAS_FILTRO.map(({ etiqueta, valor }) => (
                        <button
                          type="button"
                          key={etiqueta}
                          onClick={() =>
                            setFiltros((prev) => ({ ...prev, categoria: valor }))
                          }
                          className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                            filtros.categoria === valor
                              ? 'bg-[#34294d] text-white'
                              : 'bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:text-slate-900'
                          }`}
                        >
                          {etiqueta}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset className="min-w-0 border-t border-slate-100 pt-3">
                    <legend className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Género
                    </legend>
                    <div className="flex flex-wrap gap-1.5">
                      {GENEROS_FILTRO.map(({ etiqueta, valor }) => (
                        <button
                          type="button"
                          key={etiqueta}
                          onClick={() =>
                            setFiltros((prev) => ({ ...prev, genero: valor }))
                          }
                          className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                            filtros.genero === valor
                              ? 'bg-[#34294d] text-white'
                              : 'bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:text-slate-900'
                          }`}
                        >
                          {etiqueta}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>

                {/* Columna 2: Precio y Stock */}
                <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
                  <div className="flex flex-col gap-3">
                    <fieldset className="min-w-0">
                      <legend className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Precio ({monedaVisualizacion})
                      </legend>
                      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                        <input
                          aria-label="Precio mínimo"
                          type="number"
                          min="0"
                          value={precioMinInput}
                          onChange={(event) => setPrecioMinInput(event.target.value)}
                          placeholder="Mínimo"
                          className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-base text-slate-700 outline-none focus:border-violet-400 sm:h-8 sm:text-xs"
                        />
                        <span className="text-xs text-slate-400">–</span>
                        <input
                          aria-label="Precio máximo"
                          type="number"
                          min="0"
                          value={precioMaxInput}
                          onChange={(event) => setPrecioMaxInput(event.target.value)}
                          placeholder="Máximo"
                          className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-base text-slate-700 outline-none focus:border-violet-400 sm:h-8 sm:text-xs"
                        />
                      </div>
                    </fieldset>

                    <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-medium text-slate-700">
                      <span>Solo con stock disponible</span>
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
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                    <button
                      type="button"
                      onClick={() => onEditarMarca('')}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      <Tags size={12} className="text-violet-600" />
                      Editar marcas
                    </button>
                    <button
                      type="button"
                      onClick={onLimpiarFiltros}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                    >
                      <X size={12} />
                      Limpiar filtros
                    </button>
                  </div>
                </div>

                {/* Columna 3: Marcas */}
                {marcasDisponibles.length > 0 && (
                  <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-3.5 md:col-span-2 xl:col-span-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          Marcas ({marcasDisponibles.length})
                        </span>
                        {filtros.marcasSeleccionadas.length > 0 && (
                          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                            {filtros.marcasSeleccionadas.length} visibles
                          </span>
                        )}
                        {marcasOcultas.length > 0 && (
                          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600">
                            {marcasOcultas.length} ocultas
                          </span>
                        )}
                      </div>
                      {(filtros.marcasSeleccionadas.length > 0 ||
                        marcasOcultas.length > 0) && (
                        <button
                          type="button"
                          onClick={() =>
                            setFiltros((prev) => ({
                              ...prev,
                              marcasSeleccionadas: [],
                              marcasOcultas: [],
                            }))
                          }
                          className="text-[11px] font-semibold text-violet-700 hover:underline"
                        >
                          Mostrar todas
                        </button>
                      )}
                    </div>

                    <label className="relative mt-2 block">
                      <Search
                        size={13}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        type="text"
                        aria-label="Buscar marca en filtros"
                        value={busquedaMarcaFiltro}
                        onChange={(event) =>
                          setBusquedaMarcaFiltro(event.target.value)
                        }
                        placeholder="Buscar marca en la lista..."
                        className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-8 text-base text-slate-700 outline-none placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 sm:h-8 sm:text-[11px]"
                      />
                      {busquedaMarcaFiltro && (
                        <button
                          type="button"
                          onClick={() => setBusquedaMarcaFiltro('')}
                          aria-label="Limpiar búsqueda de marca"
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </label>

                    <div
                      role="list"
                      aria-label="Lista de marcas"
                      className="mt-2 flex h-[176px] flex-col gap-1 overflow-y-auto pr-1"
                    >
                      {marcasFiltradasEnPanel.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center text-center text-[11px] text-slate-400">
                          <p>No se encontró ninguna marca con ese nombre.</p>
                          {busquedaMarcaFiltro && (
                            <button
                              type="button"
                              onClick={() => setBusquedaMarcaFiltro('')}
                              className="mt-1.5 font-semibold text-violet-700 hover:underline"
                            >
                              Ver todas las marcas
                            </button>
                          )}
                        </div>
                      ) : (
                        marcasFiltradasEnPanel.map((marca) => {
                          const seleccionada =
                            filtros.marcasSeleccionadas.includes(marca)
                          const estaOculta = marcasOcultas.includes(marca)
                          const conteo = conteoProductosPorMarca?.get(marca)

                          return (
                            <div
                              key={marca}
                              role="listitem"
                              className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] transition ${
                                estaOculta
                                  ? 'border-rose-200 bg-rose-50 opacity-75'
                                  : seleccionada
                                    ? 'border-violet-300 bg-violet-50'
                                    : 'border-slate-200 bg-white hover:bg-slate-50'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => alternarMarcaFiltro(marca)}
                                title={
                                  seleccionada
                                    ? `Quitar filtro de ${marca}`
                                    : `Filtrar catálogo por ${marca}`
                                }
                                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                              >
                                <span
                                  className={`flex size-4 shrink-0 items-center justify-center rounded border text-[10px] transition ${
                                    seleccionada
                                      ? 'border-[#34294d] bg-[#34294d] text-white'
                                      : 'border-slate-300 bg-white text-transparent'
                                  }`}
                                >
                                  <Check size={10} />
                                </span>
                                <span
                                  className={`truncate font-medium ${
                                    estaOculta
                                      ? 'text-slate-400 line-through'
                                      : seleccionada
                                        ? 'font-semibold text-violet-800'
                                        : 'text-slate-700'
                                  }`}
                                >
                                  {marca}
                                </span>
                                {conteo !== undefined && (
                                  <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-medium tabular-nums text-slate-500">
                                    {conteo}
                                  </span>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => alternarMarcaOculta(marca)}
                                title={
                                  estaOculta
                                    ? `Volver a mostrar ${marca} en el catálogo`
                                    : `Ocultar ${marca} del catálogo`
                                }
                                aria-label={
                                  estaOculta
                                    ? `Mostrar marca ${marca}`
                                    : `Ocultar marca ${marca}`
                                }
                                className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold transition ${
                                  estaOculta
                                    ? 'border-rose-300 bg-white text-rose-600 hover:bg-rose-100'
                                    : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:text-slate-800'
                                }`}
                              >
                                {estaOculta ? (
                                  <EyeOff size={11} />
                                ) : (
                                  <Eye size={11} />
                                )}
                                <span>{estaOculta ? 'Oculta' : 'Ocultar'}</span>
                              </button>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Pie fijo del Bottom Sheet solo en mobile */}
            <div className="flex shrink-0 items-center gap-2 border-t border-slate-100 bg-white px-4 py-3 lg:hidden">
              <button
                type="button"
                onClick={onLimpiarFiltros}
                className="h-10 rounded-lg border border-slate-200 px-3.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="primary-action flex h-10 flex-1 items-center justify-center rounded-lg bg-[#34294d] px-4 text-xs font-semibold text-white transition hover:bg-[#45365f]"
              >
                Ver {productos.length} resultados
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Banner de arbitraje */}
      {filtroArbitrajeActivo && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs sm:px-5">
          <div className="flex items-center gap-2 text-amber-900">
            <Zap size={14} className="shrink-0 fill-amber-500 text-amber-600" />
            <span>
              {proveedoresActivos.length < 2 ? (
                'Activá al menos 2 proveedores arriba para comparar diferencias de precio entre listas.'
              ) : hayProveedoresDesactivados ? (
                <>
                  Mostrando perfumes donde un proveedor está{' '}
                  <strong>notablemente más barato (≥5%)</strong> comparando{' '}
                  <strong>{resumenComparados}</strong> (excluidos:{' '}
                  {proveedoresExcluidos.join(', ')}).
                </>
              ) : (
                <>
                  Mostrando perfumes donde un proveedor está{' '}
                  <strong>notablemente más barato (≥5%)</strong> respecto a los
                  demás en la lista.
                </>
              )}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {hayProveedoresDesactivados && (
              <button
                type="button"
                onClick={onActivarTodosLosProveedores}
                className="inline-flex shrink-0 items-center gap-1 rounded border border-violet-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-violet-700 transition hover:bg-violet-50"
              >
                Activar todos
              </button>
            )}
            <button
              type="button"
              onClick={alternarOportunidadesArbitraje}
              className="inline-flex shrink-0 items-center gap-1 rounded border border-amber-300 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 transition hover:bg-amber-100"
            >
              <X size={11} />
              Mostrar todos
            </button>
          </div>
        </div>
      )}

      {/* Banner de productos exclusivos por tienda */}
      {filtroExclusivosActivo && (
        <div className="flex flex-col gap-2.5 border-b border-violet-200 bg-violet-50/90 px-4 py-2.5 text-xs sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-violet-950">
              <Sparkles size={14} className="shrink-0 text-violet-600" />
              <span>
                {proveedoresActivos.length < 2 ? (
                  'Activá al menos 2 proveedores arriba para comparar qué productos son exclusivos de cada tienda.'
                ) : vistaProveedorActual !== 'GLOBAL' ? (
                  <>
                    Mostrando perfumes <strong>exclusivos de {vistaProveedorActual}</strong> que las demás tiendas activas ({proveedoresActivos.filter((p) => p !== vistaProveedorActual).join(', ')}) no tienen en su lista.
                  </>
                ) : hayProveedoresDesactivados ? (
                  <>
                    Mostrando perfumes que figuran en{' '}
                    <strong>una sola tienda</strong> y que las demás no tienen en su lista (comparando{' '}
                    <strong>{resumenComparados}</strong>; excluidos:{' '}
                    {proveedoresExcluidos.join(', ')}).
                  </>
                ) : (
                  <>
                    Mostrando perfumes que se venden en{' '}
                    <strong>una sola tienda</strong> y que las demás no tienen en su lista.
                  </>
                )}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {hayProveedoresDesactivados && (
                <button
                  type="button"
                  onClick={onActivarTodosLosProveedores}
                  className="inline-flex shrink-0 items-center gap-1 rounded border border-violet-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-violet-700 transition hover:bg-violet-50"
                >
                  Activar todos
                </button>
              )}
              <button
                type="button"
                onClick={alternarProductosExclusivos}
                className="inline-flex shrink-0 items-center gap-1 rounded border border-violet-300 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-violet-800 transition hover:bg-violet-100"
              >
                <X size={11} />
                Mostrar todos
              </button>
            </div>
          </div>

          {proveedoresActivos.length >= 2 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-violet-700/80">
                Ver exclusivos de:
              </span>
              <button
                type="button"
                onClick={() => {
                  setFiltros((prev) => ({ ...prev, pestanaActiva: 'GLOBAL' }))
                  onCambiarPagina(1)
                }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition ${
                  vistaProveedorActual === 'GLOBAL'
                    ? 'border-violet-600 bg-violet-600 text-white shadow-xs'
                    : 'border-violet-200 bg-white text-violet-800 hover:bg-violet-100'
                }`}
              >
                <span>Todas las tiendas</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums ${
                    vistaProveedorActual === 'GLOBAL'
                      ? 'bg-white/25 text-white'
                      : 'bg-violet-100 text-violet-800'
                  }`}
                >
                  {conteosInteligencia.exclusivos}
                </span>
              </button>
              {proveedoresActivos.map((nombre) => {
                const seleccionado = vistaProveedorActual === nombre
                const cantidadTienda =
                  conteosInteligencia.exclusivosPorProveedor[nombre] ?? 0
                const color = obtenerColorProveedor(
                  nombre,
                  mapIndicesProveedores.get(nombre) ?? 0,
                )
                return (
                  <button
                    key={`excl-${nombre}`}
                    type="button"
                    onClick={() => {
                      setFiltros((prev) => ({
                        ...prev,
                        pestanaActiva:
                          prev.pestanaActiva === nombre ? 'GLOBAL' : nombre,
                      }))
                      onCambiarPagina(1)
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition ${
                      seleccionado
                        ? 'border-violet-600 bg-violet-600 text-white shadow-xs'
                        : 'border-violet-200 bg-white text-slate-700 hover:bg-violet-100'
                    }`}
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: seleccionado ? '#ffffff' : color,
                      }}
                    />
                    <span>Solo en {nombre}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums ${
                        seleccionado
                          ? 'bg-white/25 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {cantidadTienda}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Listado comparador de 4 zonas con CERO scroll horizontal */}
      {cargandoCatalogo && productos.length === 0 ? (
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-[12px] text-slate-500">
          <Loader2 size={20} className="animate-spin text-violet-600" />
          <span>Cargando catálogo mayorista...</span>
        </div>
      ) : (
        <>
          {filasVisibles.length > 0 && (
            <div className="hidden border-b border-slate-100 bg-slate-50/70 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 xl:grid xl:grid-cols-[minmax(255px,1.35fr)_minmax(275px,1.5fr)_minmax(195px,1fr)_144px] xl:gap-4">
              <span>Producto</span>
              <span>Proveedores y precios</span>
              <span>Costo y reventa</span>
              <span className="text-right">Carrito</span>
            </div>
          )}

          <div className="divide-y divide-slate-100">
            {filasVisibles.map((item) => {
              const mejorProveedor = item.proveedorMasBarato
              const mejorOferta = mejorProveedor
                ? item.ofertas[mejorProveedor]
                : undefined
              const estiloTipo = obtenerEstiloTipoProducto(item.tipo)
              const enWatchlist = Boolean(itemsWatchlist[item.producto_id])
              const alertaEvaluada = alertasPorProductoId.get(item.producto_id)
              const cantidadEnCarrito =
                cantidadesEnCarritoPorProducto?.get(item.producto_id) ?? 0

              const proveedorExclusivo =
                proveedoresActivos.length >= 2
                  ? obtenerProveedorExclusivo(item)
                  : null

              const ofertasPresentes = displayedSuppliers
                .map((nombre) => item.ofertas[nombre])
                .filter((o): o is OfertaProveedor =>
                  Boolean(o && o.precioBase !== null),
                )
                .sort((a, b) => {
                  if (a.disponible !== b.disponible) {
                    return a.disponible ? -1 : 1
                  }
                  const costoA =
                    (a.precioBaseEnARS ?? Infinity) +
                    obtenerRecargoUnitarioARS(
                      a.proveedor,
                      configRentabilidad,
                      dolarDelDia,
                    )
                  const costoB =
                    (b.precioBaseEnARS ?? Infinity) +
                    obtenerRecargoUnitarioARS(
                      b.proveedor,
                      configRentabilidad,
                      dolarDelDia,
                    )
                  return costoA - costoB
                })

              const sinListaNombres =
                vistaProveedorActual === 'GLOBAL'
                  ? displayedSuppliers.filter(
                      (nombre) =>
                        !item.ofertas[nombre] ||
                        item.ofertas[nombre].precioBase === null,
                    )
                  : []

              const costosAgregadosGanador = obtenerCostosAgregadosParaProveedor(
                mejorProveedor,
                configRentabilidad,
              )
              const costoProducto =
                item.tieneStockDisponible && item.mejorPrecioARS !== null
                  ? calcularCostoPerfume({
                      costoBaseARS: item.mejorPrecioARS,
                      costoBaseUSD: item.mejorPrecioUSD,
                      comisionUSD: costosAgregadosGanador.comisionUSD,
                      envioAproximadoARS:
                        costosAgregadosGanador.envioAproximadoARS,
                      dolarDelDia,
                    })
                  : null

              const rentabilidadProducto =
                configRentabilidad.mostrarRentabilidadEnCatalogo &&
                costoProducto !== null
                  ? calcularRentabilidadUnitaria({
                      productoId: item.producto_id,
                      proveedor: mejorProveedor,
                      costoARS: costoProducto.costoBaseARS,
                      costoUSD: costoProducto.costoBaseUSD,
                      costoCalculado: costoProducto,
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
                <article
                  key={item.producto_id}
                  className="catalog-row grid grid-cols-1 gap-3 px-3.5 py-2.5 transition hover:bg-slate-50/70 sm:px-5 sm:py-3 md:grid-cols-2 xl:grid-cols-[minmax(255px,1.35fr)_minmax(275px,1.5fr)_minmax(195px,1fr)_144px] xl:items-stretch xl:gap-4"
                >
                  {/* Zona 1: Producto + clasificación inline */}
                  <div className="flex min-w-0 items-center gap-3.5">
                    <MiniaturaPerfumeEditable
                      producto={item}
                      onAbrirEditor={onEditImage}
                      tamanoClase="size-24 shrink-0 sm:size-28 xl:size-[116px]"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-1.5">
                        <button
                          type="button"
                          onClick={() => onHistory(item)}
                          title={`Abrir ficha, precios e historial de ${item.marca} ${item.nombre}`}
                          className="line-clamp-2 text-left text-[14px] font-bold leading-snug text-slate-900 transition hover:text-violet-700 hover:underline"
                        >
                          {item.nombre}
                        </button>
                        {alertaEvaluada?.cumplePrecioObjetivo && (
                          <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-700">
                            Objetivo
                          </span>
                        )}
                      </div>

                      <p className="mt-1 truncate text-[11.5px] text-slate-500">
                        <button
                          type="button"
                          onClick={() => onFiltrarMarca(item.marca)}
                          title={`Buscar todos los perfumes de ${item.marca} en la tabla`}
                          className="font-semibold text-slate-600 transition hover:text-violet-700 hover:underline"
                        >
                          {item.marca}
                        </button>
                        <span>
                          {' '}
                          · {item.concentracion ?? item.tipo}
                          {item.ml !== null ? ` · ${item.ml} ml` : ''}
                          {item.genero ? ` · ${item.genero}` : ''}
                        </span>
                        <span
                          className="ml-1.5 rounded bg-slate-100 px-1 py-0.2 font-mono text-[10px] text-slate-500"
                          title="ID del perfume (para fusionar duplicados)"
                        >
                          #{item.producto_id}
                        </span>
                      </p>

                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onEditarMarca(item.marca)}
                          title={`Editar categoría de la marca ${item.marca}`}
                          aria-label={`Editar categoría de la marca ${item.marca}`}
                          className={`inline-flex h-5 cursor-pointer items-center gap-1 rounded border px-1.5 text-[10px] font-semibold transition hover:opacity-85 ${obtenerEstiloCategoriaPerfume(
                            item.categoria,
                          )}`}
                        >
                          <span>{etiquetaCategoriaPerfume(item.categoria)}</span>
                          <Pencil size={9} className="opacity-70" />
                        </button>

                        <div className="relative inline-flex items-center">
                          <select
                            aria-label={`Cambiar tipo o subcategoría de ${item.marca} ${item.nombre}`}
                            title="Cambiar subcategoría del producto (Perfume, Kit, Crema, Aceite, Otros...)"
                            value={item.tipo}
                            onChange={(event) => {
                              const val = event.target.value
                              if (esTipoProductoValido(val) && val !== item.tipo) {
                                void onCambiarTipoProducto(item, val)
                              }
                            }}
                            className={`h-5 cursor-pointer appearance-none rounded border pl-1.5 pr-4 text-[10px] font-semibold outline-none transition hover:opacity-85 ${estiloTipo.badgeClass}`}
                          >
                            {TIPOS_PRODUCTO_OPCIONES.map((op) => (
                              <option key={op.valor} value={op.valor}>
                                {op.etiqueta}
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            size={10}
                            className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 opacity-70"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Zona 2: Proveedores y precios */}
                  <div className="flex min-w-0 flex-col justify-center gap-2 xl:py-1">
                    {ofertasPresentes.length > 0 ? (
                      ofertasPresentes.map((oferta) => {
                        const esGanadora =
                          oferta.disponible &&
                          mejorProveedor === oferta.proveedor
                        const variacion = oferta.variacionPorcentaje
                        const mostrarVariacion =
                          variacion !== null && Math.abs(variacion) >= 0.1
                        const tituloVariacion =
                          oferta.precioAnterior !== null &&
                          oferta.precioAnterior !== undefined
                            ? `Precio anterior: ${formatearMoneda(
                                oferta.precioAnterior,
                                oferta.moneda,
                              )}${
                                oferta.fechaPrecioAnterior
                                  ? ` (${oferta.fechaPrecioAnterior})`
                                  : ''
                              }`
                            : undefined

                        const mostrarFilaExtra =
                          (esGanadora &&
                            ((item.brechaArbitrajePorcentaje !== null &&
                              item.brechaArbitrajePorcentaje >= 2 &&
                              item.proveedorSegundoMasBarato) ||
                              item.mejorCostoPor100MlUSD !== null)) ||
                          oferta.precio12 !== null ||
                          oferta.precio24 !== null

                        return (
                          <div
                            key={oferta.proveedor}
                            className={`flex flex-1 flex-col rounded-xl border px-3.5 py-2.5 transition xl:max-h-[118px] ${
                              mostrarFilaExtra
                                ? 'justify-between'
                                : 'justify-center'
                            } ${
                              esGanadora
                                ? 'border-emerald-200 bg-emerald-50'
                                : oferta.disponible
                                  ? 'border-slate-200 bg-white'
                                  : 'border-slate-100 bg-slate-50/70 opacity-70'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2.5">
                              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                <span
                                  className="size-2.5 shrink-0 rounded-full"
                                  style={{
                                    backgroundColor: obtenerColorProveedor(
                                      oferta.proveedor,
                                      mapIndicesProveedores.get(
                                        oferta.proveedor,
                                      ) ?? 0,
                                    ),
                                  }}
                                />
                                <span className="truncate text-[13px] font-bold text-slate-800">
                                  {oferta.proveedor}
                                </span>
                                {esGanadora && (
                                  <span className="shrink-0 rounded bg-emerald-600 px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-white">
                                    Mejor
                                  </span>
                                )}
                                {esProveedorSinCostosAgregados(
                                  oferta.proveedor,
                                ) && (
                                  <span
                                    title="Sin costos agregados: el precio en pesos de su lista es final (retiro en stock local)"
                                    className="shrink-0 rounded bg-sky-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-sky-800 dark:bg-sky-500/20 dark:text-sky-300"
                                  >
                                    Precio final
                                  </span>
                                )}
                                {proveedorExclusivo === oferta.proveedor && (
                                  <span
                                    title={`Solo ${oferta.proveedor} tiene este producto en su lista`}
                                    className="inline-flex shrink-0 items-center gap-1 rounded bg-violet-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-violet-800"
                                  >
                                    <Sparkles size={9} />
                                    Exclusivo
                                  </span>
                                )}
                                {!oferta.disponible && (
                                  <span className="shrink-0 rounded bg-rose-50 px-1.5 py-0.5 text-[9.5px] font-semibold text-rose-600">
                                    {oferta.estadoStock || 'Sin stock'}
                                  </span>
                                )}
                                {mostrarVariacion && variacion !== null && (
                                  <span
                                    title={tituloVariacion}
                                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
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

                              <div className="flex shrink-0 items-center gap-2.5">
                                <div className="text-right leading-snug">
                                  <span
                                    className={`block whitespace-nowrap text-[13.5px] font-bold tabular-nums tracking-tight ${
                                      oferta.disponible
                                        ? 'text-slate-900'
                                        : 'text-slate-400 line-through'
                                    }`}
                                  >
                                    {oferta.precioBaseEnUSD !== null
                                      ? formatearMoneda(
                                          oferta.precioBaseEnUSD,
                                          'USD',
                                        )
                                      : '—'}
                                  </span>
                                  {oferta.disponible &&
                                    oferta.precioBaseEnARS !== null && (
                                      <span className="block whitespace-nowrap text-[13px] font-bold tabular-nums tracking-tight text-slate-900">
                                        {formatearMoneda(
                                          oferta.precioBaseEnARS,
                                          'ARS',
                                        )}
                                      </span>
                                    )}
                                </div>

                                {oferta.disponible && (
                                  <button
                                    type="button"
                                    onClick={() => onAdd(item, oferta)}
                                    title={`Agregar oferta de ${oferta.proveedor} al carrito`}
                                    aria-label={`Agregar ${item.nombre} de ${oferta.proveedor} al carrito`}
                                    className="row-action flex size-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-violet-300 hover:text-violet-700 sm:size-7"
                                  >
                                    <Plus size={14} />
                                  </button>
                                )}
                              </div>
                            </div>

                            {mostrarFilaExtra && (
                              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-slate-200/70 pt-1.5 text-[10.5px]">
                                {esGanadora &&
                                  item.brechaArbitrajePorcentaje !== null &&
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
                                      className="inline-flex items-center gap-0.5 rounded bg-violet-100 px-1.5 py-0.2 font-semibold text-violet-700"
                                    >
                                      <Zap size={9} />
                                      Ahorrás{' '}
                                      {item.brechaArbitrajePorcentaje.toFixed(1)}
                                      % vs {item.proveedorSegundoMasBarato}
                                    </span>
                                  )}

                                {(oferta.precio12 !== null ||
                                  oferta.precio24 !== null) && (
                                  <span className="whitespace-nowrap text-slate-500 tabular-nums">
                                    {oferta.precio12 !== null
                                      ? `12+: ${formatearMoneda(
                                          oferta.precio12EnUSD ?? oferta.precio12,
                                          'USD',
                                        )}`
                                      : ''}
                                    {oferta.precio12 !== null &&
                                    oferta.precio24 !== null
                                      ? ' · '
                                      : ''}
                                    {oferta.precio24 !== null
                                      ? `24+: ${formatearMoneda(
                                          oferta.precio24EnUSD ?? oferta.precio24,
                                          'USD',
                                        )}`
                                      : ''}
                                  </span>
                                )}

                                {esGanadora &&
                                  item.mejorCostoPor100MlUSD !== null && (
                                    <span className="ml-auto whitespace-nowrap text-slate-400 tabular-nums">
                                      {formatearMoneda(
                                        item.mejorCostoPor100MlUSD,
                                        'USD',
                                      )}
                                      /100ml
                                    </span>
                                  )}
                              </div>
                            )}
                          </div>
                        )
                      })
                    ) : (
                      <div className="flex flex-1 items-center rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-3 text-[11px] text-slate-400 xl:max-h-[118px]">
                        Sin stock ni precios disponibles
                      </div>
                    )}

                    {sinListaNombres.length > 0 && ofertasPresentes.length > 0 && (
                      <p className="truncate px-1 text-[10px] text-slate-400">
                        Sin lista: {sinListaNombres.join(', ')}
                      </p>
                    )}
                  </div>

                  {/* Zona 3: Costo final y reventa sugerida */}
                  <div className="flex min-w-0 flex-col justify-center">
                    {costoProducto ? (
                      <div
                        className={`rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 ${
                          configRentabilidad.mostrarRentabilidadEnCatalogo &&
                          rentabilidadProducto &&
                          editandoPrecioId !== item.producto_id
                            ? 'grid grid-cols-2 gap-3 xl:block'
                            : ''
                        }`}
                      >
                        <div className="flex flex-col gap-0.5 xl:flex-row xl:items-start xl:justify-between xl:gap-2">
                          <div>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                              Costo final
                            </span>
                            {esProveedorSinCostosAgregados(mejorProveedor) ? (
                              <span className="mt-0.5 block text-[10px] font-medium text-sky-700 dark:text-sky-300">
                                Sin costos agregados (retiro)
                              </span>
                            ) : (
                              (costoProducto.comisionUSD > 0 ||
                                costoProducto.envioAproximadoARS > 0) && (
                                <span className="mt-0.5 block text-[10px] text-slate-400">
                                  +US$ {costoProducto.comisionUSD} · +${' '}
                                  {Math.round(
                                    costoProducto.envioAproximadoARS,
                                  ).toLocaleString('es-AR')}
                                </span>
                              )
                            )}
                          </div>
                          <div className="leading-tight xl:text-right">
                            <span className="block whitespace-nowrap text-[12.5px] font-bold tabular-nums text-slate-900">
                              {formatearMoneda(costoProducto.costoTotalUSD, 'USD')}
                            </span>
                            <span className="block whitespace-nowrap text-[12.5px] font-bold tabular-nums text-slate-900">
                              {formatearMoneda(costoProducto.costoTotalARS, 'ARS')}
                            </span>
                          </div>
                        </div>

                        {configRentabilidad.mostrarRentabilidadEnCatalogo &&
                          rentabilidadProducto && (
                            <div
                              className={
                                editandoPrecioId === item.producto_id
                                  ? 'mt-2 border-t border-slate-200/70 pt-2'
                                  : 'border-l border-slate-200/70 pl-3 xl:mt-2 xl:border-l-0 xl:border-t xl:pl-0 xl:pt-2'
                              }
                            >
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
                                    className="h-8 min-w-0 flex-1 rounded border border-violet-300 bg-white px-2 text-base font-semibold text-slate-800 outline-none sm:h-7 sm:text-xs"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void confirmarPrecioManualFila(item)
                                    }
                                    title="Guardar"
                                    className="flex size-7 shrink-0 items-center justify-center rounded bg-violet-600 text-white hover:bg-violet-700 sm:size-6"
                                  >
                                    <Check size={11} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditandoPrecioId(null)}
                                    title="Cancelar"
                                    className="flex size-7 shrink-0 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-50 sm:size-6"
                                  >
                                    <X size={11} />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <div className="flex flex-col gap-0.5 xl:flex-row xl:items-start xl:justify-between xl:gap-2">
                                    <div className="flex flex-wrap items-center gap-1">
                                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                        PVP
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
                                            guardandoPrecioId ===
                                            item.producto_id
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

                                    <div className="leading-tight xl:text-right">
                                      <span className="block whitespace-nowrap text-[12.5px] font-bold tabular-nums text-slate-900">
                                        {formatearMoneda(
                                          rentabilidadProducto.precioVentaSugeridoUSD,
                                          'USD',
                                        )}
                                      </span>
                                      <span className="block whitespace-nowrap text-[12.5px] font-bold tabular-nums text-slate-900">
                                        {formatearMoneda(
                                          rentabilidadProducto.precioVentaSugeridoARS,
                                          'ARS',
                                        )}
                                      </span>
                                    </div>
                                  </div>

                                  <p
                                    className={`mt-1 whitespace-nowrap text-[10px] font-semibold tabular-nums ${
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
                                    · {rentabilidadProducto.roiPorcentaje.toFixed(0)}
                                    % ROI
                                  </p>
                                </>
                              )}
                            </div>
                          )}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 text-[11px] text-slate-400">
                        Sin stock para calcular costo
                      </div>
                    )}
                  </div>

                  {/* Zona 4: Carrito y acciones rápidas (siempre visible) */}
                  <div className="flex items-center gap-2 xl:flex-col xl:items-stretch xl:justify-center xl:gap-1.5">
                    {mejorOferta && mejorOferta.disponible ? (
                      <button
                        type="button"
                        onClick={() => onAdd(item, mejorOferta)}
                        aria-label={`Agregar mejor oferta de ${item.nombre} (${mejorOferta.proveedor}) al carrito`}
                        title={`Agregar mejor oferta (${mejorOferta.proveedor}) al carrito`}
                        className="primary-action flex h-10 flex-1 flex-col items-center justify-center rounded-lg bg-[#34294d] px-2.5 py-1.5 leading-tight text-white shadow-xs transition hover:bg-[#45365f] xl:h-auto xl:w-full xl:flex-none xl:px-3 xl:py-2"
                      >
                        <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold">
                          <Plus size={14} />
                          <span>Agregar</span>
                          {cantidadEnCarrito > 0 && (
                            <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px] font-bold tabular-nums">
                              ×{cantidadEnCarrito}
                            </span>
                          )}
                        </span>
                        <span className="whitespace-nowrap text-[10px] font-medium text-violet-200 xl:mt-0.5">
                          en {mejorOferta.proveedor}
                        </span>
                      </button>
                    ) : (
                      <div className="flex h-10 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-400 xl:h-11 xl:flex-none">
                        Sin stock
                      </div>
                    )}

                    <div className="grid shrink-0 grid-cols-4 gap-1 xl:w-full">
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
                        className={`row-action flex h-10 w-9 items-center justify-center rounded-md border transition xl:h-7 xl:w-auto ${
                          alertaEvaluada?.tieneAlertaActiva
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                            : enWatchlist
                              ? 'border-amber-300 bg-amber-50 text-amber-700'
                              : 'border-slate-200 bg-white text-slate-500 hover:border-violet-200 hover:text-violet-700'
                        }`}
                      >
                        {alertaEvaluada?.tieneAlertaActiva ? (
                          <BellRing size={13} />
                        ) : (
                          <Star
                            size={13}
                            className={enWatchlist ? 'fill-current' : ''}
                          />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => onHistory(item)}
                        aria-label={`Ver historial de ${item.nombre}`}
                        title="Ver historial de precios"
                        className="row-action flex h-10 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-violet-200 hover:text-violet-700 xl:h-7 xl:w-auto"
                      >
                        <TrendingDown size={13} />
                      </button>

                      <button
                        type="button"
                        onClick={() => onFusionar(item)}
                        aria-label={`Fusionar ${item.nombre} con otro perfume`}
                        title="Fusionar con otro perfume (mismo perfume con otro nombre)"
                        className="row-action flex h-10 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-violet-200 hover:text-violet-700 xl:h-7 xl:w-auto"
                      >
                        <GitMerge size={13} />
                      </button>

                      <a
                        href={urlMercadoLibre}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Buscar ${item.nombre} en MercadoLibre`}
                        title={`Buscar ${item.marca} ${item.nombre} en MercadoLibre Argentina`}
                        className="row-action flex h-10 w-9 items-center justify-center gap-0.5 rounded-md border border-amber-200 bg-amber-50 text-[10px] font-bold text-amber-800 transition hover:bg-amber-100 xl:h-7 xl:w-auto"
                      >
                        <span>ML</span>
                        <ExternalLink size={10} />
                      </a>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>

          {productos.length === 0 && (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <Search size={20} className="mb-2 text-slate-300" />
              <p className="text-[12px] font-medium text-slate-600">
                {(filtroArbitrajeActivo || filtroExclusivosActivo) &&
                proveedoresActivos.length < 2
                  ? 'Necesitás al menos 2 proveedores activos'
                  : 'No se encontraron productos'}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {(filtroArbitrajeActivo || filtroExclusivosActivo) &&
                proveedoresActivos.length < 2
                  ? 'Activá más proveedores arriba para comparar diferencias entre listas.'
                  : 'Probá con otra búsqueda o ajustá los filtros.'}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                {hayProveedoresDesactivados && (
                  <button
                    type="button"
                    onClick={onActivarTodosLosProveedores}
                    className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11px] font-semibold text-violet-700 hover:bg-slate-50"
                  >
                    Activar todos los proveedores
                  </button>
                )}
                <button
                  type="button"
                  onClick={onLimpiarFiltros}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                >
                  Limpiar filtros
                </button>
              </div>
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
