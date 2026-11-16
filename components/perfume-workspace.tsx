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

type VistaActiva = 'overview' | 'catalog' | 'history' | 'cart'

const OPCIONES_TAMANO_PAGINA = [16, 32, 64, 128] as const
const TAMANO_PAGINA_INICIAL = 32
const MAX_TAMANO_PAGINA = 128
const LIMITE_FILAS_RESUMEN = 15

const TIPOS_PRODUCTO_DISPONIBLES: TipoProducto[] = [
  'Perfume',
  'Kit',
  'Body Splash',
  'Desodorante',
  'Crema',
  'Aceite',
  'Otro',
]

function obtenerEstiloTipoProducto(tipo: TipoProducto): {
  cellClass: string
  badgeClass: string
} {
  if (tipo === 'Desodorante' || tipo === 'Body Splash') {
    return {
      cellClass: 'producto-tipo-desodorante',
      badgeClass: 'border-orange-200 bg-orange-100 text-orange-800',
    }
  }

  if (tipo === 'Crema' || tipo === 'Aceite' || tipo === 'Otro') {
    return {
      cellClass: 'producto-tipo-no-fragancia',
      badgeClass: 'border-red-200 bg-red-100 text-red-800',
    }
  }

  return {
    cellClass: 'producto-tipo-perfume',
    badgeClass: 'border-slate-200 bg-white text-slate-600',
  }
}

const GENEROS_FILTRO: Array<{ etiqueta: string; valor: GeneroPerfume | null }> = [
  { etiqueta: 'Todos', valor: null },
  { etiqueta: 'Masculino', valor: 'Masculino' },
  { etiqueta: 'Femenino', valor: 'Femenino' },
  { etiqueta: 'Unisex', valor: 'Unisex' },
]

const OPCIONES_ORDENAMIENTO: Array<{
  etiqueta: string
  valor: CriterioOrdenamiento
}> = [
  { etiqueta: 'Menor precio', valor: 'precio_asc' },
  { etiqueta: 'Mayor precio', valor: 'precio_desc' },
  { etiqueta: 'Menor costo por ml', valor: 'costo_ml_asc' },
  { etiqueta: 'Mayor baja %', valor: 'mayor_baja' },
  { etiqueta: 'Mayor brecha (arbitraje)', valor: 'mayor_brecha' },
  { etiqueta: 'Mayor ganancia neta', valor: 'mayor_ganancia' },
  { etiqueta: 'Nombre (A-Z)', valor: 'nombre_asc' },
  { etiqueta: 'Marca (A-Z)', valor: 'marca_asc' },
]

const OPCIONES_ESCALA: Array<{ etiqueta: string; valor: ModoEscalaMayorista }> = [
  { etiqueta: 'Automática', valor: 'AUTO' },
  { etiqueta: 'Lista Base', valor: 'BASE' },
  { etiqueta: 'Simular 12+', valor: '12+' },
  { etiqueta: 'Simular 24+', valor: '24+' },
]

const COLORES_PROVEEDORES: Record<string, string> = {
  Milano: '#8264d8',
  Supa: '#4a86d9',
  Ambar: '#2a9a72',
}

const PALETA_PROVEEDORES_EXTRA = ['#d97706', '#e11d48', '#0891b2', '#7c3aed']

function obtenerColorProveedor(nombre: string, indice: number): string {
  return (
    COLORES_PROVEEDORES[nombre] ??
    PALETA_PROVEEDORES_EXTRA[indice % PALETA_PROVEEDORES_EXTRA.length]
  )
}

function formatearMoneda(valor: number, moneda: Moneda): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: moneda,
    maximumFractionDigits: moneda === 'USD' ? 2 : 0,
  }).format(valor)
}

/**
 * Datos de respaldo locales utilizados únicamente cuando las variables de entorno
 * de Supabase todavía no fueron configuradas en .env.local.
 */
const FILAS_DEMO_RESPALDO: FilaVistaComparador[] = [
  {
    producto_id: 1,
    ean6: '592909',
    marca: 'Lattafa',
    nombre: 'Asad Bourbon',
    tipo: 'Perfume',
    concentracion: 'EDP',
    ml: 100,
    genero: 'Masculino',
    imagen_url:
      'https://fimgs.net/mdimg/perfume/375x500.101124.jpg',
    proveedor: 'Milano',
    moneda: 'USD',
    precio_base: 31,
    precio_12: 28,
    precio_24: 26.5,
    estado_stock: 'Disponible',
    updated_at: '2026-11-14T12:00:00Z',
  },
  {
    producto_id: 1,
    ean6: '592909',
    marca: 'Lattafa',
    nombre: 'Asad Bourbon',
    tipo: 'Perfume',
    concentracion: 'EDP',
    ml: 100,
    genero: 'Masculino',
    imagen_url:
      'https://fimgs.net/mdimg/perfume/375x500.101124.jpg',
    proveedor: 'Supa',
    moneda: 'ARS',
    precio_base: 42000,
    precio_12: 40500,
    precio_24: 39000,
    estado_stock: 'Disponible',
    updated_at: '2026-11-14T12:00:00Z',
  },
  {
    producto_id: 1,
    ean6: '592909',
    marca: 'Lattafa',
    nombre: 'Asad Bourbon',
    tipo: 'Perfume',
    concentracion: 'EDP',
    ml: 100,
    genero: 'Masculino',
    imagen_url:
      'https://fimgs.net/mdimg/perfume/375x500.101124.jpg',
    proveedor: 'Ambar',
    moneda: 'USD',
    precio_base: 28.9,
    precio_12: null,
    precio_24: null,
    estado_stock: 'Disponible',
    updated_at: '2026-11-14T12:00:00Z',
  },
  {
    producto_id: 2,
    ean6: '075738',
    marca: 'Afnan',
    nombre: '9pm Elixir',
    tipo: 'Perfume',
    concentracion: 'Parfum',
    ml: 100,
    genero: 'Masculino',
    imagen_url:
      'https://fimgs.net/mdimg/perfume/375x500.111894.jpg',
    proveedor: 'Milano',
    moneda: 'USD',
    precio_base: 31,
    precio_12: 28.5,
    precio_24: 27.5,
    estado_stock: 'Disponible',
    updated_at: '2026-11-14T12:00:00Z',
  },
  {
    producto_id: 2,
    ean6: '075738',
    marca: 'Afnan',
    nombre: '9pm Elixir',
    tipo: 'Perfume',
    concentracion: 'Parfum',
    ml: 100,
    genero: 'Masculino',
    imagen_url:
      'https://fimgs.net/mdimg/perfume/375x500.111894.jpg',
    proveedor: 'Supa',
    moneda: 'ARS',
    precio_base: 46500,
    precio_12: null,
    precio_24: null,
    estado_stock: 'Disponible',
    updated_at: '2026-11-14T12:00:00Z',
  },
  {
    producto_id: 2,
    ean6: '075738',
    marca: 'Afnan',
    nombre: '9pm Elixir',
    tipo: 'Perfume',
    concentracion: 'Parfum',
    ml: 100,
    genero: 'Masculino',
    imagen_url:
      'https://fimgs.net/mdimg/perfume/375x500.111894.jpg',
    proveedor: 'Ambar',
    moneda: 'USD',
    precio_base: 28.63,
    precio_12: null,
    precio_24: null,
    estado_stock: 'Disponible',
    updated_at: '2026-11-14T12:00:00Z',
  },
  {
    producto_id: 3,
    ean6: '730324',
    marca: 'Maison Alhambra',
    nombre: 'Yeah! Man',
    tipo: 'Perfume',
    concentracion: 'EDP',
    ml: 100,
    genero: 'Masculino',
    imagen_url:
      'https://fimgs.net/mdimg/perfume/375x500.83061.jpg',
    proveedor: 'Supa',
    moneda: 'ARS',
    precio_base: 26000,
    precio_12: 24500,
    precio_24: null,
    estado_stock: 'Disponible',
    updated_at: '2026-11-14T12:00:00Z',
  },
  {
    producto_id: 3,
    ean6: '730324',
    marca: 'Maison Alhambra',
    nombre: 'Yeah! Man',
    tipo: 'Perfume',
    concentracion: 'EDP',
    ml: 100,
    genero: 'Masculino',
    imagen_url:
      'https://fimgs.net/mdimg/perfume/375x500.83061.jpg',
    proveedor: 'Milano',
    moneda: 'USD',
    precio_base: 15.5,
    precio_12: 14.5,
    precio_24: 13.9,
    estado_stock: 'Disponible',
    updated_at: '2026-11-14T12:00:00Z',
  },
  {
    producto_id: 4,
    ean6: '375694',
    marca: 'French Avenue',
    nombre: 'Liquid Brun',
    tipo: 'Perfume',
    concentracion: 'EDP',
    ml: 100,
    genero: 'Unisex',
    imagen_url:
      'https://fimgs.net/mdimg/perfume/375x500.123526.jpg',
    proveedor: 'Milano',
    moneda: 'USD',
    precio_base: 33,
    precio_12: 31,
    precio_24: 30,
    estado_stock: 'Disponible',
    updated_at: '2026-11-14T12:00:00Z',
  },
  {
    producto_id: 4,
    ean6: '375694',
    marca: 'French Avenue',
    nombre: 'Liquid Brun',
    tipo: 'Perfume',
    concentracion: 'EDP',
    ml: 100,
    genero: 'Unisex',
    imagen_url:
      'https://fimgs.net/mdimg/perfume/375x500.123526.jpg',
    proveedor: 'Ambar',
    moneda: 'USD',
    precio_base: 32.52,
    precio_12: null,
    precio_24: null,
    estado_stock: 'Agotado',
    updated_at: '2026-11-14T12:00:00Z',
  },
]

function construirHistorialDemo(
  producto: ProductoComparado | undefined,
  dolarDelDia: number,
): PuntoHistorialGrafico[] {
  if (!producto) return []
  const fechas = [
    '2026-10-10',
    '2026-10-17',
    '2026-10-24',
    '2026-10-31',
    '2026-11-07',
    '2026-11-14',
  ]
  const factores = [1.04, 1.02, 1.03, 0.99, 1.01, 1]

  return fechas.map((fecha, indice) => {
    const punto: PuntoHistorialGrafico = { fecha }
    const factor = factores[indice]

    for (const oferta of Object.values(producto.ofertas)) {
      if (oferta.precioBaseEnUSD !== null) {
        punto[`${oferta.proveedor}_USD`] = Number(
          (oferta.precioBaseEnUSD * factor).toFixed(2),
        )
      }
      if (oferta.precioBaseEnARS !== null) {
        punto[`${oferta.proveedor}_ARS`] = Math.round(
          oferta.precioBaseEnARS * factor,
        )
      }
      if (oferta.precioBase !== null) {
        punto[`${oferta.proveedor}_ORIGEN`] = Number(
          (oferta.precioBase * factor).toFixed(2),
        )
      } else {
        punto[`${oferta.proveedor}_ARS`] = Math.round(dolarDelDia)
      }
    }

    return punto
  })
}

function ImagenFrasco({
  src,
  alt,
  className,
}: {
  src: string | null | undefined
  alt: string
  className: string
}) {
  return (
    <img
      src={src || '/placeholder.jpg'}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={(event) => {
        event.currentTarget.onerror = null
        event.currentTarget.src = '/placeholder.jpg'
      }}
      className={`bg-white object-contain p-0.5 ${className}`}
    />
  )
}

function SectionTitle({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow?: string
  title: string
  detail?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && (
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.13em] text-violet-600">
            {eyebrow}
          </p>
        )}
        <h2 className="text-[17px] font-semibold tracking-[-.025em] text-slate-900">
          {title}
        </h2>
        {detail && <p className="mt-1 text-[13px] text-slate-500">{detail}</p>}
      </div>
      {action}
    </div>
  )
}

