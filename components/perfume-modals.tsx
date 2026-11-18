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
  type AliasImportacion,
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
  TipoListaImportacion,
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

export function RentabilidadModal({
  config,
  dolarDelDia,
  monedaVisualizacion,
  productosGlobales,
  onSetMargenGeneral,
  onSetMargenPorTipo,
  onSetComisionPlataforma,
  onSetCostoFijo,
  onSetCostoEnvioUSD,
  onSetGananciaFijaARS,
  onGuardarPrecioManual,
  onSetMostrarEnCatalogo,
  onRestaurar,
  onCerrar,
}: {
  config: ConfiguracionRentabilidad
  dolarDelDia: number
  monedaVisualizacion: Moneda
  productosGlobales: ProductoComparado[]
  onSetMargenGeneral: (valor: number) => void
  onSetMargenPorTipo: (tipo: TipoProducto, valor: number | null) => void
  onSetComisionPlataforma: (valor: number) => void
  onSetCostoFijo: (valor: number) => void
  onSetCostoEnvioUSD: (valor: number) => void
  onSetGananciaFijaARS: (valor: number) => void
  onGuardarPrecioManual: (
    producto: ProductoComparado,
    nuevoPrecioARS: number | null,
  ) => Promise<void>
  onSetMostrarEnCatalogo: (mostrar: boolean) => void
  onRestaurar: () => void
  onCerrar: () => void
}) {
  const [mostrarPorTipo, setMostrarPorTipo] = useState(false)
  const [productoSimId, setProductoSimId] = useState<string>('')
  const [costoManual, setCostoManual] = useState<string>('30')
  const [monedaManual, setMonedaManual] = useState<Moneda>(monedaVisualizacion)
  const [mlManual, setMlManual] = useState<string>('100')
  const [tipoManual, setTipoManual] = useState<TipoProducto>('Perfume')
  const [pvpManualSimInput, setPvpManualSimInput] = useState<string>('')
  const [guardandoPvpManual, setGuardandoPvpManual] = useState(false)

  const productoSeleccionado = useMemo(
    () =>
      productoSimId
        ? productosGlobales.find((p) => String(p.producto_id) === productoSimId)
        : undefined,
    [productoSimId, productosGlobales],
  )

  const alSeleccionarProducto = (valorId: string) => {
    setProductoSimId(valorId)
    if (!valorId) {
      setPvpManualSimInput('')
      return
    }
    const encontrado = productosGlobales.find(
      (p) => String(p.producto_id) === valorId,
    )
    if (!encontrado) return

    setTipoManual(encontrado.tipo)
    setMlManual(encontrado.ml ? String(encontrado.ml) : '')
    const manualActual =
      encontrado.precioVentaManualARS ??
      config.preciosVentaManualesARS?.[encontrado.producto_id] ??
      null
    setPvpManualSimInput(
      manualActual !== null && manualActual > 0
        ? String(Math.round(manualActual))
        : '',
    )

    const precio =
      monedaVisualizacion === 'USD'
        ? encontrado.mejorPrecioUSD
        : encontrado.mejorPrecioARS
    if (precio !== null) {
      setMonedaManual(monedaVisualizacion)
      setCostoManual(
        monedaVisualizacion === 'USD'
          ? String(Number(precio.toFixed(2)))
          : String(Math.round(precio)),
      )
    }
  }

  const costoNumero = Number(costoManual)
  const costoValido = Number.isFinite(costoNumero) && costoNumero > 0 ? costoNumero : 0
  const costoARS = monedaManual === 'ARS' ? costoValido : costoValido * dolarDelDia
  const costoUSD = monedaManual === 'USD' ? costoValido : costoValido / dolarDelDia
  const mlNumero = Number(mlManual)
  const mlValido = Number.isFinite(mlNumero) && mlNumero > 0 ? mlNumero : null

  const pvpManualNumero = Number(pvpManualSimInput)
  const pvpManualOverride =
    pvpManualSimInput.trim() !== '' &&
    Number.isFinite(pvpManualNumero) &&
    pvpManualNumero > 0
      ? pvpManualNumero
      : null

  const resultadoSim = calcularRentabilidadUnitaria({
    productoId: productoSeleccionado?.producto_id,
    costoARS,
    costoUSD,
    ml: mlValido,
    tipo: tipoManual,
    dolarDelDia,
    config,
    precioVentaManualARS: pvpManualOverride,
  })

  const urlMercadoLibreSim = construirUrlBusquedaMercadoLibre({
    marca: productoSeleccionado?.marca ?? '',
    nombre: productoSeleccionado?.nombre ?? tipoManual,
    concentracion: productoSeleccionado?.concentracion,
    ml: mlValido,
  })

  const guardarPvpManualDelPerfume = async (limpiar = false) => {
    if (!productoSeleccionado) return
    setGuardandoPvpManual(true)
    try {
      if (limpiar) {
        setPvpManualSimInput('')
        await onGuardarPrecioManual(productoSeleccionado, null)
      } else if (pvpManualOverride !== null) {
        await onGuardarPrecioManual(productoSeleccionado, pvpManualOverride)
      }
    } finally {
      setGuardandoPvpManual(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-xs sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCerrar()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-rentabilidad"
        className="dashboard-card dashboard-modal max-h-[92vh] w-full max-w-[720px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.12em] text-violet-600">
              <Calculator size={12} />
              Rentabilidad y Reventa
            </span>
            <h3
              id="titulo-modal-rentabilidad"
              className="mt-0.5 text-[16px] font-semibold tracking-tight text-slate-900"
            >
              Comisión de retiro, ganancia fija, márgenes y comparación con ML
            </h3>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar calculadora de rentabilidad"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </div>

        {/* Bloque 1: Retiro/Envío a Arg (USD) + Ganancia Fija (ARS) */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className="text-[11px] font-semibold text-slate-700">
                Comisión retiro / envío a Arg (USD c/u)
              </span>
              <div className="flex items-center gap-1">
                {[3.5, 2, 0].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => onSetCostoEnvioUSD(val)}
                    className={`rounded px-2 py-0.5 text-[10px] font-semibold transition ${
                      config.costoEnvioPorPerfumeUSD === val
                        ? 'bg-[#34294d] text-white'
                        : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    USD {val}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.5"
                aria-label="Comisión fija de retiro en USD por perfume"
                value={config.costoEnvioPorPerfumeUSD}
                onChange={(e) => onSetCostoEnvioUSD(Number(e.target.value))}
                className="h-9 w-28 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-800 outline-none focus:border-violet-400"
              />
              <span className="text-[11px] text-slate-500">
                USD/u ≈{' '}
                <strong>
                  {formatearMoneda(
                    config.costoEnvioPorPerfumeUSD * dolarDelDia,
                    'ARS',
                  )}
                </strong>{' '}
                sumados al costo
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className="text-[11px] font-semibold text-slate-700">
                Ganancia fija adicional (ARS c/u)
              </span>
              <div className="flex items-center gap-1">
                {[0, 5000, 10000, 15000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => onSetGananciaFijaARS(val)}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition ${
                      config.gananciaFijaAdicionalARS === val
                        ? 'bg-[#34294d] text-white'
                        : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {val === 0 ? '$0' : `+$${val / 1000}k`}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="1000"
                aria-label="Ganancia fija adicional en pesos por perfume"
                value={config.gananciaFijaAdicionalARS}
                onChange={(e) => onSetGananciaFijaARS(Number(e.target.value))}
                className="h-9 w-32 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-800 outline-none focus:border-violet-400"
              />
              <span className="text-[11px] text-slate-500">
                ARS sumados además del {config.margenGeneralPorcentaje}%
              </span>
            </div>
          </div>
        </div>

        {/* Bloque 2: Margen %, Comisión plataforma % y Embalaje local */}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-[11px] font-medium text-slate-600">
              Margen general (%)
            </span>
            <input
              type="number"
              min="0"
              max="500"
              value={config.margenGeneralPorcentaje}
              onChange={(e) => onSetMargenGeneral(Number(e.target.value))}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-800 outline-none focus:border-violet-400"
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-medium text-slate-600">
              Comisión plataforma (%)
            </span>
            <input
              type="number"
              min="0"
              max="85"
              value={config.comisionPlataformaPorcentaje}
              onChange={(e) =>
                onSetComisionPlataforma(Number(e.target.value))
              }
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-800 outline-none focus:border-violet-400"
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-medium text-slate-600">
              Embalaje / envío local (ARS)
            </span>
            <input
              type="number"
              min="0"
              value={config.costoFijoEnvioEmbalajeARS}
              onChange={(e) => onSetCostoFijo(Number(e.target.value))}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-800 outline-none focus:border-violet-400"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-600">
            <input
              type="checkbox"
              checked={config.mostrarRentabilidadEnCatalogo}
              onChange={(e) => onSetMostrarEnCatalogo(e.target.checked)}
              className="size-3.5 accent-violet-700"
            />
            Mostrar columna &ldquo;Reventa sugerida&rdquo; en el catálogo
          </label>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMostrarPorTipo((v) => !v)}
              className="text-[11px] font-semibold text-violet-700 hover:underline"
            >
              {mostrarPorTipo
                ? 'Ocultar márgenes por tipo'
                : 'Márgenes por tipo de producto'}
            </button>
            <button
              type="button"
              onClick={onRestaurar}
              className="text-[11px] font-medium text-slate-400 hover:text-slate-700"
            >
              Restaurar
            </button>
          </div>
        </div>

        {mostrarPorTipo && (
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-4">
            {TIPOS_PRODUCTO_DISPONIBLES.map((tipo) => (
              <label key={tipo} className="block">
                <span className="text-[10px] font-medium text-slate-500">
                  {tipo} (%)
                </span>
                <input
                  type="number"
                  min="0"
                  max="500"
                  placeholder={String(config.margenGeneralPorcentaje)}
                  value={config.margenPorTipo[tipo] ?? ''}
                  onChange={(e) => {
                    const val = e.target.value.trim()
                    onSetMargenPorTipo(tipo, val === '' ? null : Number(val))
                  }}
                  className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-800 outline-none"
                />
              </label>
            ))}
          </div>
        )}

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] font-semibold text-slate-800">
              Calculadora rápida y comparador con MercadoLibre
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {productosGlobales.length > 0 && (
                <select
                  aria-label="Cargar perfume en calculadora"
                  value={productoSimId}
                  onChange={(e) => alSeleccionarProducto(e.target.value)}
                  className="h-8 max-w-[230px] rounded-lg border border-slate-200 bg-white px-2 text-[11px] text-slate-700 outline-none"
                >
                  <option value="">Elegir perfume del catálogo...</option>
                  {productosGlobales.slice(0, 200).map((p) => (
                    <option key={p.producto_id} value={String(p.producto_id)}>
                      {p.marca} · {p.nombre}
                    </option>
                  ))}
                </select>
              )}

              <a
                href={urlMercadoLibreSim}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 text-[11px] font-semibold text-amber-800 transition hover:bg-amber-100"
              >
                <ExternalLink size={12} />
                Buscar en ML
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <label className="block">
              <span className="text-[10px] font-medium text-slate-500">
                Costo proveedor
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={costoManual}
                onChange={(e) => setCostoManual(e.target.value)}
                className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-800 outline-none"
              />
            </label>

            <label className="block">
              <span className="text-[10px] font-medium text-slate-500">
                Moneda costo
              </span>
              <select
                value={monedaManual}
                onChange={(e) => setMonedaManual(e.target.value as Moneda)}
                className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-700 outline-none"
              >
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </select>
            </label>

            <label className="block">
              <span className="text-[10px] font-medium text-slate-500">
                Contenido (ml)
              </span>
              <input
                type="number"
                min="0"
                value={mlManual}
                onChange={(e) => setMlManual(e.target.value)}
                placeholder="100"
                className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-800 outline-none"
              />
            </label>

            <label className="block">
              <span className="text-[10px] font-medium text-slate-500">
                Tipo
              </span>
              <select
                value={tipoManual}
                onChange={(e) => setTipoManual(e.target.value as TipoProducto)}
                className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-700 outline-none"
              >
                {TIPOS_PRODUCTO_DISPONIBLES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Precio de venta manual (para probar en vivo o guardar en Supabase) */}
          <div className="mt-3 flex flex-wrap items-end justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2.5">
            <label className="min-w-[200px] flex-1">
              <span className="block text-[10px] font-semibold text-slate-600">
                Precio de venta manual en ARS (opcional, si viste otro valor en ML)
              </span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={pvpManualSimInput}
                  onChange={(e) => setPvpManualSimInput(e.target.value)}
                  placeholder={`Fórmula automática: ${formatearMoneda(
                    resultadoSim.precioCalculadoFormulaARS,
                    'ARS',
                  )}`}
                  className="h-8 w-full max-w-[220px] rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-800 outline-none focus:border-violet-400"
                />
                {pvpManualOverride !== null && (
                  <span className="text-[10px] text-slate-400">
                    (≈ {formatearMoneda(pvpManualOverride / dolarDelDia, 'USD')})
                  </span>
                )}
              </div>
            </label>

            {productoSeleccionado && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={guardandoPvpManual || pvpManualOverride === null}
                  onClick={() => void guardarPvpManualDelPerfume(false)}
                  className="primary-action inline-flex h-8 items-center gap-1 rounded-md bg-[#34294d] px-3 text-[10px] font-semibold text-white transition hover:bg-[#45365f] disabled:opacity-50"
                >
                  <Check size={12} />
                  Guardar PVP en Supabase
                </button>
                {(productoSeleccionado.precioVentaManualARS ||
                  config.preciosVentaManualesARS?.[
                    productoSeleccionado.producto_id
                  ] ||
                  pvpManualSimInput) && (
                  <button
                    type="button"
                    disabled={guardandoPvpManual}
                    onClick={() => void guardarPvpManualDelPerfume(true)}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <RotateCcw size={11} />
                    Usar fórmula
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-2.5">
              <p className="text-[10px] text-slate-400">
                Costo total (+USD {config.costoEnvioPorPerfumeUSD} retiro)
              </p>
              <p className="mt-0.5 text-[13px] font-semibold text-slate-800">
                {formatearMoneda(resultadoSim.costoTotalUSD, 'USD')}
              </p>
              <p className="text-[10px] text-slate-400">
                {formatearMoneda(resultadoSim.costoTotalARS, 'ARS')}
              </p>
            </div>

            <div className="rounded-lg border border-violet-200 bg-violet-50 p-2.5">
              <p className="text-[10px] font-semibold text-violet-700">
                {resultadoSim.esPrecioManual ? 'PVP manual aplicado' : 'PVP sugerido'}
              </p>
              <p className="mt-0.5 text-[13px] font-semibold text-violet-800">
                {formatearMoneda(resultadoSim.precioVentaSugeridoARS, 'ARS')}
              </p>
              <p className="text-[10px] text-violet-700">
                {formatearMoneda(resultadoSim.precioVentaSugeridoUSD, 'USD')}
              </p>
            </div>

            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
              <p className="text-[10px] font-semibold text-emerald-700">
                Ganancia neta ({resultadoSim.roiPorcentaje.toFixed(1)}% ROI)
              </p>
              <p className="mt-0.5 text-[13px] font-semibold text-emerald-700">
                +{formatearMoneda(resultadoSim.gananciaNetaARS, 'ARS')}
              </p>
              <p className="text-[10px] text-emerald-700">
                +{formatearMoneda(resultadoSim.gananciaNetaUSD, 'USD')}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-2.5">
              <p className="text-[10px] text-slate-400">Costo por ml</p>
              {resultadoSim.costoPorMlUSD !== null &&
              resultadoSim.costoPor100MlUSD !== null ? (
                <>
                  <p className="mt-0.5 text-[13px] font-semibold text-slate-800">
                    {formatearMoneda(
                      monedaVisualizacion === 'USD'
                        ? resultadoSim.costoPorMlUSD
                        : (resultadoSim.costoPorMlARS ?? 0),
                      monedaVisualizacion,
                    )}
                    /ml
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {formatearMoneda(
                      monedaVisualizacion === 'USD'
                        ? resultadoSim.costoPor100MlUSD
                        : (resultadoSim.costoPor100MlARS ?? 0),
                      monedaVisualizacion,
                    )}
                    /100ml
                  </p>
                </>
              ) : (
                <p className="mt-1 text-[11px] text-slate-400">Sin ml</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onCerrar}
            className="primary-action rounded-lg bg-[#34294d] px-4 py-2 text-[11px] font-semibold text-white transition hover:bg-[#45365f]"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  )
}

export function AlertaWatchlistModal({
  producto,
  itemExistente,
  monedaVisualizacion,
  onGuardar,
  onQuitar,
  onCerrar,
}: {
  producto: ProductoComparado
  itemExistente?: ItemWatchlist
  monedaVisualizacion: Moneda
  onGuardar: (datos: {
    precioObjetivo: number | null
    monedaObjetivo: Moneda
    avisarStock: boolean
    avisarBajaPrecio: boolean
    nota?: string
  }) => void
  onQuitar: () => void
  onCerrar: () => void
}) {
  const [monedaObjetivo, setMonedaObjetivo] = useState<Moneda>(
    itemExistente?.monedaObjetivo ?? monedaVisualizacion,
  )
  const [precioObjetivoInput, setPrecioObjetivoInput] = useState<string>(
    itemExistente?.precioObjetivo !== null &&
      itemExistente?.precioObjetivo !== undefined
      ? String(itemExistente.precioObjetivo)
      : '',
  )
  const [avisarStock, setAvisarStock] = useState<boolean>(
    itemExistente?.avisarStock ?? true,
  )
  const [avisarBajaPrecio, setAvisarBajaPrecio] = useState<boolean>(
    itemExistente?.avisarBajaPrecio ?? true,
  )
  const [nota, setNota] = useState<string>(itemExistente?.nota ?? '')

  const precioActualEnMoneda =
    monedaObjetivo === 'USD'
      ? producto.mejorPrecioUSD
      : producto.mejorPrecioARS

  const aplicarDescuentoRapido = (porcentaje: number) => {
    if (precioActualEnMoneda === null) return
    const objetivo = precioActualEnMoneda * (1 - porcentaje / 100)
    setPrecioObjetivoInput(
      monedaObjetivo === 'USD'
        ? String(Number(objetivo.toFixed(2)))
        : String(Math.round(objetivo)),
    )
  }

  const manejarGuardar = () => {
    const numero = Number(precioObjetivoInput)
    const precioObjetivo =
      precioObjetivoInput.trim() !== '' &&
      Number.isFinite(numero) &&
      numero > 0
        ? numero
        : null

    onGuardar({
      precioObjetivo,
      monedaObjetivo,
      avisarStock,
      avisarBajaPrecio,
      nota,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-xs sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCerrar()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-alerta"
        className="dashboard-card dashboard-modal w-full max-w-[440px] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <ImagenFrasco
              src={producto.imagen_url}
              tipo={producto.tipo}
              alt={`${producto.marca} ${producto.nombre}`}
              className="size-11 shrink-0 rounded-lg border border-slate-200"
            />
            <div>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[.12em] text-violet-600">
                <Bell size={11} />
                Seguimiento y Alerta
              </span>
              <h3
                id="titulo-modal-alerta"
                className="text-[15px] font-semibold tracking-tight text-slate-900"
              >
                {producto.marca} · {producto.nombre}
              </h3>
              <p className="text-[11px] text-slate-500">
                {producto.tieneStockDisponible && producto.mejorPrecioUSD !== null
                  ? `Mejor actual: ${formatearMoneda(
                      producto.mejorPrecioUSD,
                      'USD',
                    )} / ${formatearMoneda(producto.mejorPrecioARS ?? 0, 'ARS')} (${producto.proveedorMasBarato})`
                  : 'Actualmente sin stock disponible'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar alerta"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-slate-600">
                Precio objetivo máximo
              </span>
              {precioActualEnMoneda !== null && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => aplicarDescuentoRapido(5)}
                    className="rounded bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 hover:bg-violet-100"
                  >
                    -5%
                  </button>
                  <button
                    type="button"
                    onClick={() => aplicarDescuentoRapido(10)}
                    className="rounded bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 hover:bg-violet-100"
                  >
                    -10%
                  </button>
                </div>
              )}
            </div>

            <div className="mt-1.5 flex gap-2">
              <select
                aria-label="Moneda del precio objetivo"
                value={monedaObjetivo}
                onChange={(e) => setMonedaObjetivo(e.target.value as Moneda)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 outline-none"
              >
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                value={precioObjetivoInput}
                onChange={(e) => setPrecioObjetivoInput(e.target.value)}
                placeholder="Ej: 26.50 (opcional)"
                className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-800 outline-none focus:border-violet-400"
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-700">
            <input
              type="checkbox"
              checked={avisarStock}
              onChange={(e) => setAvisarStock(e.target.checked)}
              className="size-3.5 accent-violet-700"
            />
            Avisar cuando haya stock disponible
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-700">
            <input
              type="checkbox"
              checked={avisarBajaPrecio}
              onChange={(e) => setAvisarBajaPrecio(e.target.checked)}
              className="size-3.5 accent-violet-700"
            />
            Avisar si registra una baja de precio
          </label>

          <label className="block">
            <span className="text-[11px] font-medium text-slate-600">
              Nota rápida (opcional)
            </span>
            <input
              type="text"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ej: Reponer para fin de semana"
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[11px] text-slate-800 outline-none focus:border-violet-400"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
          {itemExistente ? (
            <button
              type="button"
              onClick={onQuitar}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 hover:underline"
            >
              <Trash2 size={12} />
              Quitar seguimiento
            </button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCerrar}
              className="rounded-lg border border-slate-200 px-3.5 py-2 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={manejarGuardar}
              className="primary-action rounded-lg bg-[#34294d] px-4 py-2 text-[11px] font-semibold text-white transition hover:bg-[#45365f]"
            >
              Guardar alerta
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ImportadorListasModal({
  proveedoresDisponibles,
  productosGlobales,
  alias = [],
  onImportar,
  onCerrar,
}: {
  proveedoresDisponibles: string[]
  productosGlobales: ProductoComparado[]
  alias?: AliasImportacion[]
  onImportar: (resumen: ResumenPrevisualizacionImportacion) => Promise<void>
  onCerrar: () => void
}) {
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<string>(
    proveedoresDisponibles[0] ?? '__NUEVO__',
  )
  const [nuevoProveedor, setNuevoProveedor] = useState<string>('')
  const [moneda, setMoneda] = useState<Moneda>('USD')
  const [tipoLista, setTipoLista] = useState<TipoListaImportacion>('Arabe')
  const [categoriasEditadas, setCategoriasEditadas] = useState<
    Record<number, CategoriaPerfume | null>
  >({})
  const [textoLista, setTextoLista] = useState<string>('')
  const [importando, setImportando] = useState(false)
  const [errorImport, setErrorImport] = useState<string | null>(null)

  const proveedorFinal =
    proveedorSeleccionado === '__NUEVO__'
      ? nuevoProveedor.trim()
      : proveedorSeleccionado

  const resumen = useMemo(() => {
    if (!textoLista.trim()) return null
    return generarPrevisualizacionImportacion(
      textoLista,
      proveedorFinal || 'Nuevo Proveedor',
      moneda,
      productosGlobales,
      tipoLista,
      alias,
    )
  }, [textoLista, proveedorFinal, moneda, productosGlobales, tipoLista, alias])

  const itemsConCategoria = useMemo(() => {
    if (!resumen) return []
    return resumen.items.map((item) => {
      const override = categoriasEditadas[item.fila.lineaNumero]
      if (override === undefined) return item
      return {
        ...item,
        fila: {
          ...item.fila,
          categoria: override,
        },
      }
    })
  }, [resumen, categoriasEditadas])

  const conteoSinCategoria = useMemo(
    () => itemsConCategoria.filter((item) => !item.fila.categoria).length,
    [itemsConCategoria],
  )

  const manejarArchivo = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const archivo = event.target.files?.[0]
    if (!archivo) return
    try {
      const contenido = await archivo.text()
      setTextoLista(contenido)
      setErrorImport(null)
    } catch {
      setErrorImport('No se pudo leer el archivo seleccionado.')
    }
    event.target.value = ''
  }

  const manejarConfirmar = async () => {
    if (!resumen || resumen.items.length === 0) return
    if (!proveedorFinal) {
      setErrorImport('Ingresá o seleccioná el nombre del proveedor.')
      return
    }

    setImportando(true)
    setErrorImport(null)
    try {
      await onImportar({
        ...resumen,
        proveedor: proveedorFinal,
        items: itemsConCategoria,
      })
    } catch (error) {
      setErrorImport(
        error instanceof Error
          ? error.message
          : 'No se pudo completar la importación.',
      )
    } finally {
      setImportando(false)
    }
  }

  const etiquetaEstado = (estado: string) => {
    switch (estado) {
      case 'nuevo_producto':
        return {
          texto: 'Nuevo producto',
          clase: 'bg-violet-50 text-violet-700',
        }
      case 'nueva_oferta':
        return {
          texto: 'Nueva oferta',
          clase: 'bg-blue-50 text-blue-700',
        }
      case 'bajo_precio':
        return {
          texto: 'Bajó precio',
          clase: 'bg-emerald-50 text-emerald-700',
        }
      case 'subio_precio':
        return {
          texto: 'Subió precio',
          clase: 'bg-rose-50 text-rose-600',
        }
      case 'cambio_stock':
        return {
          texto: 'Cambió stock',
          clase: 'bg-amber-50 text-amber-700',
        }
      default:
        return {
          texto: 'Sin cambios',
          clase: 'bg-slate-100 text-slate-500',
        }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-xs sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget && !importando) onCerrar()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-importador"
        className="dashboard-card dashboard-modal max-h-[92vh] w-full max-w-[780px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.12em] text-violet-600">
              <FileSpreadsheet size={12} />
              Importador de listas
            </span>
            <h3
              id="titulo-modal-importador"
              className="mt-0.5 text-[16px] font-semibold tracking-tight text-slate-900"
            >
              Subir o pegar lista de precios (CSV, Excel / TSV, texto)
            </h3>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            disabled={importando}
            aria-label="Cerrar importador de listas"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-[11px] font-medium text-slate-600">
              Proveedor
            </span>
            <select
              value={proveedorSeleccionado}
              onChange={(e) => setProveedorSeleccionado(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-800 outline-none"
            >
              {proveedoresDisponibles.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
              <option value="__NUEVO__">+ Otro proveedor nuevo</option>
            </select>
          </label>

          {proveedorSeleccionado === '__NUEVO__' ? (
            <label className="block">
              <span className="text-[11px] font-medium text-slate-600">
                Nombre del nuevo proveedor
              </span>
              <input
                type="text"
                value={nuevoProveedor}
                onChange={(e) => setNuevoProveedor(e.target.value)}
                placeholder="Ej: Perfumería Sur"
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[11px] text-slate-800 outline-none focus:border-violet-400"
              />
            </label>
          ) : (
            <div className="flex items-end">
              <label className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100">
                <Upload size={13} className="text-violet-600" />
                <span>Subir .csv / .tsv / .txt</span>
                <input
                  type="file"
                  accept=".csv,.tsv,.txt,text/csv,text/plain"
                  onChange={(e) => void manejarArchivo(e)}
                  className="hidden"
                />
              </label>
            </div>
          )}

          <label className="block">
            <span className="text-[11px] font-medium text-slate-600">
              Moneda de la lista
            </span>
            <select
              value={moneda}
              onChange={(e) => setMoneda(e.target.value as Moneda)}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-800 outline-none"
            >
              <option value="USD">USD (Dólares)</option>
              <option value="ARS">ARS (Pesos)</option>
            </select>
          </label>
        </div>

        <div className="mt-3">
          <span className="text-[11px] font-medium text-slate-600">
            Tipo de lista (gama de perfumes)
          </span>
          <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(
              [
                {
                  valor: 'Arabe',
                  titulo: 'Todos Árabes',
                  descripcion: 'Asigna categoría Árabe a toda la lista',
                },
                {
                  valor: 'Premium',
                  titulo: 'Todos Premium',
                  descripcion: 'Diseñador y Nicho',
                },
                {
                  valor: 'Mixta',
                  titulo: 'Lista Mixta',
                  descripcion: 'Trae ambas gamas; asignás por perfume',
                },
              ] as const
            ).map((opcion) => {
              const activo = tipoLista === opcion.valor
              return (
                <button
                  key={opcion.valor}
                  type="button"
                  onClick={() => {
                    setTipoLista(opcion.valor)
                    setCategoriasEditadas({})
                  }}
                  className={`rounded-xl border px-3 py-2 text-left transition ${
                    activo
                      ? 'border-violet-500 bg-violet-50/70 ring-1 ring-violet-500/30'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[11px] font-semibold ${
                        activo ? 'text-violet-900' : 'text-slate-800'
                      }`}
                    >
                      {opcion.titulo}
                    </span>
                    <span
                      className={`size-2 rounded-full ${
                        activo ? 'bg-violet-600' : 'bg-slate-200'
                      }`}
                    />
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {opcion.descripcion}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-slate-600">
              Pegá filas desde Excel, Google Sheets o CSV
            </span>
            <div className="flex items-center gap-3">
              {proveedorSeleccionado === '__NUEVO__' && (
                <label className="cursor-pointer text-[11px] font-semibold text-violet-700 hover:underline">
                  Subir archivo
                  <input
                    type="file"
                    accept=".csv,.tsv,.txt,text/csv,text/plain"
                    onChange={(e) => void manejarArchivo(e)}
                    className="hidden"
                  />
                </label>
              )}
              <button
                type="button"
                onClick={() => setTextoLista(PLANTILLA_EJEMPLO_IMPORTACION)}
                className="text-[11px] font-semibold text-violet-700 hover:underline"
              >
                Cargar ejemplo de prueba
              </button>
              {textoLista && (
                <button
                  type="button"
                  onClick={() => setTextoLista('')}
                  className="text-[11px] font-medium text-slate-400 hover:text-slate-700"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          <textarea
            rows={5}
            value={textoLista}
            onChange={(e) => setTextoLista(e.target.value)}
            placeholder={
              'Ej:\nMarca;Nombre;ML;Concentracion;PrecioBase;Precio12;Precio24;Stock\nLattafa;Asad Bourbon;100;EDP;27.50;25.50;24.00;Disponible\nAfnan 9pm Elixir 100ml\t29.20'
            }
            className="w-full rounded-xl border border-slate-200 bg-slate-50/70 p-3 font-mono text-[11px] text-slate-800 outline-none focus:border-violet-400"
          />
        </div>

        {errorImport && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[11px] text-rose-700">
            {errorImport}
          </div>
        )}

        {resumen && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] font-semibold">
              <span className="rounded-full bg-white px-2.5 py-1 text-slate-700 ring-1 ring-slate-200">
                {resumen.items.length} filas válidas
              </span>
              {resumen.conteoNuevosProductos > 0 && (
                <span className="rounded-full bg-violet-50 px-2.5 py-1 text-violet-700">
                  +{resumen.conteoNuevosProductos} nuevos productos
                </span>
              )}
              {resumen.conteoNuevasOfertas > 0 && (
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">
                  +{resumen.conteoNuevasOfertas} nuevas ofertas
                </span>
              )}
              {resumen.conteoBajasPrecio > 0 && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                  ↓ {resumen.conteoBajasPrecio} bajaron
                </span>
              )}
              {resumen.conteoSubasPrecio > 0 && (
                <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-600">
                  ↑ {resumen.conteoSubasPrecio} subieron
                </span>
              )}
              {resumen.conteoCambiosStock > 0 && (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
                  {resumen.conteoCambiosStock} cambios de stock
                </span>
              )}
              {resumen.conteoSinCambios > 0 && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">
                  {resumen.conteoSinCambios} sin cambios
                </span>
              )}
              {conteoSinCategoria > 0 && (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700 ring-1 ring-amber-200">
                  {conteoSinCategoria} sin categoría (se puede asignar después)
                </span>
              )}
            </div>

            {resumen.erroresFormato.length > 0 && (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-800">
                {resumen.erroresFormato.slice(0, 3).map((err) => (
                  <p key={err}>{err}</p>
                ))}
                {resumen.erroresFormato.length > 3 && (
                  <p>
                    ...y {resumen.erroresFormato.length - 3} línea(s) omitida(s).
                  </p>
                )}
              </div>
            )}

            {resumen.items.length > 0 && (
              <div className="max-h-[220px] overflow-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="px-3 py-2">Producto</th>
                      <th className="px-3 py-2">Categoría</th>
                      <th className="px-3 py-2">Impacto</th>
                      <th className="px-3 py-2">Precio</th>
                      <th className="px-3 py-2">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {itemsConCategoria.slice(0, 50).map((item) => {
                      const badge = etiquetaEstado(item.estadoCambio)
                      return (
                        <tr key={`${item.fila.lineaNumero}-${item.fila.nombre}`}>
                          <td className="px-3 py-2">
                            <span className="font-semibold text-slate-800">
                              {item.marcaConsolidada} · {item.nombreConsolidado}
                            </span>
                            {item.fila.ml && (
                              <span className="ml-1 text-[11px] text-slate-500">
                                ({item.fila.ml}ml)
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <select
                              aria-label={`Categoría para ${item.nombreConsolidado}`}
                              value={item.fila.categoria ?? ''}
                              onChange={(e) => {
                                const val = e.target.value
                                const nuevaCat: CategoriaPerfume | null =
                                  val === 'Arabe' || val === 'Premium'
                                    ? val
                                    : null
                                setCategoriasEditadas((prev) => ({
                                  ...prev,
                                  [item.fila.lineaNumero]: nuevaCat,
                                }))
                              }}
                              className={`h-7 rounded-md border px-1.5 text-[10px] font-semibold outline-none ${
                                item.fila.categoria === 'Arabe'
                                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                                  : item.fila.categoria === 'Premium'
                                    ? 'border-violet-200 bg-violet-50 text-violet-800'
                                    : 'border-slate-200 bg-slate-50 text-slate-500'
                              }`}
                            >
                              <option value="">Sin categoría</option>
                              <option value="Arabe">Árabe</option>
                              <option value="Premium">Premium</option>
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${badge.clase}`}
                            >
                              {badge.texto}
                              {item.variacionPorcentaje !== null &&
                                Math.abs(item.variacionPorcentaje) >= 0.1 &&
                                ` (${
                                  item.variacionPorcentaje > 0 ? '+' : ''
                                }${item.variacionPorcentaje}%)`}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-semibold text-slate-800">
                            {item.precioAnterior !== null &&
                              item.precioAnterior !== item.fila.precioBase && (
                                <span className="mr-1.5 font-normal text-slate-400 line-through">
                                  {formatearMoneda(item.precioAnterior, moneda)}
                                </span>
                              )}
                            {formatearMoneda(item.fila.precioBase, moneda)}
                          </td>
                          <td className="px-3 py-2 text-[11px] text-slate-600">
                            {item.fila.estadoStock}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onCerrar}
            disabled={importando}
            className="rounded-lg border border-slate-200 px-3.5 py-2 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void manejarConfirmar()}
            disabled={importando || !resumen || resumen.items.length === 0}
            className="primary-action inline-flex items-center gap-1.5 rounded-lg bg-[#34294d] px-4 py-2 text-[11px] font-semibold text-white transition hover:bg-[#45365f] disabled:opacity-50"
          >
            {importando && <Loader2 size={13} className="animate-spin" />}
            {importando
              ? 'Importando...'
              : `Aplicar e importar lista (${resumen?.items.length ?? 0})`}
          </button>
        </div>
      </div>
    </div>
  )
}

