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
  IconoBotellaDesodorante,
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


export type VistaActiva = 'overview' | 'catalog' | 'history' | 'cart'

export const OPCIONES_TAMANO_PAGINA = [16, 32, 64, 128] as const
export const TAMANO_PAGINA_INICIAL = 32
export const MAX_TAMANO_PAGINA = 128
export const LIMITE_FILAS_RESUMEN = 15

export const TIPOS_PRODUCTO_DISPONIBLES: TipoProducto[] = [
  'Perfume',
  'Kit',
  'Body Splash',
  'Desodorante',
  'Crema',
  'Aceite',
  'Otro',
]

export function obtenerEstiloTipoProducto(tipo: TipoProducto): {
  cellClass: string
  badgeClass: string
} {
  if (tipo === 'Desodorante' || tipo === 'Body Splash') {
    return {
      cellClass: 'producto-tipo-perfume',
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

export const GENEROS_FILTRO: Array<{ etiqueta: string; valor: GeneroPerfume | null }> = [
  { etiqueta: 'Todos', valor: null },
  { etiqueta: 'Masculino', valor: 'Masculino' },
  { etiqueta: 'Femenino', valor: 'Femenino' },
  { etiqueta: 'Unisex', valor: 'Unisex' },
]

export const OPCIONES_ORDENAMIENTO: Array<{
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

export const OPCIONES_ESCALA: Array<{ etiqueta: string; valor: ModoEscalaMayorista }> = [
  { etiqueta: 'Automática', valor: 'AUTO' },
  { etiqueta: 'Lista Base', valor: 'BASE' },
  { etiqueta: 'Simular 12+', valor: '12+' },
  { etiqueta: 'Simular 24+', valor: '24+' },
]

export const COLORES_PROVEEDORES: Record<string, string> = {
  Milano: '#8264d8',
  Supa: '#4a86d9',
  Ambar: '#2a9a72',
}

export const PALETA_PROVEEDORES_EXTRA = ['#d97706', '#e11d48', '#0891b2', '#7c3aed']

export function obtenerColorProveedor(nombre: string, indice: number): string {
  return (
    COLORES_PROVEEDORES[nombre] ??
    PALETA_PROVEEDORES_EXTRA[indice % PALETA_PROVEEDORES_EXTRA.length]
  )
}

export function formatearMoneda(valor: number, moneda: Moneda): string {
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
export const FILAS_DEMO_RESPALDO: FilaVistaComparador[] = [
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

export function construirHistorialDemo(
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

export function ImagenFrasco({
  src,
  alt,
  className,
  tipo,
}: {
  src: string | null | undefined
  alt: string
  className: string
  tipo?: TipoProducto
}) {
  if (tipo === 'Desodorante') {
    return <IconoBotellaDesodorante className={className} title={alt} />
  }

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

export function SectionTitle({
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

export function GraficoEvolucionPrecios({
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