function GraficoEvolucionPrecios({
  datos,
  proveedores,
  moneda,
  isDark,
  cargando,
  altura = 'h-[230px]',
}: {
  datos: PuntoHistorialGrafico[]
  proveedores: string[]
  moneda: Moneda
  isDark: boolean
  cargando: boolean
  altura?: string
}) {
  if (cargando) {
    return (
      <div
        className={`flex ${altura} w-full items-center justify-center gap-2 text-[12px] text-slate-500`}
      >
        <Loader2 size={16} className="animate-spin text-violet-600" />
        <span>Cargando serie histórica...</span>
      </div>
    )
  }

  if (datos.length === 0 || proveedores.length === 0) {
    return (
      <div
        className={`flex ${altura} w-full items-center justify-center text-center text-[12px] text-slate-400`}
      >
        No hay registros históricos cargados para este producto.
      </div>
    )
  }

  const gridColor = isDark ? '#302e38' : '#eef0f4'
  const tickColor = isDark ? '#8f899c' : '#8b92a0'

  return (
    <div className={`${altura} w-full`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={datos}
          margin={{ top: 8, right: 12, left: -10, bottom: 0 }}
        >
          <defs>
            {proveedores.map((proveedor, indice) => {
              const color = obtenerColorProveedor(proveedor, indice)
              const idGradiente = `fillPrice-${indice}`
              return (
                <linearGradient
                  key={idGradiente}
                  id={idGradiente}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={color} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              )
            })}
          </defs>
          <CartesianGrid stroke={gridColor} vertical={false} />
          <XAxis
            dataKey="fecha"
            axisLine={false}
            tickLine={false}
            tick={{ fill: tickColor, fontSize: 10 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: tickColor, fontSize: 10 }}
            domain={['auto', 'auto']}
            tickFormatter={(valor: number) =>
              moneda === 'USD'
                ? `$${valor}`
                : `$${Math.round(valor / 1000)}k`
            }
          />
          <Tooltip
            contentStyle={{
              background: isDark ? '#1b1a21' : '#ffffff',
              border: `1px solid ${isDark ? '#302e38' : '#e7e9ef'}`,
              borderRadius: 10,
              fontSize: 11,
              color: isDark ? '#f1eff6' : '#202334',
            }}
            formatter={(value) => [
              formatearMoneda(Number(value ?? 0), moneda),
              '',
            ]}
          />
          {proveedores.map((proveedor, indice) => {
            const color = obtenerColorProveedor(proveedor, indice)
            const claveSerie = `${proveedor}_${moneda}`
            return (
              <Area
                key={claveSerie}
                type="monotone"
                name={proveedor}
                dataKey={claveSerie}
                stroke={color}
                fill={indice === 0 ? `url(#fillPrice-${indice})` : 'transparent'}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            )
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function PerfumeWorkspace() {
  const [hidratado, setHidratado] = useState(false)
  const [view, setView] = useState<VistaActiva>('overview')
  const [isDark, setIsDark] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [historySupplierTab, setHistorySupplierTab] = useState<'GLOBAL' | string>(
    'GLOBAL',
  )

  // Estado de datos provenientes de Supabase
  const [filasCatalogo, setFilasCatalogo] = useState<FilaVistaComparador[]>([])
  const [mapaVariaciones, setMapaVariaciones] = useState<MapaVariacionesPrecios>(
    {},
  )
  const [cargandoCatalogo, setCargandoCatalogo] = useState(true)
  const [errorCatalogo, setErrorCatalogo] = useState<string | null>(null)
  const [usandoDemo, setUsandoDemo] = useState(false)

  // Paneles / modales de Inteligencia de Precios, Rentabilidad e Importador
  const [monitorTab, setMonitorTab] = useState<
    'arbitraje' | 'bajaron' | 'watchlist'
  >('arbitraje')
  const [modalRentabilidadAbierto, setModalRentabilidadAbierto] =
    useState(false)
  const [modalImportadorAbierto, setModalImportadorAbierto] = useState(false)
  const [actualizandoDolar, setActualizandoDolar] = useState(false)
  const [productoAlertaModal, setProductoAlertaModal] =
    useState<ProductoComparado | null>(null)

  // Filtros en memoria
  const [filtros, setFiltros] = useState<FiltrosCatalogo>(
    FILTROS_CATALOGO_INICIALES,
  )
  const [precioMinInput, setPrecioMinInput] = useState('')
  const [precioMaxInput, setPrecioMaxInput] = useState('')
  const [paginaCatalogo, setPaginaCatalogo] = useState(1)
  const [tamanoPaginaCatalogo, setTamanoPaginaCatalogo] = useState<number>(
    TAMANO_PAGINA_INICIAL,
  )

  // Historial
  const [productoHistorialId, setProductoHistorialId] = useState<number | null>(
    null,
  )
  const [datosHistorial, setDatosHistorial] = useState<PuntoHistorialGrafico[]>(
    [],
  )
  const [cargandoHistorial, setCargandoHistorial] = useState(false)

  // Edición de imagen (subida manual 1:1 optimizada / URL) y sincronización
  const [productoEditandoImagen, setProductoEditandoImagen] =
    useState<ProductoComparado | null>(null)
  const [modoEditorImagen, setModoEditorImagen] =
    useState<ModoEditorImagen>('upload')
  const [archivoInicialEditor, setArchivoInicialEditor] =
    useState<File | null>(null)
  const [sincronizandoFotos, setSincronizandoFotos] = useState(false)
  const [mensajeSyncFotos, setMensajeSyncFotos] = useState<string | null>(null)

  // Copiado de WhatsApp
  const [proveedorCopiado, setProveedorCopiado] = useState<string | null>(null)

  // Stores de Zustand con persistencia en localStorage
  const dolarDelDiaStore = useConfiguracionStore((estado) => estado.dolarDelDia)
  const tipoDolarActivoStore = useConfiguracionStore(
    (estado) => estado.tipoDolarActivo,
  )
  const cotizacionesDolarStore = useConfiguracionStore(
    (estado) => estado.cotizacionesDolar,
  )
  const monedaVisualizacionStore = useConfiguracionStore(
    (estado) => estado.monedaVisualizacion,
  )
  const margenGeneralStore = useConfiguracionStore(
    (estado) => estado.margenGeneralPorcentaje,
  )
  const margenPorTipoStore = useConfiguracionStore(
    (estado) => estado.margenPorTipo,
  )
  const comisionPlataformaStore = useConfiguracionStore(
    (estado) => estado.comisionPlataformaPorcentaje,
  )
  const costoFijoStore = useConfiguracionStore(
    (estado) => estado.costoFijoEnvioEmbalajeARS,
  )
  const costoEnvioUSDStore = useConfiguracionStore(
    (estado) => estado.costoEnvioPorPerfumeUSD,
  )
  const gananciaFijaARSStore = useConfiguracionStore(
    (estado) => estado.gananciaFijaAdicionalARS,
  )
  const preciosVentaManualesStore = useConfiguracionStore(
    (estado) => estado.preciosVentaManualesARS,
  )
  const mostrarRentabilidadStore = useConfiguracionStore(
    (estado) => estado.mostrarRentabilidadEnCatalogo,
  )
  const setDolarDelDia = useConfiguracionStore((estado) => estado.setDolarDelDia)
  const setTipoDolarActivo = useConfiguracionStore(
    (estado) => estado.setTipoDolarActivo,
  )
  const aplicarCotizacionAutomatica = useConfiguracionStore(
    (estado) => estado.aplicarCotizacionAutomatica,
  )
  const alternarMonedaVisualizacion = useConfiguracionStore(
    (estado) => estado.alternarMonedaVisualizacion,
  )
  const setMargenGeneralPorcentaje = useConfiguracionStore(
    (estado) => estado.setMargenGeneralPorcentaje,
  )
  const setMargenPorTipo = useConfiguracionStore(
    (estado) => estado.setMargenPorTipo,
  )
  const setComisionPlataformaPorcentaje = useConfiguracionStore(
    (estado) => estado.setComisionPlataformaPorcentaje,
  )
  const setCostoFijoEnvioEmbalajeARS = useConfiguracionStore(
    (estado) => estado.setCostoFijoEnvioEmbalajeARS,
  )
  const setCostoEnvioPorPerfumeUSD = useConfiguracionStore(
    (estado) => estado.setCostoEnvioPorPerfumeUSD,
  )
  const setGananciaFijaAdicionalARS = useConfiguracionStore(
    (estado) => estado.setGananciaFijaAdicionalARS,
  )
  const setPrecioVentaManualProducto = useConfiguracionStore(
    (estado) => estado.setPrecioVentaManualProducto,
  )
  const sincronizarPreciosManualesDesdeCatalogo = useConfiguracionStore(
    (estado) => estado.sincronizarPreciosManualesDesdeCatalogo,
  )
  const setMostrarRentabilidadEnCatalogo = useConfiguracionStore(
    (estado) => estado.setMostrarRentabilidadEnCatalogo,
  )
  const restaurarRentabilidadPorDefecto = useConfiguracionStore(
    (estado) => estado.restaurarRentabilidadPorDefecto,
  )

  const itemsWatchlistStore = useWatchlistStore((estado) => estado.items)
  const guardarAlertaProducto = useWatchlistStore(
    (estado) => estado.guardarAlertaProducto,
  )
  const quitarSeguimiento = useWatchlistStore(
    (estado) => estado.quitarSeguimiento,
  )
  const vaciarWatchlist = useWatchlistStore((estado) => estado.vaciarWatchlist)

  const registrosStockStore = useStockPropioStore((estado) => estado.registros)
  const setStockProducto = useStockPropioStore(
    (estado) => estado.setStockProducto,
  )
  const ajustarStockProducto = useStockPropioStore(
    (estado) => estado.ajustarStockProducto,
  )
  const setStockMinimoProducto = useStockPropioStore(
    (estado) => estado.setStockMinimoProducto,
  )
  const quitarStockProducto = useStockPropioStore(
    (estado) => estado.quitarStockProducto,
  )

  const itemsCarritoStore = useCarritoStore((estado) => estado.items)
  const escalasPorProveedorStore = useCarritoStore(
    (estado) => estado.escalaForzadaPorProveedor,
  )
  const agregarItem = useCarritoStore((estado) => estado.agregarItem)
  const incrementarCantidad = useCarritoStore(
    (estado) => estado.incrementarCantidad,
  )
  const quitarItem = useCarritoStore((estado) => estado.quitarItem)
  const vaciarCarrito = useCarritoStore((estado) => estado.vaciarCarrito)
  const setEscalaProveedor = useCarritoStore((estado) => estado.setEscalaProveedor)
  const sincronizarPreciosDesdeCatalogo = useCarritoStore(
    (estado) => estado.sincronizarPreciosDesdeCatalogo,
  )
  const generarMensajeWhatsApp = useCarritoStore(
    (estado) => estado.generarMensajeWhatsApp,
  )
  const generarTodosLosMensajes = useCarritoStore(
    (estado) => estado.generarTodosLosMensajes,
  )

  useEffect(() => {
    setHidratado(true)
  }, [])

  const dolarDelDia = hidratado ? dolarDelDiaStore : 1400
  const tipoDolarActivo: TipoCotizacionDolar = hidratado
    ? tipoDolarActivoStore
    : 'manual'
  const cotizacionesDolar: CotizacionesDolarDia = hidratado
    ? cotizacionesDolarStore
    : COTIZACIONES_DOLAR_INICIALES
  const monedaVisualizacion: Moneda = hidratado ? monedaVisualizacionStore : 'USD'
  const itemsCarrito = hidratado ? itemsCarritoStore : []
  const escalasPorProveedor = hidratado ? escalasPorProveedorStore : {}
  const itemsWatchlist: Record<number, ItemWatchlist> = useMemo(
    () => (hidratado ? itemsWatchlistStore : {}),
    [hidratado, itemsWatchlistStore],
  )
  const registrosStockPropio: Record<number, RegistroStockPropio> = useMemo(
    () => (hidratado ? registrosStockStore : {}),
    [hidratado, registrosStockStore],
  )
  const configRentabilidad: ConfiguracionRentabilidad = useMemo(() => {
    if (!hidratado) return CONFIG_RENTABILIDAD_INICIAL
    return {
      margenGeneralPorcentaje: margenGeneralStore,
      margenPorTipo: margenPorTipoStore,
      comisionPlataformaPorcentaje: comisionPlataformaStore,
      costoFijoEnvioEmbalajeARS: costoFijoStore,
      costoEnvioPorPerfumeUSD: costoEnvioUSDStore,
      gananciaFijaAdicionalARS: gananciaFijaARSStore,
      preciosVentaManualesARS: preciosVentaManualesStore ?? {},
      mostrarRentabilidadEnCatalogo: mostrarRentabilidadStore,
    }
  }, [
    hidratado,
    margenGeneralStore,
    margenPorTipoStore,
    comisionPlataformaStore,
    costoFijoStore,
    costoEnvioUSDStore,
    gananciaFijaARSStore,
    preciosVentaManualesStore,
    mostrarRentabilidadStore,
  ])

  const idsWatchlist = useMemo(
    () => new Set(Object.keys(itemsWatchlist).map(Number)),
    [itemsWatchlist],
  )

  const idsFaltaReponer = useMemo(() => {
    const ids = new Set<number>()
    for (const registro of Object.values(registrosStockPropio)) {
      if (necesitaReposicion(registro)) {
        ids.add(registro.productoId)
      }
    }
    return ids
  }, [registrosStockPropio])

  // Carga completa paginada desde vista_comparador en Supabase
  const cargarCatalogo = useCallback(async () => {
    setCargandoCatalogo(true)
    setErrorCatalogo(null)

    if (!estaSupabaseConfigurado()) {
      setFilasCatalogo(FILAS_DEMO_RESPALDO)
      setMapaVariaciones(generarVariacionesRespaldo(FILAS_DEMO_RESPALDO))
      setUsandoDemo(true)
      setCargandoCatalogo(false)
      return
    }

    try {
      const filas = await obtenerTodoElCatalogo()
      setFilasCatalogo(filas)
      setUsandoDemo(false)

      const mapaManualesDB: Record<number, number> = {}
      for (const f of filas) {
        if (
          f.precio_venta_manual_ars !== null &&
          f.precio_venta_manual_ars !== undefined &&
          Number(f.precio_venta_manual_ars) > 0
        ) {
          mapaManualesDB[f.producto_id] = Math.round(
            Number(f.precio_venta_manual_ars),
          )
        }
      }
      if (Object.keys(mapaManualesDB).length > 0) {
        sincronizarPreciosManualesDesdeCatalogo(mapaManualesDB)
      }

      try {
        const variaciones = await obtenerMapaVariacionesPrecios(filas)
        setMapaVariaciones(variaciones)
      } catch {
        setMapaVariaciones({})
      }
    } catch (error) {
      setErrorCatalogo(
        error instanceof Error
          ? error.message
          : 'No se pudo cargar el catálogo desde Supabase.',
      )
      setFilasCatalogo(FILAS_DEMO_RESPALDO)
      setMapaVariaciones(generarVariacionesRespaldo(FILAS_DEMO_RESPALDO))
      setUsandoDemo(true)
    } finally {
      setCargandoCatalogo(false)
    }
  }, [sincronizarPreciosManualesDesdeCatalogo])

  useEffect(() => {
    void cargarCatalogo()
  }, [cargarCatalogo])

  // Sincronizamos el rango ingresado según la moneda visualizada hacia rangoPrecioARS
  useEffect(() => {
    const convertirAARS = (valorTexto: string): number | null => {
      if (!valorTexto.trim()) return null
      const numero = Number(valorTexto)
      if (!Number.isFinite(numero) || numero < 0) return null
      return monedaVisualizacion === 'USD' ? numero * dolarDelDia : numero
    }

    setFiltros((previo) => ({
      ...previo,
      rangoPrecioARS: [
        convertirAARS(precioMinInput),
        convertirAARS(precioMaxInput),
      ],
    }))
  }, [precioMinInput, precioMaxInput, monedaVisualizacion, dolarDelDia])

  // Catálogo base global sin filtrar para KPIs, conteos de sidebar, oportunidades y sync de carrito
  const {
    productos: productosGlobales,
    totalSinFiltrar,
    proveedoresDisponibles,
    marcasDisponibles,
    tiposDisponibles,
  } = useCatalogoPerfumes(filasCatalogo, dolarDelDia, FILTROS_CATALOGO_INICIALES, {
    mapaVariaciones,
    configRentabilidad,
  })

  const mapaProductosGlobales = useMemo(
    () => new Map(productosGlobales.map((p) => [p.producto_id, p])),
    [productosGlobales],
  )

  const alertasWatchlistEvaluadas = useMemo(
    () => evaluarAlertasWatchlist(itemsWatchlist, productosGlobales, dolarDelDia),
    [itemsWatchlist, productosGlobales, dolarDelDia],
  )

  const alertasPorProductoId = useMemo(
    () =>
      new Map<number, AlertaWatchlistEvaluada>(
        alertasWatchlistEvaluadas.map((alerta) => [
          alerta.item.productoId,
          alerta,
        ]),
      ),
    [alertasWatchlistEvaluadas],
  )

  const idsAlertasActivas = useMemo(
    () =>
      new Set(
        alertasWatchlistEvaluadas
          .filter((alerta) => alerta.tieneAlertaActiva)
          .map((alerta) => alerta.item.productoId),
      ),
    [alertasWatchlistEvaluadas],
  )

  // Catálogo filtrado según los controles activos
  const { productos: productosVisibles } = useCatalogoPerfumes(
    filasCatalogo,
    dolarDelDia,
    filtros,
    {
      mapaVariaciones,
      idsWatchlist,
      idsAlertasActivas,
      idsFaltaReponer,
      configRentabilidad,
    },
  )

  // Reiniciar paginación al cambiar resultados filtrados
  useEffect(() => {
    setPaginaCatalogo(1)
  }, [productosVisibles])

  // Mantener actualizados los precios del carrito desde el catálogo completo
  useEffect(() => {
    if (hidratado && productosGlobales.length > 0) {
      sincronizarPreciosDesdeCatalogo(productosGlobales)
    }
  }, [hidratado, productosGlobales, sincronizarPreciosDesdeCatalogo])

  // Métricas globales del resumen e inteligencia de precios
  const metricasGlobales = useMemo(() => {
    const conteoStockPorProveedor: Record<string, number> = {}
    for (const proveedor of proveedoresDisponibles) {
      conteoStockPorProveedor[proveedor] = 0
    }

    let ofertasDisponiblesCount = 0
    let mejorOfertaARS: number | null = null
    let mejorOfertaUSD: number | null = null
    const productosConStock: ProductoComparado[] = []

    let bajaronCount = 0
    let subieronCount = 0
    let arbitrajeCount = 0
    let faltaReponerCount = 0

    for (const prod of productosGlobales) {
      if (prod.tieneStockDisponible) {
        productosConStock.push(prod)
      }
      if ((prod.menorVariacionPorcentaje ?? 0) < -0.1) bajaronCount += 1
      if ((prod.mayorSubaPorcentaje ?? 0) > 0.1) subieronCount += 1
      if ((prod.brechaArbitrajePorcentaje ?? 0) >= 5) arbitrajeCount += 1
      if (idsFaltaReponer.has(prod.producto_id)) faltaReponerCount += 1

      for (const oferta of Object.values(prod.ofertas)) {
        if (!oferta.disponible) continue
        ofertasDisponiblesCount += 1
        conteoStockPorProveedor[oferta.proveedor] =
          (conteoStockPorProveedor[oferta.proveedor] ?? 0) + 1

        if (
          oferta.precioBaseEnARS !== null &&
          (mejorOfertaARS === null || oferta.precioBaseEnARS < mejorOfertaARS)
        ) {
          mejorOfertaARS = oferta.precioBaseEnARS
          mejorOfertaUSD = oferta.precioBaseEnUSD
        }
      }
    }

    const totalSlots = Math.max(
      1,
      productosGlobales.length * Math.max(1, proveedoresDisponibles.length),
    )
    const porcentajeConStock = Math.round(
      (ofertasDisponiblesCount / totalSlots) * 100,
    )

    const oportunidades = productosConStock.slice(0, 4)

    const oportunidadesArbitraje = [...productosConStock]
      .filter((p) => (p.brechaArbitrajePorcentaje ?? 0) >= 2)
      .sort(
        (a, b) =>
          (b.brechaArbitrajePorcentaje ?? 0) -
          (a.brechaArbitrajePorcentaje ?? 0),
      )
      .slice(0, 5)

    const bajasRecientes = [...productosGlobales]
      .filter((p) => (p.menorVariacionPorcentaje ?? 0) < -0.1)
      .sort(
        (a, b) =>
          (a.menorVariacionPorcentaje ?? 0) -
          (b.menorVariacionPorcentaje ?? 0),
      )
      .slice(0, 5)

    return {
      conteoStockPorProveedor,
      ofertasDisponiblesCount,
      porcentajeConStock,
      mejorOfertaARS,
      mejorOfertaUSD,
      oportunidades,
      oportunidadesArbitraje,
      bajasRecientes,
      conteosInteligencia: {
        bajaron: bajaronCount,
        subieron: subieronCount,
        arbitraje: arbitrajeCount,
        seguimiento: idsWatchlist.size,
        alertasActivas: idsAlertasActivas.size,
        faltaReponer: faltaReponerCount,
      },
    }
  }, [
    productosGlobales,
    proveedoresDisponibles,
    idsWatchlist.size,
    idsAlertasActivas.size,
    idsFaltaReponer,
  ])

  const sincronizarDolarAutomatico = useCallback(
    async (tipoObjetivo?: Exclude<TipoCotizacionDolar, 'manual'>) => {
      if (actualizandoDolar) return
      setActualizandoDolar(true)
      const tipoUsar: Exclude<TipoCotizacionDolar, 'manual'> =
        tipoObjetivo ?? (tipoDolarActivo === 'manual' ? 'blue' : tipoDolarActivo)

      try {
        const respuesta = await fetch('/api/cotizacion/dolar')
        if (!respuesta.ok) {
          throw new Error('No se pudo obtener la cotización del dólar.')
        }
        const datos = (await respuesta.json()) as CotizacionesDolarDia
        aplicarCotizacionAutomatica(tipoUsar, datos)
        const valorAplicado = datos[tipoUsar]
        const nombreCasa =
          tipoUsar === 'blue'
            ? 'Blue'
            : tipoUsar === 'mep'
              ? 'MEP'
              : 'Oficial'
        if (valorAplicado) {
          setMensajeSyncFotos(
            `Cotización Dólar ${nombreCasa} actualizada: ARS ${Math.round(
              valorAplicado,
            ).toLocaleString('es-AR')} (${
              datos.fuente === 'en_vivo' ? 'en vivo' : 'respaldo'
            }).`,
          )
          setTimeout(() => setMensajeSyncFotos(null), 4000)
        }
      } catch {
        setErrorCatalogo('No se pudo consultar la cotización automática del dólar.')
      } finally {
        setActualizandoDolar(false)
      }
    },
    [actualizandoDolar, tipoDolarActivo, aplicarCotizacionAutomatica],
  )

  const manejarCambiarTipoDolar = (nuevoTipo: TipoCotizacionDolar) => {
    if (nuevoTipo === 'manual') {
      setTipoDolarActivo('manual')
      return
    }
    if (cotizacionesDolar[nuevoTipo]) {
      setTipoDolarActivo(nuevoTipo)
    }
    void sincronizarDolarAutomatico(nuevoTipo)
  }

  const agregarFaltantesAlCarrito = () => {
    let productosAgregados = 0
    let unidadesAgregadas = 0

    for (const prod of productosGlobales) {
      if (!idsFaltaReponer.has(prod.producto_id)) continue
      if (!prod.tieneStockDisponible || !prod.proveedorMasBarato) continue
      const oferta = prod.ofertas[prod.proveedorMasBarato]
      if (!oferta || !oferta.disponible || oferta.precioBase === null) continue

      const faltantes = Math.max(
        1,
        unidadesFaltantesReposicion(registrosStockPropio[prod.producto_id]),
      )

      agregarItem({
        productoId: prod.producto_id,
        proveedor: oferta.proveedor,
        cantidad: faltantes,
        marca: prod.marca,
        nombre: prod.nombre,
        concentracion: prod.concentracion,
        ml: prod.ml,
        imagenUrl: prod.imagen_url,
        moneda: oferta.moneda,
        precioBase: oferta.precioBase,
        precio12: oferta.precio12,
        precio24: oferta.precio24,
      })

      productosAgregados += 1
      unidadesAgregadas += faltantes
    }

    if (productosAgregados === 0) {
      setMensajeSyncFotos(
        'No hay productos pendientes de reposición con stock disponible en proveedores.',
      )
    } else {
      setMensajeSyncFotos(
        `Se agregaron ${unidadesAgregadas} unidades de ${productosAgregados} perfume(s) a reponer al carrito (mejor oferta).`,
      )
    }
    setTimeout(() => setMensajeSyncFotos(null), 5000)
  }

  const manejarAplicarImportacion = async (
    resumen: ResumenPrevisualizacionImportacion,
  ) => {
    const respuesta = await fetch('/api/listas/importar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proveedor: resumen.proveedor,
        moneda: resumen.moneda,
        items: resumen.items,
      }),
    })

    const datos = (await respuesta.json()) as {
      ok?: boolean
      modoDemo?: boolean
      error?: string
      idsAsignados?: Record<number, number>
    }

    if (!respuesta.ok) {
      throw new Error(datos.error ?? 'Error al importar la lista de precios.')
    }

    const { nuevasFilas, nuevasVariaciones } = aplicarImportacionEnMemoria(
      filasCatalogo,
      resumen,
      datos.idsAsignados,
    )

    setFilasCatalogo(nuevasFilas)
    setMapaVariaciones((prev) => ({ ...prev, ...nuevasVariaciones }))
    setModalImportadorAbierto(false)

    setMensajeSyncFotos(
      `Lista de ${resumen.proveedor} importada: ${resumen.items.length} ítems procesados (${resumen.conteoBajasPrecio} bajas, ${resumen.conteoSubasPrecio} subas, ${resumen.conteoNuevosProductos + resumen.conteoNuevasOfertas} nuevos).`,
    )
    setTimeout(() => setMensajeSyncFotos(null), 6000)
  }

  const manejarGuardarPrecioVentaManual = useCallback(
    async (producto: ProductoComparado, nuevoPrecioARS: number | null) => {
      const valorNormalizado =
        nuevoPrecioARS !== null &&
        Number.isFinite(nuevoPrecioARS) &&
        nuevoPrecioARS > 0
          ? Math.round(nuevoPrecioARS)
          : null

      setPrecioVentaManualProducto(producto.producto_id, valorNormalizado)
      setFilasCatalogo((previo) =>
        previo.map((fila) =>
          fila.producto_id === producto.producto_id
            ? { ...fila, precio_venta_manual_ars: valorNormalizado }
            : fila,
        ),
      )

      if (!usandoDemo && estaSupabaseConfigurado()) {
        try {
          await actualizarPrecioVentaManualProducto(
            producto.producto_id,
            valorNormalizado,
          )
        } catch (error) {
          setErrorCatalogo(
            error instanceof Error
              ? error.message
              : 'No se pudo sincronizar el precio manual en Supabase.',
          )
          return
        }
      }

      setMensajeSyncFotos(
        valorNormalizado !== null
          ? `Precio de venta manual fijado en ${formatearMoneda(
              valorNormalizado,
              'ARS',
            )} para ${producto.marca} ${producto.nombre}.`
          : `Precio de venta de ${producto.marca} ${producto.nombre} restaurado al cálculo automático.`,
      )
      setTimeout(() => setMensajeSyncFotos(null), 4000)
    },
    [setPrecioVentaManualProducto, usandoDemo],
  )

  const productoHistorialActivo = useMemo(() => {
    if (productosGlobales.length === 0) return undefined
    if (productoHistorialId !== null) {
      const encontrado = productosGlobales.find(
        (item) => item.producto_id === productoHistorialId,
      )
      if (encontrado) return encontrado
    }
    return metricasGlobales.oportunidades[0] ?? productosGlobales[0]
  }, [productosGlobales, productoHistorialId, metricasGlobales.oportunidades])

  useEffect(() => {
    let cancelado = false

    async function cargarHistorial() {
      if (
        (view !== 'overview' && view !== 'history') ||
        !productoHistorialActivo
      ) {
        return
      }

      if (usandoDemo || !estaSupabaseConfigurado()) {
        setDatosHistorial(
          construirHistorialDemo(productoHistorialActivo, dolarDelDia),
        )
        return
      }

      setCargandoHistorial(true)
      try {
        const puntos = await obtenerHistorialPorProducto(
          productoHistorialActivo.producto_id,
          dolarDelDia,
        )
        if (!cancelado) {
          setDatosHistorial(puntos)
        }
      } catch {
        if (!cancelado) {
          setDatosHistorial([])
        }
      } finally {
        if (!cancelado) {
          setCargandoHistorial(false)
        }
      }
    }

    void cargarHistorial()
    return () => {
      cancelado = true
    }
  }, [view, productoHistorialActivo, dolarDelDia, usandoDemo])

  const proveedoresEnHistorial = useMemo(() => {
    const sufijo = monedaVisualizacion === 'USD' ? '_USD' : '_ARS'
    const claves = new Set<string>()
    for (const punto of datosHistorial) {
      for (const clave of Object.keys(punto)) {
        if (clave.endsWith(sufijo)) {
          claves.add(clave.slice(0, -sufijo.length))
        }
      }
    }
    return Array.from(claves)
  }, [datosHistorial, monedaVisualizacion])

  const proveedoresGraficoHistorial = useMemo(() => {
    if (historySupplierTab === 'GLOBAL') return proveedoresEnHistorial
    return proveedoresEnHistorial.filter((p) => p === historySupplierTab)
  }, [proveedoresEnHistorial, historySupplierTab])

  const estadisticasHistorial = useMemo(() => {
    const sufijo = monedaVisualizacion === 'USD' ? '_USD' : '_ARS'
    const candidatos: Array<{
      valor: number
      proveedor: string
      fecha: string
    }> = []

    const porProveedor: Record<
      string,
      {
        piso: { valor: number; fecha: string } | null
        techo: { valor: number; fecha: string } | null
      }
    > = {}

    const registrarCandidato = (
      proveedor: string,
      valor: number,
      fecha: string,
    ) => {
      if (!Number.isFinite(valor) || valor <= 0) return
      candidatos.push({ valor, proveedor, fecha })
      const actual = porProveedor[proveedor] ?? { piso: null, techo: null }
      if (!actual.piso || valor < actual.piso.valor) {
        actual.piso = { valor, fecha }
      }
      if (!actual.techo || valor > actual.techo.valor) {
        actual.techo = { valor, fecha }
      }
      porProveedor[proveedor] = actual
    }

    for (const punto of datosHistorial) {
      const fechaPunto = String(punto.fecha ?? 'Histórico')
      for (const [clave, valorBruto] of Object.entries(punto)) {
        if (clave.endsWith(sufijo)) {
          const proveedor = clave.slice(0, -sufijo.length)
          registrarCandidato(proveedor, Number(valorBruto), fechaPunto)
        }
      }
    }

    if (productoHistorialActivo) {
      for (const [proveedor, oferta] of Object.entries(
        productoHistorialActivo.ofertas,
      )) {
        const precioActual =
          monedaVisualizacion === 'USD'
            ? oferta.precioBaseEnUSD
            : oferta.precioBaseEnARS
        if (precioActual !== null && precioActual !== undefined) {
          registrarCandidato(
            proveedor,
            precioActual,
            oferta.updatedAt ? oferta.updatedAt.slice(0, 10) : 'Actual',
          )
        }
        if (
          oferta.precioAnterior !== null &&
          oferta.precioAnterior !== undefined &&
          oferta.precioAnterior > 0
        ) {
          const precioAnteriorConvertido =
            oferta.moneda === monedaVisualizacion
              ? oferta.precioAnterior
              : monedaVisualizacion === 'USD'
                ? oferta.precioAnterior / dolarDelDia
                : oferta.precioAnterior * dolarDelDia
          registrarCandidato(
            proveedor,
            precioAnteriorConvertido,
            oferta.fechaPrecioAnterior ?? 'Lista anterior',
          )
        }
      }
    }

    let pisoGlobal: { valor: number; proveedor: string; fecha: string } | null =
      null
    let techoGlobal: {
      valor: number
      proveedor: string
      fecha: string
    } | null = null

    for (const cand of candidatos) {
      if (!pisoGlobal || cand.valor < pisoGlobal.valor) {
        pisoGlobal = cand
      }
      if (!techoGlobal || cand.valor > techoGlobal.valor) {
        techoGlobal = cand
      }
    }

    return {
      pisoGlobal,
      techoGlobal,
      porProveedor,
    }
  }, [
    datosHistorial,
    monedaVisualizacion,
    productoHistorialActivo,
    dolarDelDia,
  ])

  const resumenesCarrito = useMemo(
    () =>
      calcularResumenesPorProveedor(
        itemsCarrito,
        escalasPorProveedor,
        dolarDelDia,
      ),
    [itemsCarrito, escalasPorProveedor, dolarDelDia],
  )

  const totalUnidadesCarrito = useMemo(
    () => itemsCarrito.reduce((acum, item) => acum + item.cantidad, 0),
    [itemsCarrito],
  )

  const totalGeneralUSD = useMemo(
    () => resumenesCarrito.reduce((acum, r) => acum + r.totalEnUSD, 0),
    [resumenesCarrito],
  )

  const totalGeneralARS = useMemo(
    () => resumenesCarrito.reduce((acum, r) => acum + r.totalEnARS, 0),
    [resumenesCarrito],
  )

  const rentabilidadCarrito = useMemo(() => {
    let ventaTotalARS = 0
    let ventaTotalUSD = 0
    let gananciaNetaTotalARS = 0
    let gananciaNetaTotalUSD = 0
    let costoTotalConGastosARS = 0
    let ahorroEscalasARS = 0

    for (const resumen of resumenesCarrito) {
      for (const item of resumen.items) {
        const prodCatalogo = mapaProductosGlobales.get(item.productoId)
        const tipoProducto = prodCatalogo?.tipo ?? 'Perfume'
        const mlProducto = item.ml ?? prodCatalogo?.ml ?? null
        const costoUnitarioARS =
          item.cantidad > 0 ? item.subtotalARS / item.cantidad : 0
        const costoUnitarioUSD =
          item.cantidad > 0 ? item.subtotalUSD / item.cantidad : 0

        const calc = calcularRentabilidadUnitaria({
          productoId: item.productoId,
          costoARS: costoUnitarioARS,
          costoUSD: costoUnitarioUSD,
          ml: mlProducto,
          tipo: tipoProducto,
          dolarDelDia,
          config: configRentabilidad,
          precioVentaManualARS: prodCatalogo?.precioVentaManualARS,
        })

        ventaTotalARS += calc.precioVentaSugeridoARS * item.cantidad
        ventaTotalUSD += calc.precioVentaSugeridoUSD * item.cantidad
        gananciaNetaTotalARS += calc.gananciaNetaARS * item.cantidad
        gananciaNetaTotalUSD += calc.gananciaNetaUSD * item.cantidad
        costoTotalConGastosARS += calc.costoTotalARS * item.cantidad

        const ahorroItemARS =
          item.moneda === 'ARS' ? item.ahorroTotal : item.ahorroTotal * dolarDelDia
        ahorroEscalasARS += ahorroItemARS
      }
    }

    const roiPromedio =
      costoTotalConGastosARS > 0
        ? (gananciaNetaTotalARS / costoTotalConGastosARS) * 100
        : 0

    return {
      ventaTotalARS,
      ventaTotalUSD,
      gananciaNetaTotalARS,
      gananciaNetaTotalUSD,
      costoTotalConGastosARS,
      ahorroEscalasARS,
      ahorroEscalasUSD: dolarDelDia > 0 ? ahorroEscalasARS / dolarDelDia : 0,
      roiPromedio,
    }
  }, [resumenesCarrito, mapaProductosGlobales, dolarDelDia, configRentabilidad])

  const manejarAgregarAlCarrito = (
    producto: ProductoComparado,
    oferta: OfertaProveedor,
  ) => {
    if (!oferta.disponible || oferta.precioBase === null) return

    agregarItem({
      productoId: producto.producto_id,
      proveedor: oferta.proveedor,
      cantidad: 1,
      marca: producto.marca,
      nombre: producto.nombre,
      concentracion: producto.concentracion,
      ml: producto.ml,
      imagenUrl: producto.imagen_url,
      moneda: oferta.moneda,
      precioBase: oferta.precioBase,
      precio12: oferta.precio12,
      precio24: oferta.precio24,
    })
  }

  const copiarMensajeProveedor = async (proveedor: string) => {
    const mensaje = generarMensajeWhatsApp(proveedor, dolarDelDia)
    if (!mensaje) return
    try {
      await navigator.clipboard.writeText(mensaje)
      setProveedorCopiado(proveedor)
      setTimeout(() => setProveedorCopiado(null), 2000)
    } catch {
      setProveedorCopiado(null)
    }
  }

  const copiarTodosLosPedidos = async () => {
    const mensajes = generarTodosLosMensajes(dolarDelDia)
    const textoUnificado = Object.entries(mensajes)
      .map(
        ([proveedor, texto]) =>
          `=== PEDIDO ${proveedor.toUpperCase()} ===\n${texto}`,
      )
      .join('\n\n')

    if (!textoUnificado) return
    try {
      await navigator.clipboard.writeText(textoUnificado)
      setProveedorCopiado('TODOS')
      setTimeout(() => setProveedorCopiado(null), 2000)
    } catch {
      setProveedorCopiado(null)
    }
  }

  const manejarSincronizarFotos = async () => {
    if (sincronizandoFotos) return
    setSincronizandoFotos(true)
    setMensajeSyncFotos(null)

    try {
      const respuesta = await fetch('/api/imagenes/sincronizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limite: 20 }),
      })
      const datos = (await respuesta.json()) as Partial<ResultadoSincronizacionImagenes> & {
        error?: string
      }

      if (!respuesta.ok) {
        setMensajeSyncFotos(datos.error ?? 'Error al sincronizar fotos.')
      } else {
        setMensajeSyncFotos(
          datos.mensaje ?? `Actualizados: ${datos.actualizados ?? 0}`,
        )
        if ((datos.actualizados ?? 0) > 0) {
          await cargarCatalogo()
        }
      }
    } catch {
      setMensajeSyncFotos('No se pudo conectar con el servicio de imágenes.')
    } finally {
      setSincronizandoFotos(false)
      setTimeout(() => setMensajeSyncFotos(null), 5000)
    }
  }

  const abrirEditorImagen = useCallback(
    (
      producto: ProductoComparado,
      modo: ModoEditorImagen = 'upload',
      archivo: File | null = null,
    ) => {
      setProductoEditandoImagen(producto)
      setModoEditorImagen(modo)
      setArchivoInicialEditor(archivo)
    },
    [],
  )

  const aplicarImagenEnCatalogoLocal = useCallback(
    (productoId: number, urlFinal: string) => {
      setFilasCatalogo((previo) =>
        previo.map((fila) =>
          fila.producto_id === productoId
            ? { ...fila, imagen_url: urlFinal }
            : fila,
        ),
      )
    },
    [],
  )

  const manejarGuardarUrlManual = async (nuevaUrl: string) => {
    if (!productoEditandoImagen || !nuevaUrl.trim()) return
    const urlLimpia = nuevaUrl.trim()

    if (!usandoDemo && estaSupabaseConfigurado()) {
      await actualizarImagenProducto(
        productoEditandoImagen.producto_id,
        urlLimpia,
      )
    }

    aplicarImagenEnCatalogoLocal(productoEditandoImagen.producto_id, urlLimpia)
    setMensajeSyncFotos(
      `Enlace de imagen actualizado para ${productoEditandoImagen.marca} ${productoEditandoImagen.nombre}.`,
    )
    setTimeout(() => setMensajeSyncFotos(null), 4000)
  }

  const manejarGuardarArchivoOptimizado = async (
    blobOptimizado: Blob,
    dataUrlRespaldo: string,
  ) => {
    if (!productoEditandoImagen) return

    let urlFinal = dataUrlRespaldo
    if (!usandoDemo && estaSupabaseConfigurado()) {
      urlFinal = await subirImagenProductoOptimizada(
        productoEditandoImagen.producto_id,
        blobOptimizado,
        `perfume-${productoEditandoImagen.producto_id}.webp`,
      )
    }

    aplicarImagenEnCatalogoLocal(productoEditandoImagen.producto_id, urlFinal)
    setMensajeSyncFotos(
      `Imagen 1:1 optimizada y guardada para ${productoEditandoImagen.marca} ${productoEditandoImagen.nombre}.`,
    )
    setTimeout(() => setMensajeSyncFotos(null), 4000)
  }

  const alternarMarcaFiltro = (marca: string) => {
    setFiltros((previo) => {
      const existe = previo.marcasSeleccionadas.includes(marca)
      return {
        ...previo,
        marcasSeleccionadas: existe
          ? previo.marcasSeleccionadas.filter((m) => m !== marca)
          : [...previo.marcasSeleccionadas, marca],
      }
    })
  }

  const filtrarPorMarcaEnTabla = useCallback((marca: string) => {
    setFiltros((previo) => ({
      ...FILTROS_CATALOGO_INICIALES,
      pestanaActiva: previo.pestanaActiva,
      marcasSeleccionadas: [marca],
    }))
    setPrecioMinInput('')
    setPrecioMaxInput('')
    setPaginaCatalogo(1)
    setView('catalog')
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [])

  const abrirDetallePerfume = useCallback((item: ProductoComparado) => {
    setProductoHistorialId(item.producto_id)
    setHistorySupplierTab('GLOBAL')
    setView('history')
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [])

  const limpiarTodosLosFiltros = () => {
    setFiltros(FILTROS_CATALOGO_INICIALES)
    setPrecioMinInput('')
    setPrecioMaxInput('')
  }

  const cantidadFiltrosActivos =
    filtros.marcasSeleccionadas.length +
    filtros.tiposSeleccionados.length +
    (filtros.genero ? 1 : 0) +
    (filtros.soloEnStock ? 1 : 0) +
    (filtros.filtroInteligencia !== 'TODOS' ? 1 : 0) +
    (precioMinInput.trim() ? 1 : 0) +
    (precioMaxInput.trim() ? 1 : 0)

  const navItems: Array<{
    id: VistaActiva
    label: string
    icon: typeof LayoutDashboard
    count?: number
  }> = [
    { id: 'overview', label: 'Resumen', icon: LayoutDashboard },
    { id: 'catalog', label: 'Catálogo', icon: Package },
    { id: 'history', label: 'Historial de precios', icon: Activity },
    {
      id: 'cart',
      label: 'Carrito de compra',
      icon: ShoppingBag,
      count: totalUnidadesCarrito,
    },
  ]

  const fechaCabecera = useMemo(() => {
    if (!hidratado) return 'Panel mayorista'
    const texto = new Intl.DateTimeFormat('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date())
    return texto.charAt(0).toUpperCase() + texto.slice(1)
  }, [hidratado])

  const mejorPrecioGlobalMostrado =
    monedaVisualizacion === 'USD'
      ? metricasGlobales.mejorOfertaUSD
      : metricasGlobales.mejorOfertaARS

  const mapIndicesProveedores = useMemo(() => {
    const mapa = new Map<string, number>()
    proveedoresDisponibles.forEach((p, idx) => mapa.set(p, idx))
    return mapa
  }, [proveedoresDisponibles])

  return (
    <main
      className={`dashboard-shell min-h-screen bg-[#f7f8fa] text-slate-900 ${
        isDark ? 'dashboard-dark' : ''
      }`}
    >
      <aside className="dashboard-sidebar flex w-full shrink-0 flex-col border-b border-slate-200 bg-white px-4 py-4 lg:fixed lg:inset-y-0 lg:left-0 lg:w-[248px] lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
        <button
          type="button"
          onClick={() => setView('overview')}
          className="mb-5 flex items-center gap-3 px-1 text-left lg:mb-9"
          aria-label="PerfumeHub, ir al resumen"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#29233e] text-sm font-bold text-white">
            P<span className="text-violet-300">.</span>
          </span>
          <span>
            <span className="block text-[15px] font-semibold tracking-[-.03em] text-slate-900">
              PerfumeHub
            </span>
            <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[.13em] text-slate-400">
              Mayorista
            </span>
          </span>
        </button>

        <div className="mb-3 hidden px-2 text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400 lg:block">
          Workspace
        </div>

        <nav
          aria-label="Navegación principal"
          className="scrollbar-none flex gap-1 overflow-x-auto lg:flex-col"
        >
          {navItems.map((item) => {
            const Icon = item.icon
            const activo = view === item.id
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => setView(item.id)}
                aria-current={activo ? 'page' : undefined}
                className={`sidebar-link flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] transition ${
                  activo
                    ? 'sidebar-link-active font-semibold'
                    : 'font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon size={17} strokeWidth={1.8} />
                <span className="flex-1">{item.label}</span>
                {item.count ? (
                  <span className="flex size-[21px] items-center justify-center rounded-md bg-violet-100 text-[10px] font-semibold text-violet-700">
                    {item.count}
                  </span>
                ) : null}
              </button>
            )
          })}
        </nav>

        <div className="my-6 hidden border-t border-slate-100 lg:block" />

        <div className="mb-3 hidden px-2 text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400 lg:block">
          Proveedores
        </div>

        <div className="hidden max-h-[210px] flex-col gap-1 overflow-y-auto lg:flex">
          {proveedoresDisponibles.map((nombre, indice) => {
            const activo =
              view === 'catalog' && filtros.pestanaActiva === nombre
            return (
              <button
                type="button"
                key={nombre}
                onClick={() => {
                  setFiltros((prev) => ({
                    ...prev,
                    pestanaActiva:
                      prev.pestanaActiva === nombre ? 'GLOBAL' : nombre,
                  }))
                  setView('catalog')
                }}
                className={`supplier-link flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[12px] font-medium transition ${
                  activo
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor: obtenerColorProveedor(nombre, indice),
                  }}
                />
                <span className="truncate">{nombre}</span>
                <span className="ml-auto text-[10px] text-slate-400">
                  {metricasGlobales.conteoStockPorProveedor[nombre] ?? 0}
                </span>
              </button>
            )
          })}
        </div>

        <div className="mt-auto hidden rounded-xl border border-slate-200 bg-[#faf9fc] p-3.5 lg:block">
          <div className="mb-2 flex items-center gap-2 text-violet-700">
            <Sparkles size={15} />
            <span className="text-[11px] font-semibold">
              Espacio de trabajo
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500">
            {usandoDemo
              ? 'Modo demo activo. Configurá .env.local para consultar Supabase.'
              : 'Conectado en vivo con las listas de precios en Supabase.'}
          </p>
          <div className="mt-3 flex flex-col gap-2 border-t border-slate-200/70 pt-3">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => void manejarSincronizarFotos()}
                disabled={sincronizandoFotos}
                className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-violet-700 hover:text-violet-900 disabled:opacity-50"
              >
                {sincronizandoFotos ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Sparkles size={12} />
                )}
                {sincronizandoFotos ? 'Sincronizando...' : 'Sincronizar fotos'}
              </button>
              <button
                type="button"
                onClick={() => void cargarCatalogo()}
                aria-label="Actualizar catálogo"
                title="Actualizar catálogo"
                className="text-slate-400 hover:text-slate-700"
              >
                <RefreshCw
                  size={13}
                  className={cargandoCatalogo ? 'animate-spin' : ''}
                />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setModalImportadorAbierto(true)}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[10px] font-semibold text-violet-700 transition hover:bg-violet-100"
            >
              <FileSpreadsheet size={12} />
              Importar lista (CSV / Excel)
            </button>
          </div>
        </div>

        <div className="mt-4 hidden items-center gap-2 border-t border-slate-100 pt-4 lg:flex">
          <div className="flex size-8 items-center justify-center rounded-full bg-violet-100 text-[11px] font-semibold text-violet-700">
            PH
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold text-slate-700">
              Cuenta mayorista
            </p>
            <p className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span
                className={`size-1.5 rounded-full ${
                  usandoDemo ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
              />
              {usandoDemo ? 'Modo Demo' : 'Supabase en vivo'}
            </p>
          </div>
          <Settings2 size={14} className="text-slate-400" />
        </div>
      </aside>

      <div className="dashboard-main min-w-0 lg:ml-[248px]">
        <header className="dashboard-topbar flex min-h-[66px] items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-7 lg:px-9">
          <div className="flex min-w-0 items-center gap-2 text-[12px]">
            <span className="hidden text-slate-400 sm:inline">PerfumeHub</span>
            <span className="hidden text-slate-300 sm:inline">/</span>
            <span className="truncate font-medium text-slate-700">
              {navItems.find((item) => item.id === view)?.label}
            </span>
            <span className="hidden items-center gap-1.5 rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500 md:inline-flex">
              <span
                className={`size-1.5 rounded-full ${
                  usandoDemo ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
              />
              {usandoDemo ? 'Demo' : 'En vivo'}
            </span>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-500">
              <span className="font-semibold text-emerald-600">$</span>
              <select
                aria-label="Fuente de cotización del dólar"
                value={tipoDolarActivo}
                onChange={(event) =>
                  manejarCambiarTipoDolar(
                    event.target.value as TipoCotizacionDolar,
                  )
                }
                className="bg-transparent text-[10px] font-semibold text-slate-600 outline-none"
              >
                <option value="manual">Manual</option>
                <option value="blue">Blue</option>
                <option value="mep">MEP</option>
                <option value="oficial">Oficial</option>
              </select>
              <input
                aria-label="Cotización del dólar"
                type="number"
                min="1"
                value={dolarDelDia}
                onChange={(event) => {
                  const valor = Number(event.target.value)
                  if (valor > 0) setDolarDelDia(valor)
                }}
                className="w-14 bg-transparent text-right text-[11px] font-semibold text-slate-700 outline-none"
              />
              <button
                type="button"
                onClick={() => void sincronizarDolarAutomatico()}
                disabled={actualizandoDolar}
                title={
                  cotizacionesDolar.updatedAt
                    ? `Actualizar dólar automático (Blue: ${cotizacionesDolar.blue ?? '—'} · MEP: ${cotizacionesDolar.mep ?? '—'} · Oficial: ${cotizacionesDolar.oficial ?? '—'})`
                    : 'Traer cotización actual del dólar (Blue / MEP / Oficial)'
                }
                aria-label="Actualizar cotización automática del dólar"
                className="ml-0.5 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-emerald-600 disabled:opacity-50"
              >
                <RefreshCw
                  size={11}
                  className={actualizandoDolar ? 'animate-spin text-emerald-600' : ''}
                />
              </button>
            </div>

            <button
              type="button"
              onClick={alternarMonedaVisualizacion}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] font-medium text-slate-600 transition hover:bg-slate-50"
              aria-label="Cambiar moneda de comparación"
            >
              <ArrowDownUp size={12} />
              <span>{monedaVisualizacion}</span>
            </button>

            <button
              type="button"
              onClick={() => setModalRentabilidadAbierto(true)}
              className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-2 text-[10px] font-semibold text-violet-700 transition hover:bg-violet-100"
              aria-label="Abrir configuración de margen y calculadora de reventa"
            >
              <Calculator size={12} />
              <span className="hidden sm:inline">
                Margen +{configRentabilidad.margenGeneralPorcentaje}% · Calculadora
              </span>
              <span className="sm:hidden">
                +{configRentabilidad.margenGeneralPorcentaje}%
              </span>
            </button>

            <button
              type="button"
              onClick={() => setModalImportadorAbierto(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] font-semibold text-slate-700 transition hover:bg-slate-50"
              aria-label="Importar lista de proveedor"
              title="Importar lista CSV, Excel o texto"
            >
              <Upload size={12} />
              <span className="hidden md:inline">Importar lista</span>
            </button>

            <button
              type="button"
              onClick={() => void manejarSincronizarFotos()}
              disabled={sincronizandoFotos}
              title="Sincronizar fotos faltantes"
              aria-label="Sincronizar fotos faltantes"
              className="icon-button hidden size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-50 sm:flex"
            >
              {sincronizandoFotos ? (
                <Loader2 size={15} className="animate-spin text-violet-600" />
              ) : (
                <Sparkles size={15} />
              )}
            </button>

            <button
              type="button"
              onClick={() => void cargarCatalogo()}
              title="Recargar catálogo"
              aria-label="Recargar catálogo"
              className="icon-button flex size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
            >
              <RefreshCw
                size={15}
                className={cargandoCatalogo ? 'animate-spin' : ''}
              />
            </button>

            <button
              type="button"
              onClick={() => setIsDark((value) => !value)}
              aria-label={
                isDark ? 'Activar modo claro' : 'Activar modo oscuro'
              }
              className="icon-button flex size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>

        <div className="mx-auto max-w-[1440px] px-4 pb-8 pt-6 sm:px-7 sm:pt-8 lg:px-9">
          {(mensajeSyncFotos || errorCatalogo) && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-[12px] text-violet-800">
              <span>{errorCatalogo ?? mensajeSyncFotos}</span>
              <button
                type="button"
                onClick={() => {
                  setMensajeSyncFotos(null)
                  setErrorCatalogo(null)
                }}
                className="rounded-md p-1 text-violet-700 hover:bg-violet-100"
                aria-label="Cerrar aviso"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-1.5 text-[11px] font-medium text-slate-400">
                {fechaCabecera}
              </p>
              <h1 className="text-[26px] font-semibold tracking-[-.045em] text-slate-900 sm:text-[30px]">
                {view === 'overview'
                  ? 'Resumen de compras'
                  : navItems.find((item) => item.id === view)?.label}
              </h1>
              <p className="mt-1.5 text-[13px] text-slate-500">
                {view === 'overview'
                  ? 'Una vista clara de tus precios mayoristas y proveedores.'
                  : view === 'catalog'
                    ? 'Compará disponibilidad y precios antes de armar tu pedido.'
                    : view === 'history'
                      ? 'Seguí la evolución histórica de los precios de referencia.'
                      : 'Revisá los productos elegidos, simulá escalas mayoristas y prepará tu pedido.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                if (view !== 'catalog') {
                  setView('catalog')
                  setFiltersOpen(true)
                } else {
                  setFiltersOpen((value) => !value)
                }
              }}
              className="primary-action inline-flex items-center gap-2 rounded-lg bg-[#34294d] px-3.5 py-2.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-[#45365f]"
            >
              <Filter size={14} />
              <span>
                {view === 'catalog' && filtersOpen
                  ? 'Ocultar filtros'
                  : 'Filtrar catálogo'}
              </span>
            </button>
          </div>

          {view === 'overview' && (
            <>
              <section
                aria-label="Indicadores principales"
                className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
              >
                <article className="stat-card rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-[12px] font-medium text-slate-500">
                      Productos en catálogo
                    </span>
                    <span className="flex size-8 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
                      <Package size={16} />
                    </span>
                  </div>
                  <div className="flex items-end justify-between">
                    <strong className="text-[25px] font-semibold tracking-[-.04em] text-slate-900">
                      {totalSinFiltrar}
                    </strong>
                    <span className="pb-1 text-[10px] font-medium text-emerald-600">
                      {marcasDisponibles.length} marcas
                    </span>
                  </div>
                </article>

                <article className="stat-card rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-[12px] font-medium text-slate-500">
                      Proveedores activos
                    </span>
                    <span className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                      <Users size={16} />
                    </span>
                  </div>
                  <div className="flex items-end justify-between">
                    <strong className="text-[25px] font-semibold tracking-[-.04em] text-slate-900">
                      {proveedoresDisponibles.length}
                    </strong>
                    <span className="pb-1 text-[10px] font-medium text-slate-400">
                      Listas conectadas
                    </span>
                  </div>
                </article>

                <article className="stat-card rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-[12px] font-medium text-slate-500">
                      Ofertas disponibles
                    </span>
                    <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                      <Activity size={16} />
                    </span>
                  </div>
                  <div className="flex items-end justify-between">
                    <strong className="text-[25px] font-semibold tracking-[-.04em] text-slate-900">
                      {metricasGlobales.ofertasDisponiblesCount}
                    </strong>
                    <span className="pb-1 text-[10px] font-medium text-emerald-600">
                      {metricasGlobales.porcentajeConStock}% con stock
                    </span>
                  </div>
                </article>

                <article className="stat-card rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-[12px] font-medium text-slate-500">
                      Mejor precio desde
                    </span>
                    <span className="flex size-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                      <Wallet size={16} />
                    </span>
                  </div>
                  <div className="flex items-end justify-between">
                    <strong className="text-[25px] font-semibold tracking-[-.04em] text-slate-900">
                      {mejorPrecioGlobalMostrado !== null
                        ? formatearMoneda(
                            mejorPrecioGlobalMostrado,
                            monedaVisualizacion,
                          )
                        : '—'}
                    </strong>
                    <span className="pb-1 text-[10px] font-medium text-slate-400">
                      por unidad
                    </span>
                  </div>
                </article>

                <button
                  type="button"
                  onClick={() => {
                    setFiltros((prev) => ({
                      ...prev,
                      filtroInteligencia:
                        metricasGlobales.conteosInteligencia.alertasActivas > 0
                          ? 'ALERTAS_ACTIVAS'
                          : 'BAJARON',
                    }))
                    setView('catalog')
                  }}
                  className="stat-card rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-violet-300"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-[12px] font-medium text-slate-500">
                      Inteligencia y alertas
                    </span>
                    <span className="flex size-8 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
                      {metricasGlobales.conteosInteligencia.alertasActivas > 0 ? (
                        <BellRing size={16} />
                      ) : (
                        <Zap size={16} />
                      )}
                    </span>
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <strong className="text-[25px] font-semibold tracking-[-.04em] text-slate-900">
                      {metricasGlobales.conteosInteligencia.bajaron}
                    </strong>
                    <span className="pb-1 text-right text-[10px] font-medium text-emerald-600">
                      bajas · {metricasGlobales.conteosInteligencia.alertasActivas}{' '}
                      alertas
                    </span>
                  </div>
                </button>
              </section>

              <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(310px,0.9fr)]">
                <article className="dashboard-card min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                  <SectionTitle
                    eyebrow="Tendencia de precios"
                    title="Evolución por proveedor"
                    detail={
                      productoHistorialActivo
                        ? `${productoHistorialActivo.marca} ${productoHistorialActivo.nombre} · ${monedaVisualizacion}`
                        : `Precio de referencia · ${monedaVisualizacion}`
                    }
                    action={
                      <button
                        type="button"
                        onClick={() => setView('history')}
                        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-violet-700 hover:text-violet-900"
                      >
                        Ver historial <ArrowRight size={13} />
                      </button>
                    }
                  />

                  <div className="mb-3 flex flex-wrap gap-4">
                    {proveedoresEnHistorial.map((nombre) => (
                      <span
                        key={nombre}
                        className="flex items-center gap-2 text-[11px] text-slate-500"
                      >
                        <span
                          className="size-2 rounded-full"
                          style={{
                            backgroundColor: obtenerColorProveedor(
                              nombre,
                              mapIndicesProveedores.get(nombre) ?? 0,
                            ),
                          }}
                        />
                        {nombre}
                      </span>
                    ))}
                  </div>

                  <GraficoEvolucionPrecios
                    datos={datosHistorial}
                    proveedores={proveedoresEnHistorial}
                    moneda={monedaVisualizacion}
                    isDark={isDark}
                    cargando={cargandoHistorial}
                  />
                </article>

                <article className="dashboard-card flex flex-col rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[.13em] text-violet-600">
                        Inteligencia
                      </p>
                      <h2 className="text-[16px] font-semibold tracking-[-.025em] text-slate-900">
                        Monitor de oportunidades
                      </h2>
                    </div>
                  </div>

                  <div
                    role="tablist"
                    aria-label="Vistas del monitor de oportunidades"
                    className="mb-3 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={monitorTab === 'arbitraje'}
                      onClick={() => setMonitorTab('arbitraje')}
                      className={`rounded-md px-2 py-1.5 text-[10px] font-semibold transition ${
                        monitorTab === 'arbitraje'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Arbitraje
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={monitorTab === 'bajaron'}
                      onClick={() => setMonitorTab('bajaron')}
                      className={`rounded-md px-2 py-1.5 text-[10px] font-semibold transition ${
                        monitorTab === 'bajaron'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Bajaron ({metricasGlobales.conteosInteligencia.bajaron})
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={monitorTab === 'watchlist'}
                      onClick={() => setMonitorTab('watchlist')}
                      className={`rounded-md px-2 py-1.5 text-[10px] font-semibold transition ${
                        monitorTab === 'watchlist'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Seguimiento ({idsAlertasActivas.size})
                    </button>
                  </div>

                  <div className="flex flex-1 flex-col divide-y divide-slate-100">
                    {monitorTab === 'arbitraje' &&
                      (metricasGlobales.oportunidadesArbitraje.length === 0 ? (
                        <p className="py-6 text-center text-[12px] text-slate-400">
                          Sin brechas de arbitraje significativas en este momento.
                        </p>
                      ) : (
                        metricasGlobales.oportunidadesArbitraje.map((item) => {
                          const mejorProveedor = item.proveedorMasBarato
                          const ofertaGanadora = mejorProveedor
                            ? item.ofertas[mejorProveedor]
                            : undefined
                          if (!ofertaGanadora) return null

                          const precioMostrado =
                            monedaVisualizacion === 'USD'
                              ? item.mejorPrecioUSD
                              : item.mejorPrecioARS
                          const ahorroMostrado =
                            monedaVisualizacion === 'USD'
                              ? item.ahorroArbitrajeUSD
                              : item.ahorroArbitrajeARS

                          return (
                            <div
                              key={item.producto_id}
                              className="flex items-center gap-2.5 py-2.5"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setProductoHistorialId(item.producto_id)
                                  setHistorySupplierTab('GLOBAL')
                                  setView('history')
                                }}
                                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1 py-1 text-left transition hover:bg-slate-50"
                              >
                                <ImagenFrasco
                                  src={item.imagen_url}
                                  alt={`${item.marca} ${item.nombre}`}
                                  className="size-9 shrink-0 rounded-lg"
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[11px] font-semibold text-slate-800">
                                    {item.nombre}
                                  </span>
                                  <span className="mt-0.5 block truncate text-[10px] text-slate-400">
                                    {mejorProveedor} vs{' '}
                                    {item.proveedorSegundoMasBarato}
                                  </span>
                                  {item.brechaArbitrajePorcentaje !== null && (
                                    <span className="mt-0.5 inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                                      -{item.brechaArbitrajePorcentaje.toFixed(1)}%
                                      {ahorroMostrado !== null &&
                                        ` · Ahorrás ${formatearMoneda(
                                          ahorroMostrado,
                                          monedaVisualizacion,
                                        )}`}
                                    </span>
                                  )}
                                </span>
                                <strong className="shrink-0 text-[12px] font-semibold text-slate-800">
                                  {precioMostrado !== null
                                    ? formatearMoneda(
                                        precioMostrado,
                                        monedaVisualizacion,
                                      )
                                    : '—'}
                                </strong>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  manejarAgregarAlCarrito(item, ofertaGanadora)
                                }
                                title={`Agregar oferta de ${mejorProveedor}`}
                                aria-label={`Agregar ${item.nombre} al carrito`}
                                className="row-action flex size-7 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:border-violet-300 hover:text-violet-700"
                              >
                                <Plus size={13} />
                              </button>
                            </div>
                          )
                        })
                      ))}

                    {monitorTab === 'bajaron' &&
                      (metricasGlobales.bajasRecientes.length === 0 ? (
                        <p className="py-6 text-center text-[12px] text-slate-400">
                          No hay bajas recientes registradas.
                        </p>
                      ) : (
                        metricasGlobales.bajasRecientes.map((item) => {
                          const precioMostrado =
                            monedaVisualizacion === 'USD'
                              ? item.mejorPrecioUSD
                              : item.mejorPrecioARS
                          const mejorOferta = item.proveedorMasBarato
                            ? item.ofertas[item.proveedorMasBarato]
                            : undefined

                          return (
                            <div
                              key={item.producto_id}
                              className="flex items-center gap-2.5 py-2.5"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setProductoHistorialId(item.producto_id)
                                  setHistorySupplierTab('GLOBAL')
                                  setView('history')
                                }}
                                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1 py-1 text-left transition hover:bg-slate-50"
                              >
                                <ImagenFrasco
                                  src={item.imagen_url}
                                  alt={`${item.marca} ${item.nombre}`}
                                  className="size-9 shrink-0 rounded-lg"
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[11px] font-semibold text-slate-800">
                                    {item.nombre}
                                  </span>
                                  <span className="mt-0.5 block truncate text-[10px] text-slate-400">
                                    {item.proveedorMasBarato ?? 'Sin stock'} ·{' '}
                                    {item.marca}
                                  </span>
                                </span>
                                <span className="text-right">
                                  <strong className="block text-[12px] font-semibold text-slate-800">
                                    {precioMostrado !== null
                                      ? formatearMoneda(
                                          precioMostrado,
                                          monedaVisualizacion,
                                        )
                                      : '—'}
                                  </strong>
                                  <span className="inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                                    ↓{' '}
                                    {Math.abs(
                                      item.menorVariacionPorcentaje ?? 0,
                                    ).toFixed(1)}
                                    %
                                  </span>
                                </span>
                              </button>
                              {mejorOferta && mejorOferta.disponible && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    manejarAgregarAlCarrito(item, mejorOferta)
                                  }
                                  title={`Agregar oferta de ${mejorOferta.proveedor}`}
                                  aria-label={`Agregar ${item.nombre} al carrito`}
                                  className="row-action flex size-7 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:border-violet-300 hover:text-violet-700"
                                >
                                  <Plus size={13} />
                                </button>
                              )}
                            </div>
                          )
                        })
                      ))}

                    {monitorTab === 'watchlist' &&
                      (alertasWatchlistEvaluadas.length === 0 ? (
                        <div className="py-6 text-center">
                          <p className="text-[12px] font-medium text-slate-600">
                            Sin perfumes en seguimiento
                          </p>
                          <p className="mt-1 text-[11px] text-slate-400">
                            Usá el botón ★ en el catálogo para definir un precio
                            objetivo o alertar stock.
                          </p>
                        </div>
                      ) : (
                        alertasWatchlistEvaluadas.slice(0, 5).map((alerta) => {
                          const { producto, item } = alerta
                          const precioMostrado =
                            monedaVisualizacion === 'USD'
                              ? producto.mejorPrecioUSD
                              : producto.mejorPrecioARS
                          const mejorOferta = producto.proveedorMasBarato
                            ? producto.ofertas[producto.proveedorMasBarato]
                            : undefined

                          return (
                            <div
                              key={producto.producto_id}
                              className="flex items-center gap-2.5 py-2.5"
                            >
                              <ImagenFrasco
                                src={producto.imagen_url}
                                alt={`${producto.marca} ${producto.nombre}`}
                                className="size-9 shrink-0 rounded-lg"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[11px] font-semibold text-slate-800">
                                  {producto.nombre}
                                </p>
                                <div className="mt-0.5 flex flex-wrap items-center gap-1">
                                  {alerta.cumplePrecioObjetivo && (
                                    <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                                      Objetivo cumplido
                                    </span>
                                  )}
                                  {alerta.cumpleBajaPrecio && (
                                    <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                                      Bajó{' '}
                                      {Math.abs(
                                        producto.menorVariacionPorcentaje ?? 0,
                                      ).toFixed(1)}
                                      %
                                    </span>
                                  )}
                                  {!alerta.cumplePrecioObjetivo &&
                                    !alerta.cumpleBajaPrecio && (
                                      <span
                                        className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${
                                          producto.tieneStockDisponible
                                            ? 'bg-violet-50 text-violet-700'
                                            : 'bg-slate-100 text-slate-500'
                                        }`}
                                      >
                                        {producto.tieneStockDisponible
                                          ? 'Disponible'
                                          : 'Sin stock'}
                                      </span>
                                    )}
                                  {item.precioObjetivo !== null && (
                                    <span className="text-[9px] text-slate-400">
                                      Obj:{' '}
                                      {formatearMoneda(
                                        item.precioObjetivo,
                                        item.monedaObjetivo,
                                      )}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <strong className="block text-[11px] font-semibold text-slate-800">
                                  {precioMostrado !== null
                                    ? formatearMoneda(
                                        precioMostrado,
                                        monedaVisualizacion,
                                      )
                                    : '—'}
                                </strong>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setProductoAlertaModal(producto)}
                                  title="Editar alerta"
                                  aria-label={`Editar alerta de ${producto.nombre}`}
                                  className="row-action flex size-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:border-violet-300 hover:text-violet-700"
                                >
                                  <Bell size={12} />
                                </button>
                                {mejorOferta && mejorOferta.disponible && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      manejarAgregarAlCarrito(
                                        producto,
                                        mejorOferta,
                                      )
                                    }
                                    title={`Agregar oferta de ${mejorOferta.proveedor}`}
                                    aria-label={`Agregar ${producto.nombre} al carrito`}
                                    className="row-action flex size-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:border-violet-300 hover:text-violet-700"
                                  >
                                    <Plus size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })
                      ))}
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFiltros((prev) => ({
                          ...prev,
                          filtroInteligencia:
                            monitorTab === 'arbitraje'
                              ? 'ARBITRAJE'
                              : monitorTab === 'bajaron'
                                ? 'BAJARON'
                                : 'SEGUIMIENTO',
                        }))
                        setView('catalog')
                      }}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50"
                    >
                      Ver todos en catálogo <ArrowRight size={13} />
                    </button>
                    {monitorTab === 'watchlist' &&
                      alertasWatchlistEvaluadas.length > 0 && (
                        <button
                          type="button"
                          onClick={vaciarWatchlist}
                          title="Vaciar lista de seguimiento"
                          className="rounded-lg border border-slate-200 px-3 py-2.5 text-[11px] font-medium text-rose-600 transition hover:bg-rose-50"
                        >
                          Limpiar
                        </button>
                      )}
                  </div>
                </article>
              </section>

              <CatalogSection
                productos={productosVisibles}
                totalSinFiltrar={totalSinFiltrar}
                proveedoresDisponibles={proveedoresDisponibles}
                marcasDisponibles={marcasDisponibles}
                tiposDisponibles={tiposDisponibles}
                filtros={filtros}
                setFiltros={setFiltros}
                precioMinInput={precioMinInput}
                setPrecioMinInput={setPrecioMinInput}
                precioMaxInput={precioMaxInput}
                setPrecioMaxInput={setPrecioMaxInput}
                onLimpiarFiltros={limpiarTodosLosFiltros}
                alternarMarcaFiltro={alternarMarcaFiltro}
                cantidadFiltrosActivos={cantidadFiltrosActivos}
                monedaVisualizacion={monedaVisualizacion}
                dolarDelDia={dolarDelDia}
                configRentabilidad={configRentabilidad}
                conteosInteligencia={metricasGlobales.conteosInteligencia}
                itemsWatchlist={itemsWatchlist}
                alertasPorProductoId={alertasPorProductoId}
                registrosStockPropio={registrosStockPropio}
                onAjustarStock={ajustarStockProducto}
                onSetStockProducto={setStockProducto}
                onSetStockMinimo={setStockMinimoProducto}
                onQuitarStock={quitarStockProducto}
                onAgregarFaltantesAlCarrito={agregarFaltantesAlCarrito}
                onAbrirModalAlerta={setProductoAlertaModal}
                onAbrirRentabilidad={() => setModalRentabilidadAbierto(true)}
                onAbrirImportador={() => setModalImportadorAbierto(true)}
                onGuardarPrecioManual={manejarGuardarPrecioVentaManual}
                cargandoCatalogo={cargandoCatalogo}
                onAdd={manejarAgregarAlCarrito}
                onHistory={abrirDetallePerfume}
                onFiltrarMarca={filtrarPorMarcaEnTabla}
                onEditImage={abrirEditorImagen}
                onAll={() => setView('catalog')}
                filtersOpen={filtersOpen}
                setFiltersOpen={setFiltersOpen}
                maxRows={LIMITE_FILAS_RESUMEN}
                paginaActual={1}
                onCambiarPagina={setPaginaCatalogo}
                tamanoPagina={LIMITE_FILAS_RESUMEN}
                onCambiarTamanoPagina={() => {}}
                mapIndicesProveedores={mapIndicesProveedores}
              />
            </>
          )}

          {view === 'catalog' && (
            <CatalogSection
              productos={productosVisibles}
              totalSinFiltrar={totalSinFiltrar}
              proveedoresDisponibles={proveedoresDisponibles}
              marcasDisponibles={marcasDisponibles}
              tiposDisponibles={tiposDisponibles}
              filtros={filtros}
              setFiltros={setFiltros}
              precioMinInput={precioMinInput}
              setPrecioMinInput={setPrecioMinInput}
              precioMaxInput={precioMaxInput}
              setPrecioMaxInput={setPrecioMaxInput}
              onLimpiarFiltros={limpiarTodosLosFiltros}
              alternarMarcaFiltro={alternarMarcaFiltro}
              cantidadFiltrosActivos={cantidadFiltrosActivos}
              monedaVisualizacion={monedaVisualizacion}
              dolarDelDia={dolarDelDia}
              configRentabilidad={configRentabilidad}
              conteosInteligencia={metricasGlobales.conteosInteligencia}
              itemsWatchlist={itemsWatchlist}
              alertasPorProductoId={alertasPorProductoId}
              registrosStockPropio={registrosStockPropio}
              onAjustarStock={ajustarStockProducto}
              onSetStockProducto={setStockProducto}
              onSetStockMinimo={setStockMinimoProducto}
              onQuitarStock={quitarStockProducto}
              onAgregarFaltantesAlCarrito={agregarFaltantesAlCarrito}
              onAbrirModalAlerta={setProductoAlertaModal}
              onAbrirRentabilidad={() => setModalRentabilidadAbierto(true)}
              onAbrirImportador={() => setModalImportadorAbierto(true)}
              onGuardarPrecioManual={manejarGuardarPrecioVentaManual}
              cargandoCatalogo={cargandoCatalogo}
              onAdd={manejarAgregarAlCarrito}
              onHistory={abrirDetallePerfume}
              onFiltrarMarca={filtrarPorMarcaEnTabla}
              onEditImage={abrirEditorImagen}
              filtersOpen={filtersOpen}
              setFiltersOpen={setFiltersOpen}
              paginaActual={paginaCatalogo}
              onCambiarPagina={setPaginaCatalogo}
              tamanoPagina={tamanoPaginaCatalogo}
              onCambiarTamanoPagina={(nuevoTamano) => {
                setTamanoPaginaCatalogo(nuevoTamano)
                setPaginaCatalogo(1)
              }}
              mapIndicesProveedores={mapIndicesProveedores}
            />
          )}

          {view === 'history' &&
            (() => {
              const prod = productoHistorialActivo
              const mejorPrecioActual = prod
                ? monedaVisualizacion === 'USD'
                  ? prod.mejorPrecioUSD
                  : prod.mejorPrecioARS
                : null
              const mejorCostoMlActual = prod
                ? monedaVisualizacion === 'USD'
                  ? prod.mejorCostoPorMlUSD
                  : prod.mejorCostoPorMlARS
                : null
              const mejorCosto100MlActual = prod
                ? monedaVisualizacion === 'USD'
                  ? prod.mejorCostoPor100MlUSD
                  : prod.mejorCostoPor100MlARS
                : null
              const rentabilidadFicha =
                prod && prod.mejorPrecioARS !== null
                  ? calcularRentabilidadUnitaria({
                      productoId: prod.producto_id,
                      costoARS: prod.mejorPrecioARS,
                      costoUSD: prod.mejorPrecioUSD,
                      ml: prod.ml,
                      tipo: prod.tipo,
                      dolarDelDia,
                      config: configRentabilidad,
                      precioVentaManualARS: prod.precioVentaManualARS,
                    })
                  : null
              const urlFragrantica = prod
                ? construirUrlFragrantica({
                    marca: prod.marca,
                    nombre: prod.nombre,
                    imagenUrl: prod.imagen_url,
                  })
                : 'https://www.fragrantica.es'
              const urlMercadoLibre = prod
                ? construirUrlBusquedaMercadoLibre({
                    marca: prod.marca,
                    nombre: prod.nombre,
                    concentracion: prod.concentracion,
                    ml: prod.ml,
                  })
                : 'https://listado.mercadolibre.com.ar/perfume'
              const enWatchlistActual = prod
                ? Boolean(itemsWatchlist[prod.producto_id])
                : false

              const diferenciaVsPisoPct =
                mejorPrecioActual !== null &&
                estadisticasHistorial.pisoGlobal &&
                estadisticasHistorial.pisoGlobal.valor > 0
                  ? ((mejorPrecioActual -
                      estadisticasHistorial.pisoGlobal.valor) /
                      estadisticasHistorial.pisoGlobal.valor) *
                    100
                  : null

              const ahorroVsTechoPct =
                mejorPrecioActual !== null &&
                estadisticasHistorial.techoGlobal &&
                estadisticasHistorial.techoGlobal.valor > 0
                  ? ((estadisticasHistorial.techoGlobal.valor -
                      mejorPrecioActual) /
                      estadisticasHistorial.techoGlobal.valor) *
                    100
                  : null

              return (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
                  {/* Columna izquierda: Foto grande del frasco + Nombre grande abajo + Detalles generales + Acciones */}
                  <article className="dashboard-card flex flex-col rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
                    <div className="relative flex flex-col items-center">
                      {prod ? (
                        <MiniaturaPerfumeEditable
                          producto={prod}
                          onAbrirEditor={abrirEditorImagen}
                          tamanoClase="mx-auto size-56 sm:size-64"
                        />
                      ) : (
                        <ImagenFrasco
                          src={undefined}
                          alt="Perfume"
                          className="mx-auto size-56 rounded-xl sm:size-64"
                        />
                      )}

                      {prod && (
                        <button
                          type="button"
                          onClick={() => filtrarPorMarcaEnTabla(prod.marca)}
                          title={`Click para buscar todos los perfumes de ${prod.marca} en la tabla`}
                          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-semibold text-violet-700 transition hover:border-violet-300 hover:bg-violet-100"
                        >
                          <Search size={11} />
                          <span>{prod.marca}</span>
                          <span className="text-[10px] font-normal text-violet-500">
                            · Buscar marca en tabla
                          </span>
                        </button>
                      )}

                      <h2 className="mt-2.5 text-center text-[22px] font-bold leading-tight tracking-tight text-slate-900 sm:text-[26px]">
                        {prod?.nombre ?? 'Seleccioná un perfume'}
                      </h2>

                      {prod && (
                        <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                              obtenerEstiloTipoProducto(prod.tipo).badgeClass
                            }`}
                          >
                            {prod.tipo}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                              prod.tieneStockDisponible
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-rose-50 text-rose-600'
                            }`}
                          >
                            {prod.tieneStockDisponible
                              ? `Con stock · Mejor en ${prod.proveedorMasBarato}`
                              : 'Sin stock disponible'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Detalles generales del producto (sin notas aromáticas) */}
                    {prod && (
                      <div className="mt-5 border-t border-slate-100 pt-4">
                        <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[.1em] text-slate-400">
                          Detalles generales del producto
                        </p>
                        <dl className="grid grid-cols-2 gap-2.5 text-[11px]">
                          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5">
                            <dt className="text-[10px] text-slate-400">Marca</dt>
                            <dd className="mt-0.5 font-semibold text-slate-800">
                              <button
                                type="button"
                                onClick={() => filtrarPorMarcaEnTabla(prod.marca)}
                                className="inline-flex items-center gap-1 text-left text-violet-700 hover:underline"
                              >
                                <span>{prod.marca}</span>
                                <ArrowRight size={11} />
                              </button>
                            </dd>
                          </div>

                          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5">
                            <dt className="text-[10px] text-slate-400">
                              Tipo / Concentración
                            </dt>
                            <dd className="mt-0.5 font-semibold text-slate-800">
                              {prod.concentracion ?? prod.tipo}
                            </dd>
                          </div>

                          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5">
                            <dt className="text-[10px] text-slate-400">
                              Presentación
                            </dt>
                            <dd className="mt-0.5 font-semibold text-slate-800">
                              {prod.ml !== null ? `${prod.ml} ml` : 'No esp.'}
                            </dd>
                          </div>

                          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5">
                            <dt className="text-[10px] text-slate-400">Género</dt>
                            <dd className="mt-0.5 font-semibold text-slate-800">
                              {prod.genero ?? 'Unisex / General'}
                            </dd>
                          </div>

                          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5">
                            <dt className="text-[10px] text-slate-400">
                              Código / EAN6
                            </dt>
                            <dd className="mt-0.5 font-semibold text-slate-800">
                              #{prod.ean6 ?? prod.producto_id}
                            </dd>
                          </div>

                          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5">
                            <dt className="text-[10px] text-slate-400">
                              Costo por ml / 100ml
                            </dt>
                            <dd className="mt-0.5 font-semibold text-slate-800">
                              {mejorCostoMlActual !== null &&
                              mejorCosto100MlActual !== null
                                ? `${formatearMoneda(
                                    mejorCostoMlActual,
                                    monedaVisualizacion,
                                  )}/ml · ${formatearMoneda(
                                    mejorCosto100MlActual,
                                    monedaVisualizacion,
                                  )}/100ml`
                                : '—'}
                            </dd>
                          </div>

                          {rentabilidadFicha && (
                            <div className="col-span-2 rounded-lg border border-violet-100 bg-violet-50/50 p-2.5">
                              <dt className="flex items-center justify-between text-[10px] text-slate-500">
                                <span>
                                  Reventa sugerida (
                                  {rentabilidadFicha.esPrecioManual
                                    ? 'Manual'
                                    : `+${rentabilidadFicha.margenPorcentaje}%`}
                                  )
                                </span>
                                <span className="font-semibold text-emerald-700">
                                  Ganancia:{' '}
                                  {formatearMoneda(
                                    monedaVisualizacion === 'USD'
                                      ? rentabilidadFicha.gananciaNetaUSD
                                      : rentabilidadFicha.gananciaNetaARS,
                                    monedaVisualizacion,
                                  )}
                                </span>
                              </dt>
                              <dd className="mt-0.5 text-[13px] font-bold text-violet-900">
                                PVP:{' '}
                                {formatearMoneda(
                                  monedaVisualizacion === 'USD'
                                    ? rentabilidadFicha.precioVentaSugeridoUSD
                                    : rentabilidadFicha.precioVentaSugeridoARS,
                                  monedaVisualizacion,
                                )}
                              </dd>
                            </div>
                          )}
                        </dl>
                      </div>
                    )}

                    {/* Botones de acción externos (Fragrantica, Mercado Libre, Alertas) */}
                    {prod && (
                      <div className="mt-5 flex flex-col gap-2 border-t border-slate-100 pt-4">
                        <a
                          href={urlFragrantica}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#34294d] px-4 py-2.5 text-[12px] font-semibold text-white shadow-xs transition hover:bg-[#45365f]"
                        >
                          <ExternalLink size={14} />
                          <span>Ver perfume en Fragrantica</span>
                        </a>

                        <div className="grid grid-cols-2 gap-2">
                          <a
                            href={urlMercadoLibre}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800 transition hover:bg-amber-100"
                          >
                            <ExternalLink size={12} />
                            <span>Buscar en ML</span>
                          </a>

                          <button
                            type="button"
                            onClick={() => setProductoAlertaModal(prod)}
                            className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-semibold transition ${
                              enWatchlistActual
                                ? 'border-violet-300 bg-violet-50 text-violet-800'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <Star
                              size={12}
                              className={
                                enWatchlistActual
                                  ? 'fill-violet-700 text-violet-700'
                                  : ''
                              }
                            />
                            <span>
                              {enWatchlistActual
                                ? 'Editar alerta'
                                : 'Seguir precio'}
                            </span>
                          </button>
                        </div>
                      </div>
                    )}
                  </article>

                  {/* Columna derecha: Selector + Piso y Techo Histórico + Gráfico de Evolución + Precios en los 3 proveedores */}
                  <div className="flex min-w-0 flex-col gap-4">
                    {/* Barra superior de navegación y selección de perfume */}
                    <section className="dashboard-card flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 sm:px-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setView('catalog')}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50"
                        >
                          <ChevronLeft size={13} />
                          <span>Volver a la tabla</span>
                        </button>

                        {prod && (
                          <button
                            type="button"
                            onClick={() => filtrarPorMarcaEnTabla(prod.marca)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50"
                          >
                            <Filter size={12} className="text-violet-600" />
                            <span>Ver todos los {prod.marca}</span>
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {productosGlobales.length > 0 && (
                          <label className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] text-slate-600">
                            <span className="text-slate-400">Perfume</span>
                            <select
                              aria-label="Seleccionar perfume para historial"
                              value={prod?.producto_id ?? ''}
                              onChange={(event) => {
                                const id = Number(event.target.value)
                                if (Number.isFinite(id)) {
                                  setProductoHistorialId(id)
                                  setHistorySupplierTab('GLOBAL')
                                }
                              }}
                              className="max-w-[220px] bg-transparent font-medium outline-none"
                            >
                              {productosGlobales.map((item) => (
                                <option
                                  key={item.producto_id}
                                  value={item.producto_id}
                                >
                                  {item.marca} · {item.nombre}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}

                        <label className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] text-slate-600">
                          <span className="text-slate-400">Proveedor</span>
                          <select
                            aria-label="Filtrar proveedor en historial"
                            value={historySupplierTab}
                            onChange={(event) =>
                              setHistorySupplierTab(event.target.value)
                            }
                            className="bg-transparent font-medium outline-none"
                          >
                            <option value="GLOBAL">Todos</option>
                            {proveedoresEnHistorial.map((nombre) => (
                              <option key={nombre} value={nombre}>
                                {nombre}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </section>

                    {/* KPI Cards: Piso Histórico, Techo Histórico y Mejor Precio Actual */}
                    <section
                      aria-label="Piso y techo histórico de precio"
                      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
                    >
                      <article className="dashboard-card rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                            Piso histórico
                          </span>
                          <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                            <TrendingDown size={15} />
                          </span>
                        </div>
                        <strong className="mt-2 block text-[22px] font-bold tracking-tight text-slate-900">
                          {estadisticasHistorial.pisoGlobal
                            ? formatearMoneda(
                                estadisticasHistorial.pisoGlobal.valor,
                                monedaVisualizacion,
                              )
                            : '—'}
                        </strong>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {estadisticasHistorial.pisoGlobal
                            ? `${estadisticasHistorial.pisoGlobal.proveedor} · ${estadisticasHistorial.pisoGlobal.fecha}`
                            : 'Sin registros'}
                        </p>
                        {diferenciaVsPisoPct !== null && (
                          <span
                            className={`mt-1.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              diferenciaVsPisoPct <= 0.5
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {diferenciaVsPisoPct <= 0.5
                              ? '★ Hoy está en su piso histórico'
                              : `Hoy +${diferenciaVsPisoPct.toFixed(1)}% sobre el piso`}
                          </span>
                        )}
                      </article>

                      <article className="dashboard-card rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-rose-600">
                            Techo histórico
                          </span>
                          <span className="flex size-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                            <TrendingUp size={15} />
                          </span>
                        </div>
                        <strong className="mt-2 block text-[22px] font-bold tracking-tight text-slate-900">
                          {estadisticasHistorial.techoGlobal
                            ? formatearMoneda(
                                estadisticasHistorial.techoGlobal.valor,
                                monedaVisualizacion,
                              )
                            : '—'}
                        </strong>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {estadisticasHistorial.techoGlobal
                            ? `${estadisticasHistorial.techoGlobal.proveedor} · ${estadisticasHistorial.techoGlobal.fecha}`
                            : 'Sin registros'}
                        </p>
                        {ahorroVsTechoPct !== null && ahorroVsTechoPct > 0.5 && (
                          <span className="mt-1.5 inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                            Hoy -{ahorroVsTechoPct.toFixed(1)}% debajo del techo
                          </span>
                        )}
                      </article>

                      <article className="dashboard-card rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">
                            Mejor precio hoy
                          </span>
                          <span className="flex size-7 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
                            <Wallet size={15} />
                          </span>
                        </div>
                        <strong className="mt-2 block text-[22px] font-bold tracking-tight text-slate-900">
                          {mejorPrecioActual !== null
                            ? formatearMoneda(
                                mejorPrecioActual,
                                monedaVisualizacion,
                              )
                            : 'Sin stock'}
                        </strong>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {prod?.proveedorMasBarato
                            ? `Mejor oferta en ${prod.proveedorMasBarato}`
                            : 'No disponible actualmente'}
                        </p>
                        {prod?.brechaArbitrajePorcentaje !== null &&
                          prod?.brechaArbitrajePorcentaje !== undefined &&
                          prod.brechaArbitrajePorcentaje >= 2 && (
                            <span className="mt-1.5 inline-flex items-center gap-1 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                              <Zap size={10} />
                              Arbitraje {prod.brechaArbitrajePorcentaje.toFixed(1)}% vs{' '}
                              {prod.proveedorSegundoMasBarato}
                            </span>
                          )}
                      </article>
                    </section>

                    {/*Precios en los tres proveedores */}
                    <section className="dashboard-card rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-[14px] font-semibold text-slate-900">
                            Precios en los proveedores
                          </h3>
                          <p className="text-[11px] text-slate-400">
                            Comparativa directa entre listas activas ·{' '}
                            {monedaVisualizacion}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        {proveedoresDisponibles.map((nombre) => {
                          const oferta = prod?.ofertas[nombre]
                          const esMejor =
                            prod?.proveedorMasBarato === nombre &&
                            oferta?.disponible
                          const precioConvertido =
                            monedaVisualizacion === 'USD'
                              ? oferta?.precioBaseEnUSD
                              : oferta?.precioBaseEnARS
                          const variacion = oferta?.variacionPorcentaje ?? null
                          const mostrarVariacion =
                            variacion !== null && Math.abs(variacion) >= 0.1
                          const statsProv =
                            estadisticasHistorial.porProveedor[nombre]

                          return (
                            <div
                              key={nombre}
                              className={`flex flex-col justify-between rounded-xl border p-3.5 transition ${
                                esMejor
                                  ? 'border-emerald-300 bg-emerald-50/30'
                                  : 'border-slate-200 bg-slate-50/40'
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="flex items-center gap-2 text-[12px] font-semibold text-slate-800">
                                    <span
                                      className="size-2.5 rounded-full"
                                      style={{
                                        backgroundColor: obtenerColorProveedor(
                                          nombre,
                                          mapIndicesProveedores.get(nombre) ?? 0,
                                        ),
                                      }}
                                    />
                                    {nombre}
                                  </span>

                                  <div className="flex items-center gap-1">
                                    {esMejor && (
                                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-800">
                                        Mejor opción
                                      </span>
                                    )}
                                    {oferta ? (
                                      <span
                                        className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                                          oferta.disponible
                                            ? 'bg-emerald-50 text-emerald-700'
                                            : 'bg-rose-50 text-rose-600'
                                        }`}
                                      >
                                        {oferta.disponible
                                          ? 'Disponible'
                                          : oferta.estadoStock}
                                      </span>
                                    ) : (
                                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-400">
                                        Sin lista
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {oferta && oferta.precioBase !== null ? (
                                  <div className="mt-3">
                                    <div className="flex flex-wrap items-baseline gap-2">
                                      <strong
                                        className={`text-[18px] font-bold tracking-tight ${
                                          oferta.disponible
                                            ? 'text-slate-900'
                                            : 'text-slate-400 line-through'
                                        }`}
                                      >
                                        {formatearMoneda(
                                          oferta.precioBase,
                                          oferta.moneda,
                                        )}
                                      </strong>

                                      {mostrarVariacion && variacion !== null && (
                                        <span
                                          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${
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

                                    {precioConvertido !== null &&
                                      precioConvertido !== undefined &&
                                      oferta.moneda !== monedaVisualizacion && (
                                        <p className="mt-0.5 text-[11px] text-slate-500">
                                          ≈{' '}
                                          {formatearMoneda(
                                            precioConvertido,
                                            monedaVisualizacion,
                                          )}
                                        </p>
                                      )}

                                    {(oferta.precio12 !== null ||
                                      oferta.precio24 !== null) && (
                                      <p className="mt-1.5 text-[10px] font-medium text-slate-500">
                                        {oferta.precio12 !== null
                                          ? `12+ u: ${formatearMoneda(
                                              oferta.precio12,
                                              oferta.moneda,
                                            )}`
                                          : ''}
                                        {oferta.precio12 !== null &&
                                        oferta.precio24 !== null
                                          ? ' · '
                                          : ''}
                                        {oferta.precio24 !== null
                                          ? `24+ u: ${formatearMoneda(
                                              oferta.precio24,
                                              oferta.moneda,
                                            )}`
                                          : ''}
                                      </p>
                                    )}

                                    {statsProv &&
                                      (statsProv.piso || statsProv.techo) && (
                                        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-200/70 pt-2 text-[10px] text-slate-400">
                                          {statsProv.piso && (
                                            <span>
                                              Piso:{' '}
                                              <strong className="font-semibold text-slate-600">
                                                {formatearMoneda(
                                                  statsProv.piso.valor,
                                                  monedaVisualizacion,
                                                )}
                                              </strong>
                                            </span>
                                          )}
                                          {statsProv.techo && (
                                            <span>
                                              Techo:{' '}
                                              <strong className="font-semibold text-slate-600">
                                                {formatearMoneda(
                                                  statsProv.techo.valor,
                                                  monedaVisualizacion,
                                                )}
                                              </strong>
                                            </span>
                                          )}
                                        </div>
                                      )}
                                  </div>
                                ) : (
                                  <p className="mt-3 text-[12px] text-slate-400">
                                    No trabajado por este proveedor.
                                  </p>
                                )}
                              </div>

                              {prod && oferta && oferta.disponible && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    manejarAgregarAlCarrito(prod, oferta)
                                  }
                                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-violet-700 transition hover:bg-violet-50"
                                >
                                  <Plus size={13} />
                                  <span>Agregar al carrito</span>
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </section>

                    {/* Gráfico de Evolución Histórica de Precios */}
                    <section className="dashboard-card rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-[14px] font-semibold text-slate-900">
                            Historial de precios
                          </h3>
                          <p className="text-[11px] text-slate-400">
                            Curva de evolución por proveedor en{' '}
                            {monedaVisualizacion}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          {proveedoresGraficoHistorial.map((nombre) => (
                            <span
                              key={nombre}
                              className="flex items-center gap-2 text-[11px] text-slate-500"
                            >
                              <span
                                className="size-2 rounded-full"
                                style={{
                                  backgroundColor: obtenerColorProveedor(
                                    nombre,
                                    mapIndicesProveedores.get(nombre) ?? 0,
                                  ),
                                }}
                              />
                              {nombre}
                            </span>
                          ))}
                        </div>
                      </div>

                      <GraficoEvolucionPrecios
                        datos={datosHistorial}
                        proveedores={proveedoresGraficoHistorial}
                        moneda={monedaVisualizacion}
                        isDark={isDark}
                        cargando={cargandoHistorial}
                        altura="h-[300px]"
                      />

                      <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
                        Evolución histórica comparada · valores en{' '}
                        {monedaVisualizacion} (Cotización: ARS{' '}
                        {dolarDelDia.toLocaleString('es-AR')})
                      </p>
                    </section>
                  </div>
                </div>
              )
            })()}

          {view === 'cart' && (
            <section className="dashboard-card max-w-[960px] rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
              <SectionTitle
                eyebrow="Pedido mayorista"
                title="Tu selección"
                detail={`${totalUnidadesCarrito} ${
                  totalUnidadesCarrito === 1 ? 'unidad' : 'unidades'
                } en ${resumenesCarrito.length} proveedor${
                  resumenesCarrito.length === 1 ? '' : 'es'
                }`}
                action={
                  resumenesCarrito.length > 0 ? (
                    <button
                      type="button"
                      onClick={vaciarCarrito}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-rose-600 transition hover:bg-rose-50"
                    >
                      <Trash2 size={13} />
                      Vaciar carrito
                    </button>
                  ) : undefined
                }
              />

              {resumenesCarrito.length === 0 ? (
                <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
                  <span className="mb-3 flex size-12 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                    <ShoppingBag size={20} />
                  </span>
                  <p className="text-[13px] font-semibold text-slate-700">
                    Tu carrito está vacío
                  </p>
                  <p className="mt-1 max-w-[280px] text-[12px] text-slate-400">
                    Sumá perfumes desde el catálogo para simular escalas
                    mayoristas (12+ / 24+) y generar tus pedidos por WhatsApp.
                  </p>
                  <button
                    type="button"
                    onClick={() => setView('catalog')}
                    className="primary-action mt-4 rounded-lg bg-[#34294d] px-3.5 py-2.5 text-[11px] font-semibold text-white transition hover:bg-[#45365f]"
                  >
                    Explorar catálogo
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex flex-col divide-y divide-slate-100">
                    {resumenesCarrito.map((resumen) => {
                      const indiceColor =
                        mapIndicesProveedores.get(resumen.proveedor) ?? 0
                      const colorProveedor = obtenerColorProveedor(
                        resumen.proveedor,
                        indiceColor,
                      )
                      const copiadoEste =
                        proveedorCopiado === resumen.proveedor

                      return (
                        <div key={resumen.proveedor} className="py-5 first:pt-2">
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className="size-2.5 rounded-full"
                                style={{ backgroundColor: colorProveedor }}
                              />
                              <span className="text-[13px] font-semibold text-slate-800">
                                Pedido para {resumen.proveedor}
                              </span>
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                                {resumen.totalUnidades}{' '}
                                {resumen.totalUnidades === 1
                                  ? 'unidad'
                                  : 'unidades'}
                              </span>
                            </div>

                            <div className="relative">
                              <select
                                aria-label={`Escala mayorista para ${resumen.proveedor}`}
                                value={resumen.modoEscala}
                                onChange={(event) =>
                                  setEscalaProveedor(
                                    resumen.proveedor,
                                    event.target.value as ModoEscalaMayorista,
                                  )
                                }
                                className="appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-7 text-[11px] font-medium text-slate-700 outline-none"
                              >
                                {OPCIONES_ESCALA.map((op) => (
                                  <option key={op.valor} value={op.valor}>
                                    {op.etiqueta}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown
                                size={12}
                                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
                              />
                            </div>
                          </div>

                          {(resumen.escalaAplicada !== 'Base' ||
                            resumen.ahorroTotalEnMonedaOrigen > 0) && (
                            <div className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
                              Escala aplicada:{' '}
                              <strong>{resumen.escalaAplicada}</strong>
                              {resumen.ahorroTotalEnMonedaOrigen > 0 && (
                                <>
                                  {' '}
                                  · Ahorro estimado:{' '}
                                  {formatearMoneda(
                                    resumen.ahorroTotalEnMonedaOrigen,
                                    resumen.monedaOrigen,
                                  )}
                                </>
                              )}
                            </div>
                          )}

                          <div className="divide-y divide-slate-100">
                            {resumen.items.map((item) => {
                              const prodCatalogo = mapaProductosGlobales.get(
                                item.productoId,
                              )
                              const tipoItem = prodCatalogo?.tipo ?? 'Perfume'
                              const mlItem =
                                item.ml ?? prodCatalogo?.ml ?? null
                              const unitarioARS =
                                item.cantidad > 0
                                  ? item.subtotalARS / item.cantidad
                                  : 0
                              const unitarioUSD =
                                item.cantidad > 0
                                  ? item.subtotalUSD / item.cantidad
                                  : 0
                              const rentItem = calcularRentabilidadUnitaria({
                                productoId: item.productoId,
                                costoARS: unitarioARS,
                                costoUSD: unitarioUSD,
                                ml: mlItem,
                                tipo: tipoItem,
                                dolarDelDia,
                                config: configRentabilidad,
                                precioVentaManualARS:
                                  prodCatalogo?.precioVentaManualARS,
                              })
                              const pvpUnitMostrado =
                                monedaVisualizacion === 'USD'
                                  ? rentItem.precioVentaSugeridoUSD
                                  : rentItem.precioVentaSugeridoARS
                              const gananciaTotalItemMostrada =
                                (monedaVisualizacion === 'USD'
                                  ? rentItem.gananciaNetaUSD
                                  : rentItem.gananciaNetaARS) * item.cantidad

                              return (
                                <div
                                  key={`${item.productoId}-${item.proveedor}`}
                                  className="flex flex-wrap items-center gap-3 py-3 sm:flex-nowrap"
                                >
                                  <ImagenFrasco
                                    src={item.imagenUrl}
                                    alt={`${item.marca} ${item.nombre}`}
                                    className="size-11 shrink-0 rounded-lg"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-[12px] font-medium text-slate-800">
                                      {item.marca} {item.nombre}
                                    </p>
                                    <p className="mt-0.5 text-[10px] text-slate-400">
                                      {formatearMoneda(
                                        item.precioUnitarioAplicado,
                                        item.moneda,
                                      )}{' '}
                                      c/u ({item.escalaItem})
                                    </p>
                                    <p className="mt-0.5 text-[10px] font-medium text-emerald-700">
                                      PVP{rentItem.esPrecioManual ? ' manual' : ' sug'}:{' '}
                                      {formatearMoneda(
                                        pvpUnitMostrado,
                                        monedaVisualizacion,
                                      )}{' '}
                                      · Ganancia neta:{' '}
                                      +
                                      {formatearMoneda(
                                        gananciaTotalItemMostrada,
                                        monedaVisualizacion,
                                      )}
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      aria-label={`Quitar una unidad de ${item.nombre}`}
                                      onClick={() =>
                                        incrementarCantidad(
                                          item.productoId,
                                          item.proveedor,
                                          -1,
                                        )
                                      }
                                      className="qty-button flex size-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                                    >
                                      −
                                    </button>
                                    <span className="w-6 text-center text-[12px] font-medium text-slate-800">
                                      {item.cantidad}
                                    </span>
                                    <button
                                      type="button"
                                      aria-label={`Agregar una unidad de ${item.nombre}`}
                                      onClick={() =>
                                        incrementarCantidad(
                                          item.productoId,
                                          item.proveedor,
                                          1,
                                        )
                                      }
                                      className="qty-button flex size-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                                    >
                                      +
                                    </button>
                                    <button
                                      type="button"
                                      aria-label={`Eliminar ${item.nombre}`}
                                      onClick={() =>
                                        quitarItem(
                                          item.productoId,
                                          item.proveedor,
                                        )
                                      }
                                      className="ml-1 rounded-md p-1 text-slate-400 transition hover:text-rose-600"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>

                                  <strong className="w-24 text-right text-[12px] font-semibold text-slate-800">
                                    {formatearMoneda(
                                      item.subtotalOrigen,
                                      item.moneda,
                                    )}
                                  </strong>
                                </div>
                              )
                            })}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                            <div>
                              <p className="text-[12px] font-semibold text-slate-800">
                                Subtotal {resumen.proveedor}:{' '}
                                {formatearMoneda(
                                  resumen.totalEnMonedaOrigen,
                                  resumen.monedaOrigen,
                                )}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                Aprox.{' '}
                                {resumen.monedaOrigen === 'USD'
                                  ? formatearMoneda(resumen.totalEnARS, 'ARS')
                                  : formatearMoneda(resumen.totalEnUSD, 'USD')}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                void copiarMensajeProveedor(resumen.proveedor)
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                              {copiadoEste ? (
                                <Check size={13} className="text-emerald-600" />
                              ) : (
                                <Copy size={13} />
                              )}
                              {copiadoEste
                                ? 'Pedido copiado'
                                : `Copiar pedido para ${resumen.proveedor}`}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                        <TrendingUp size={14} className="text-emerald-600" />
                        Rentabilidad proyectada del pedido
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] text-slate-400">
                          Retiro/envío c/u:
                        </span>
                        {[3.5, 2, 0].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setCostoEnvioPorPerfumeUSD(val)}
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold transition ${
                              configRentabilidad.costoEnvioPorPerfumeUSD === val
                                ? 'border-violet-300 bg-[#34294d] text-white'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            USD {val}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setModalRentabilidadAbierto(true)}
                          className="text-[11px] font-semibold text-violet-700 hover:underline"
                        >
                          Ajustar margen ({configRentabilidad.margenGeneralPorcentaje}%)
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-[10px] font-medium text-slate-400">
                          Costo total mayorista
                        </p>
                        <p className="mt-1 text-[14px] font-semibold text-slate-800">
                          {formatearMoneda(totalGeneralUSD, 'USD')}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {formatearMoneda(totalGeneralARS, 'ARS')}
                        </p>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-[10px] font-medium text-slate-400">
                          Venta total estimada
                        </p>
                        <p className="mt-1 text-[14px] font-semibold text-slate-800">
                          {formatearMoneda(
                            rentabilidadCarrito.ventaTotalUSD,
                            'USD',
                          )}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {formatearMoneda(
                            rentabilidadCarrito.ventaTotalARS,
                            'ARS',
                          )}
                        </p>
                      </div>

                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                        <p className="text-[10px] font-semibold text-emerald-700">
                          Ganancia neta proyectada ({rentabilidadCarrito.roiPromedio.toFixed(1)}% ROI)
                        </p>
                        <p className="mt-1 text-[14px] font-semibold text-emerald-700">
                          +{formatearMoneda(
                            rentabilidadCarrito.gananciaNetaTotalUSD,
                            'USD',
                          )}
                        </p>
                        <p className="text-[10px] text-emerald-700">
                          +{formatearMoneda(
                            rentabilidadCarrito.gananciaNetaTotalARS,
                            'ARS',
                          )}
                        </p>
                      </div>
                    </div>

                    {rentabilidadCarrito.ahorroEscalasARS > 0 && (
                      <p className="mt-3 text-[11px] text-emerald-700">
                        Las escalas mayoristas (12+ / 24+) te suman{' '}
                        <strong>
                          {formatearMoneda(
                            monedaVisualizacion === 'USD'
                              ? rentabilidadCarrito.ahorroEscalasUSD
                              : rentabilidadCarrito.ahorroEscalasARS,
                            monedaVisualizacion,
                          )}
                        </strong>{' '}
                        de margen extra sobre el precio base.
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-5">
                    <div>
                      <p className="text-[11px] text-slate-400">
                        Total estimado
                      </p>
                      <p className="mt-1 text-[20px] font-semibold tracking-tight text-slate-900">
                        {formatearMoneda(totalGeneralUSD, 'USD')}{' '}
                        <span className="text-[13px] font-medium text-slate-400">
                          / {formatearMoneda(totalGeneralARS, 'ARS')}
                        </span>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void copiarTodosLosPedidos()}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-[11px] font-semibold text-white transition hover:bg-emerald-800"
                    >
                      {proveedorCopiado === 'TODOS' ? (
                        <Check size={14} />
                      ) : (
                        <Copy size={14} />
                      )}
                      {proveedorCopiado === 'TODOS'
                        ? 'Todos los pedidos copiados'
                        : 'Copiar todos los pedidos para WhatsApp'}
                    </button>
                  </div>
                </>
              )}
            </section>
          )}

          <footer className="mt-7 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 text-[10px] text-slate-400">
            <span>
              Precios de referencia sujetos a disponibilidad del proveedor.
            </span>
            <span className="flex items-center gap-1.5">
              <CircleHelp size={12} />
              {tipoDolarActivo === 'manual'
                ? 'Cotización manual'
                : `Cotización Dólar ${
                    tipoDolarActivo === 'blue'
                      ? 'Blue'
                      : tipoDolarActivo === 'mep'
                        ? 'MEP'
                        : 'Oficial'
                  }`}{' '}
              · USD 1 = ARS {dolarDelDia.toLocaleString('es-AR')}
            </span>
          </footer>
        </div>
      </div>

      {productoEditandoImagen && (
        <ModalEditorImagenPerfume
          producto={productoEditandoImagen}
          modoInicial={modoEditorImagen}
          archivoInicial={archivoInicialEditor}
          usandoDemo={usandoDemo}
          onCerrar={() => {
            setProductoEditandoImagen(null)
            setArchivoInicialEditor(null)
          }}
          onGuardarUrl={manejarGuardarUrlManual}
          onGuardarArchivoOptimizado={manejarGuardarArchivoOptimizado}
        />
      )}

      {modalRentabilidadAbierto && (
        <RentabilidadModal
          config={configRentabilidad}
          dolarDelDia={dolarDelDia}
          monedaVisualizacion={monedaVisualizacion}
          productosGlobales={productosGlobales}
          onSetMargenGeneral={setMargenGeneralPorcentaje}
          onSetMargenPorTipo={setMargenPorTipo}
          onSetComisionPlataforma={setComisionPlataformaPorcentaje}
          onSetCostoFijo={setCostoFijoEnvioEmbalajeARS}
          onSetCostoEnvioUSD={setCostoEnvioPorPerfumeUSD}
          onSetGananciaFijaARS={setGananciaFijaAdicionalARS}
          onGuardarPrecioManual={manejarGuardarPrecioVentaManual}
          onSetMostrarEnCatalogo={setMostrarRentabilidadEnCatalogo}
          onRestaurar={restaurarRentabilidadPorDefecto}
          onCerrar={() => setModalRentabilidadAbierto(false)}
        />
      )}

      {productoAlertaModal && (
        <AlertaWatchlistModal
          producto={productoAlertaModal}
          itemExistente={itemsWatchlist[productoAlertaModal.producto_id]}
          monedaVisualizacion={monedaVisualizacion}
          onGuardar={(datos) => {
            guardarAlertaProducto(productoAlertaModal.producto_id, datos)
            setProductoAlertaModal(null)
          }}
          onQuitar={() => {
            quitarSeguimiento(productoAlertaModal.producto_id)
            setProductoAlertaModal(null)
          }}
          onCerrar={() => setProductoAlertaModal(null)}
        />
      )}

      {modalImportadorAbierto && (
        <ImportadorListasModal
          proveedoresDisponibles={proveedoresDisponibles}
          productosGlobales={productosGlobales}
          onImportar={manejarAplicarImportacion}
          onCerrar={() => setModalImportadorAbierto(false)}
        />
      )}
    </main>
  )
}

function CatalogSection({
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
      etiqueta: '⚡ Arbitraje ≥5%',
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
    {
      id: 'FALTA_REPONER',
      etiqueta: '📦 Falta reponer',
      count: conteosInteligencia.faltaReponer,
      destacado: conteosInteligencia.faltaReponer > 0,
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
            Vista comparativa · {monedaVisualizacion}
          </span>
        </div>
      </div>

      {/* Píldoras rápidas de Inteligencia de Precios, Watchlist y Reposición */}
      <div className="scrollbar-none flex items-center gap-1.5 overflow-x-auto border-b border-slate-100 bg-slate-50/70 px-4 py-2.5 sm:px-5">
        <span className="mr-1 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
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
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium transition ${
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
                  className={`rounded-full px-1.5 py-0.2 text-[9px] font-semibold ${
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

        {conteosInteligencia.faltaReponer > 0 && (
          <button
            type="button"
            onClick={onAgregarFaltantesAlCarrito}
            className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-violet-300 bg-violet-50 px-3 py-1 text-[10px] font-semibold text-violet-700 transition hover:bg-violet-100"
          >
            <ShoppingBag size={11} />
            Agregar faltantes al carrito
          </button>
        )}
      </div>

      {filtersOpen && (
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3.5 sm:px-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Género
              </span>
              {GENEROS_FILTRO.map(({ etiqueta, valor }) => (
                <button
                  type="button"
                  key={etiqueta}
                  onClick={() =>
                    setFiltros((prev) => ({ ...prev, genero: valor }))
                  }
                  className={`rounded-md px-2.5 py-1.5 text-[10px] font-medium ${
                    filtros.genero === valor
                      ? 'bg-[#34294d] text-white'
                      : 'bg-white text-slate-500 ring-1 ring-slate-200'
                  }`}
                >
                  {etiqueta}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
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
                className="h-7 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-600 outline-none"
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
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Precio ({monedaVisualizacion})
              </span>
              <input
                aria-label="Precio mínimo"
                type="number"
                min="0"
                value={precioMinInput}
                onChange={(event) => setPrecioMinInput(event.target.value)}
                placeholder="Mín"
                className="h-7 w-20 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-700 outline-none"
              />
              <span className="text-[10px] text-slate-400">-</span>
              <input
                aria-label="Precio máximo"
                type="number"
                min="0"
                value={precioMaxInput}
                onChange={(event) => setPrecioMaxInput(event.target.value)}
                placeholder="Máx"
                className="h-7 w-20 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-700 outline-none"
              />
            </div>

            <label className="ml-auto flex cursor-pointer items-center gap-2 text-[11px] text-slate-600">
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
              className="flex items-center gap-1 text-[10px] font-medium text-slate-400 hover:text-slate-700"
            >
              <X size={12} />
              Limpiar
            </button>
          </div>

          {marcasDisponibles.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-200/70 pt-2.5">
              <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Marcas
              </span>
              <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                <button
                  type="button"
                  onClick={() =>
                    setFiltros((prev) => ({ ...prev, marcasSeleccionadas: [] }))
                  }
                  className={`rounded-md px-2 py-1 text-[10px] font-medium ${
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
                      className={`rounded-md px-2 py-1 text-[10px] font-medium ${
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
                <tr className="bg-slate-50/70 text-[10px] font-semibold uppercase tracking-[.08em] text-slate-400">
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
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${estiloTipo.badgeClass}`}
                        >
                          {item.tipo}
                        </span>
                      </td>

                      <td className={`px-4 py-3 sm:px-5 ${estiloTipo.cellClass}`}>
                        <div className="flex min-w-[220px] items-center gap-3">
                          <MiniaturaPerfumeEditable
                            producto={item}
                            onAbrirEditor={onEditImage}
                          />

                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onHistory(item)}
                                title={`Abrir ficha, precios e historial de ${item.marca} ${item.nombre}`}
                                className="truncate text-left text-[11px] font-semibold text-slate-800 transition hover:text-violet-700 hover:underline"
                              >
                                {item.nombre}
                              </button>
                              {alertaEvaluada?.cumplePrecioObjetivo && (
                                <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                                  Objetivo
                                </span>
                              )}
                            </span>
                            <span className="mt-1 block truncate text-[10px] text-slate-400">
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
                              {item.genero ? ` · ${item.genero}` : ''} · #
                              {item.ean6 ?? item.producto_id}
                            </span>

                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              {!registroStock ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onSetStockProducto(item.producto_id, 0, 2)
                                  }
                                  className="inline-flex items-center gap-1 rounded border border-slate-200 px-1.5 py-0.5 text-[9px] font-medium text-slate-500 transition hover:border-violet-300 hover:text-violet-700"
                                >
                                  <Boxes size={10} />
                                  Controlar mi stock
                                </button>
                              ) : (
                                <div className="inline-flex flex-wrap items-center gap-1">
                                  <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] text-slate-600">
                                    <Boxes size={10} className="text-slate-400" />
                                    <span>Stock:</span>
                                    <button
                                      type="button"
                                      aria-label={`Restar stock propio de ${item.nombre}`}
                                      onClick={() =>
                                        onAjustarStock(item.producto_id, -1)
                                      }
                                      className="rounded px-1 font-semibold hover:bg-slate-200"
                                    >
                                      −
                                    </button>
                                    <strong className="text-slate-800">
                                      {registroStock.cantidadActual}
                                    </strong>
                                    <button
                                      type="button"
                                      aria-label={`Sumar stock propio de ${item.nombre}`}
                                      onClick={() =>
                                        onAjustarStock(item.producto_id, 1)
                                      }
                                      className="rounded px-1 font-semibold hover:bg-slate-200"
                                    >
                                      +
                                    </button>
                                  </span>

                                  <label className="inline-flex items-center gap-1 text-[9px] text-slate-400">
                                    <span>mín</span>
                                    <input
                                      type="number"
                                      min="0"
                                      aria-label={`Stock mínimo de ${item.nombre}`}
                                      value={registroStock.stockMinimo}
                                      onChange={(e) =>
                                        onSetStockMinimo(
                                          item.producto_id,
                                          Number(e.target.value),
                                        )
                                      }
                                      className="h-4 w-8 rounded border border-slate-200 bg-white px-1 text-center text-[9px] font-semibold text-slate-700 outline-none"
                                    />
                                  </label>

                                  {faltaReponer ? (
                                    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
                                      Reponer {faltantesStock} u.
                                    </span>
                                  ) : (
                                    <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                                      OK
                                    </span>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() =>
                                      onQuitarStock(item.producto_id)
                                    }
                                    title="Quitar control de stock propio"
                                    aria-label={`Quitar control de stock de ${item.nombre}`}
                                    className="rounded p-0.5 text-slate-400 hover:text-rose-600"
                                  >
                                    <X size={10} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </span>
                        </div>
                      </td>

                      {displayedSuppliers.map((nombre) => {
                        const oferta = item.ofertas[nombre]
                        const precioConvertido =
                          monedaVisualizacion === 'USD'
                            ? oferta?.precioBaseEnUSD
                            : oferta?.precioBaseEnARS
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
                                      className={`text-[11px] font-semibold ${
                                        oferta.disponible
                                          ? 'text-slate-700'
                                          : 'text-slate-400 line-through'
                                      }`}
                                    >
                                      {formatearMoneda(
                                        oferta.precioBase,
                                        oferta.moneda,
                                      )}
                                    </span>

                                    {mostrarVariacion && variacion !== null && (
                                      <span
                                        title={tituloVariacion}
                                        className={`inline-flex items-center rounded px-1 py-0.5 text-[9px] font-semibold ${
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
                                    precioConvertido !== null &&
                                    precioConvertido !== undefined &&
                                    oferta.moneda !== monedaVisualizacion && (
                                      <span className="mt-0.5 block text-[9px] text-slate-400">
                                        ≈{' '}
                                        {formatearMoneda(
                                          precioConvertido,
                                          monedaVisualizacion,
                                        )}
                                      </span>
                                    )}

                                  {(oferta.precio12 !== null ||
                                    oferta.precio24 !== null) && (
                                    <span className="mt-0.5 block text-[9px] text-slate-400">
                                      {oferta.precio12 !== null
                                        ? `12+ ${formatearMoneda(
                                            oferta.precio12,
                                            oferta.moneda,
                                          )}`
                                        : ''}
                                      {oferta.precio12 !== null &&
                                      oferta.precio24 !== null
                                        ? ' · '
                                        : ''}
                                      {oferta.precio24 !== null
                                        ? `24+ ${formatearMoneda(
                                            oferta.precio24,
                                            oferta.moneda,
                                          )}`
                                        : ''}
                                    </span>
                                  )}

                                  <span
                                    className={`mt-0.5 block text-[9px] ${
                                      oferta.disponible
                                        ? 'text-emerald-700'
                                        : 'text-rose-500'
                                    }`}
                                  >
                                    {oferta.disponible
                                      ? 'Disponible'
                                      : oferta.estadoStock}
                                  </span>
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
                        mejorPrecioMostrado !== null ? (
                          <div className="min-w-[130px]">
                            <span className="text-[11px] font-semibold text-slate-800">
                              {formatearMoneda(
                                mejorPrecioMostrado,
                                monedaVisualizacion,
                              )}
                            </span>
                            <span className="mt-0.5 block text-[9px] font-medium text-emerald-700">
                              Mejor oferta · {mejorProveedor}
                            </span>

                            {item.brechaArbitrajePorcentaje !== null &&
                              item.brechaArbitrajePorcentaje >= 2 &&
                              item.proveedorSegundoMasBarato && (
                                <span
                                  title={
                                    ahorroArbitrajeMostrado !== null
                                      ? `Ahorro unitario: ${formatearMoneda(
                                          ahorroArbitrajeMostrado,
                                          monedaVisualizacion,
                                        )}`
                                      : undefined
                                  }
                                  className="mt-1 inline-flex items-center gap-1 rounded bg-violet-50 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700"
                                >
                                  <Zap size={9} />
                                  Ahorrás{' '}
                                  {item.brechaArbitrajePorcentaje.toFixed(1)}% vs{' '}
                                  {item.proveedorSegundoMasBarato}
                                </span>
                              )}

                            {costoMlMostrado !== null &&
                              costo100MlMostrado !== null && (
                                <span className="mt-0.5 block text-[9px] text-slate-400">
                                  {formatearMoneda(
                                    costoMlMostrado,
                                    monedaVisualizacion,
                                  )}
                                  /ml ·{' '}
                                  {formatearMoneda(
                                    costo100MlMostrado,
                                    monedaVisualizacion,
                                  )}
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
                                    className="h-6 w-20 rounded border border-violet-300 bg-white px-1.5 text-[11px] font-semibold text-slate-800 outline-none"
                                  />
                                  <button
                                    type="button"
                                    disabled={
                                      guardandoPrecioId === item.producto_id
                                    }
                                    onClick={() =>
                                      void confirmarPrecioManualFila(item)
                                    }
                                    title="Guardar precio manual en Supabase"
                                    className="flex size-6 items-center justify-center rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
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
                                <div className="flex flex-wrap items-center gap-1">
                                  <span className="text-[11px] font-semibold text-slate-800">
                                    PVP:{' '}
                                    {formatearMoneda(
                                      monedaVisualizacion === 'USD'
                                        ? rentabilidadProducto.precioVentaSugeridoUSD
                                        : rentabilidadProducto.precioVentaSugeridoARS,
                                      monedaVisualizacion,
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
                              )}

                              <span
                                className={`mt-0.5 block text-[9px] font-semibold ${
                                  rentabilidadProducto.gananciaNetaARS >= 0
                                    ? 'text-emerald-700'
                                    : 'text-rose-600'
                                }`}
                              >
                                {rentabilidadProducto.gananciaNetaARS >= 0
                                  ? '+'
                                  : ''}
                                {formatearMoneda(
                                  monedaVisualizacion === 'USD'
                                    ? rentabilidadProducto.gananciaNetaUSD
                                    : rentabilidadProducto.gananciaNetaARS,
                                  monedaVisualizacion,
                                )}{' '}
                                ({rentabilidadProducto.roiPorcentaje.toFixed(0)}%
                                ROI)
                              </span>

                              <a
                                href={urlMercadoLibre}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1 inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 transition hover:bg-amber-100"
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

function RentabilidadModal({
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

function AlertaWatchlistModal({
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

function ImportadorListasModal({
  proveedoresDisponibles,
  productosGlobales,
  onImportar,
  onCerrar,
}: {
  proveedoresDisponibles: string[]
  productosGlobales: ProductoComparado[]
  onImportar: (resumen: ResumenPrevisualizacionImportacion) => Promise<void>
  onCerrar: () => void
}) {
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState<string>(
    proveedoresDisponibles[0] ?? '__NUEVO__',
  )
  const [nuevoProveedor, setNuevoProveedor] = useState<string>('')
  const [moneda, setMoneda] = useState<Moneda>('USD')
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
    )
  }, [textoLista, proveedorFinal, moneda, productosGlobales])

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
      await onImportar({ ...resumen, proveedor: proveedorFinal })
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
                <table className="w-full border-collapse text-left text-[11px]">
                  <thead>
                    <tr className="bg-slate-50/70 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      <th className="px-3 py-2">Producto</th>
                      <th className="px-3 py-2">Impacto</th>
                      <th className="px-3 py-2">Precio</th>
                      <th className="px-3 py-2">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {resumen.items.slice(0, 50).map((item) => {
                      const badge = etiquetaEstado(item.estadoCambio)
                      return (
                        <tr key={`${item.fila.lineaNumero}-${item.fila.nombre}`}>
                          <td className="px-3 py-2">
                            <span className="font-semibold text-slate-800">
                              {item.marcaConsolidada} · {item.nombreConsolidado}
                            </span>
                            {item.fila.ml && (
                              <span className="ml-1 text-[10px] text-slate-400">
                                ({item.fila.ml}ml)
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex rounded px-1.5 py-0.5 text-[9px] font-semibold ${badge.clase}`}
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
                          <td className="px-3 py-2 text-[10px] text-slate-600">
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
