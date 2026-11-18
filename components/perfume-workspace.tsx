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
  GitMerge,
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
  ModalFusionManual,
  ModalFusionPorId,
  ModalSugerenciasFusion,
} from '@/components/fusion-perfumes-modals'
import { detectarDuplicados, claveParDescartado, type ParFusion } from '@/lib/detectorDuplicados'
import {
  reapuntarDatosLocalesFusion,
  useDuplicadosDescartadosStore,
} from '@/store/useFusionPerfumes'
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
  actualizarCategoriaProducto,
  actualizarImagenProducto,
  actualizarPrecioVentaManualProducto,
  fusionarProductos,
  obtenerAliasProductos,
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
import { CatalogSection } from './perfume-catalog-section'
import { RentabilidadModal, AlertaWatchlistModal, ImportadorListasModal } from './perfume-modals'

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
  const [aliasProductos, setAliasProductos] = useState<AliasImportacion[]>([])
  const [productoFusionManual, setProductoFusionManual] =
    useState<ProductoComparado | null>(null)
  const [modalSugerenciasAbierto, setModalSugerenciasAbierto] = useState(false)
  const [modalFusionIdAbierto, setModalFusionIdAbierto] = useState(false)
  const paresDescartadosStore = useDuplicadosDescartadosStore((e) => e.pares)
  const descartarParDuplicado = useDuplicadosDescartadosStore(
    (e) => e.descartarPar,
  )
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

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const productoParam = params.get('producto')
    if (productoParam) {
      const id = Number(productoParam)
      if (Number.isFinite(id) && id > 0) {
        setProductoHistorialId(id)
        setHistorySupplierTab('GLOBAL')
        setView('history')
      }
    }
  }, [])
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

  // Fusiona sola los duplicados de alta confianza (mismo perfume con nombre levemente distinto)
  const autoFusionarAltaConfianza = useCallback(
    async (filas: FilaVistaComparador[]): Promise<number> => {
      const { altaConfianza } = detectarDuplicados(filas)
      let fusionados = 0
      for (const par of altaConfianza) {
        try {
          await fusionarProductos(par.origenId, par.destinoId, par.nombreFinal)
          reapuntarDatosLocalesFusion(
            par.origenId,
            par.destinoId,
            par.nombreFinal,
          )
          fusionados += 1
        } catch {
          // Si falla un par (p. ej. conflicto de proveedor) seguimos con el resto.
        }
      }
      if (fusionados > 0) {
        setMensajeSyncFotos(
          `Se fusionaron automáticamente ${fusionados} perfume(s) duplicado(s).`,
        )
        setTimeout(() => setMensajeSyncFotos(null), 6000)
      }
      return fusionados
    },
    [],
  )

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
      let filas = await obtenerTodoElCatalogo()
      if ((await autoFusionarAltaConfianza(filas)) > 0) {
        filas = await obtenerTodoElCatalogo()
      }
      setAliasProductos(await obtenerAliasProductos())
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
  }, [sincronizarPreciosManualesDesdeCatalogo, autoFusionarAltaConfianza])

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

    // Si la lista trajo duplicados evidentes de otro proveedor, se fusionan solos.
    if (!datos.modoDemo && (await autoFusionarAltaConfianza(nuevasFilas)) > 0) {
      await cargarCatalogo()
    }

    setMensajeSyncFotos(
      `Lista de ${resumen.proveedor} importada: ${resumen.items.length} ítems procesados (${resumen.conteoBajasPrecio} bajas, ${resumen.conteoSubasPrecio} subas, ${resumen.conteoNuevosProductos + resumen.conteoNuevasOfertas} nuevos).`,
    )
    setTimeout(() => setMensajeSyncFotos(null), 6000)
  }

  const sugerenciasFusion = useMemo(
    () =>
      detectarDuplicados(
        filasCatalogo,
        new Set(hidratado ? paresDescartadosStore : []),
      ).sugerencias,
    [filasCatalogo, hidratado, paresDescartadosStore],
  )

  const manejarFusionarPerfumes = useCallback(
    async (origenId: number, destinoId: number, nombreFinal: string) => {
      if (!usandoDemo) {
        await fusionarProductos(origenId, destinoId, nombreFinal)
      }
      reapuntarDatosLocalesFusion(origenId, destinoId, nombreFinal)
      setProductoFusionManual(null)
      await cargarCatalogo()
      setMensajeSyncFotos(`Perfumes fusionados en «${nombreFinal}».`)
      setTimeout(() => setMensajeSyncFotos(null), 5000)
    },
    [usandoDemo, cargarCatalogo],
  )

  const manejarFusionarPorId = useCallback(
    async (ids: number[], nombreFinal: string) => {
      // El destino es el perfume con más proveedores (en empate, el primer ID escrito)
      const ofertasDe = (id: number) =>
        productosGlobales.find((p) => p.producto_id === id)?.ofertas ?? {}
      const destinoId = [...ids].sort(
        (a, b) =>
          Object.keys(ofertasDe(b)).length - Object.keys(ofertasDe(a)).length,
      )[0]

      for (const origenId of ids.filter((id) => id !== destinoId)) {
        if (!usandoDemo) {
          await fusionarProductos(origenId, destinoId, nombreFinal)
        }
        reapuntarDatosLocalesFusion(origenId, destinoId, nombreFinal)
      }
      setModalFusionIdAbierto(false)
      await cargarCatalogo()
      setMensajeSyncFotos(`${ids.length} perfumes fusionados en «${nombreFinal}».`)
      setTimeout(() => setMensajeSyncFotos(null), 5000)
    },
    [productosGlobales, usandoDemo, cargarCatalogo],
  )

  const manejarCambiarCategoriaProducto = useCallback(
    async (
      producto: ProductoComparado,
      nuevaCategoria: CategoriaPerfume | null,
    ) => {
      const categoriaAnterior = producto.categoria ?? null
      setFilasCatalogo((previo) =>
        previo.map((fila) =>
          fila.producto_id === producto.producto_id
            ? { ...fila, categoria: nuevaCategoria }
            : fila,
        ),
      )

      try {
        if (!usandoDemo && estaSupabaseConfigurado()) {
          await actualizarCategoriaProducto(producto.producto_id, nuevaCategoria)
        }
      } catch (error) {
        setFilasCatalogo((previo) =>
          previo.map((fila) =>
            fila.producto_id === producto.producto_id
              ? { ...fila, categoria: categoriaAnterior }
              : fila,
          ),
        )
        setErrorCatalogo(
          error instanceof Error
            ? error.message
            : 'No se pudo actualizar la categoría del perfume.',
        )
      }
    },
    [usandoDemo],
  )

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
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('producto', String(item.producto_id))
      window.open(url.toString(), '_blank', 'noopener,noreferrer')
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
    (filtros.categoria ? 1 : 0) +
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
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-base font-extrabold text-green-600 shadow-xs">
            P
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
              onClick={() => setModalFusionIdAbierto(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-[10px] font-semibold text-slate-700 transition hover:bg-slate-50"
              aria-label="Fusionar perfumes por ID"
              title="Fusionar perfumes duplicados escribiendo sus ID"
            >
              <GitMerge size={12} />
              <span className="hidden md:inline">Fusionar por ID</span>
            </button>

            {sugerenciasFusion.length > 0 && (
              <button
                type="button"
                onClick={() => setModalSugerenciasAbierto(true)}
                className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-2 text-[10px] font-semibold text-violet-700 transition hover:bg-violet-100"
                aria-label="Revisar posibles perfumes duplicados"
                title="Revisar posibles perfumes duplicados"
              >
                <GitMerge size={12} />
                <span className="hidden md:inline">Duplicados</span>
                <span>({sugerenciasFusion.length})</span>
              </button>
            )}

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
                onCambiarCategoria={manejarCambiarCategoriaProducto}
                onFusionar={setProductoFusionManual}
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
              onCambiarCategoria={manejarCambiarCategoriaProducto}
                onFusionar={setProductoFusionManual}
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
                          onClick={() => {
                            setView('catalog')
                            if (typeof window !== 'undefined') {
                              const url = new URL(window.location.href)
                              if (url.searchParams.has('producto')) {
                                url.searchParams.delete('producto')
                                window.history.replaceState({}, '', url.toString())
                              }
                            }
                          }}
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
          alias={aliasProductos}
          onImportar={manejarAplicarImportacion}
          onCerrar={() => setModalImportadorAbierto(false)}
        />
      )}

      {modalFusionIdAbierto && (
        <ModalFusionPorId
          productos={productosGlobales}
          onFusionar={manejarFusionarPorId}
          onCerrar={() => setModalFusionIdAbierto(false)}
        />
      )}

      {productoFusionManual && (
        <ModalFusionManual
          producto={productoFusionManual}
          productos={productosGlobales}
          onFusionar={manejarFusionarPerfumes}
          onCerrar={() => setProductoFusionManual(null)}
        />
      )}

      {modalSugerenciasAbierto && (
        <ModalSugerenciasFusion
          sugerencias={sugerenciasFusion}
          onAceptar={(par: ParFusion) =>
            manejarFusionarPerfumes(par.origenId, par.destinoId, par.nombreFinal)
          }
          onDescartar={(par: ParFusion) =>
            descartarParDuplicado(claveParDescartado(par.origenId, par.destinoId))
          }
          onCerrar={() => setModalSugerenciasAbierto(false)}
        />
      )}
    </main>
  )
}

