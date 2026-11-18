/**
 * Contratos de datos y tipos estrictos para el comparador mayorista de perfumes.
 * Todos los tipos reflejan el esquema existente en Supabase (tablas y vista_comparador)
 * y las estructuras calculadas en memoria para el comparador, el historial y el carrito.
 */

/** Tipos de productos admitidos en el catálogo */
export type TipoProducto =
  | 'Perfume'
  | 'Kit'
  | 'Body Splash'
  | 'Desodorante'
  | 'Crema'
  | 'Aceite'
  | 'Otro'

/** Concentraciones posibles de una fragancia */
export type ConcentracionPerfume = 'EDP' | 'EDT' | 'Parfum' | 'Extrait' | 'N/A'

/** Géneros admitidos en el catálogo */
export type GeneroPerfume = 'Masculino' | 'Femenino' | 'Unisex'

/** Categorías / gamas de perfumes admitidas */
export type CategoriaPerfume =
  | 'Arabe'
  | 'Nicho'
  | 'Disenador'
  | 'Catalogo'
  | 'Asiatico'

/** Opciones de categoría con su etiqueta legible para la interfaz */
export const CATEGORIAS_PERFUME_OPCIONES: ReadonlyArray<{
  valor: CategoriaPerfume
  etiqueta: string
}> = [
  { valor: 'Arabe', etiqueta: 'Árabe' },
  { valor: 'Nicho', etiqueta: 'Nicho' },
  { valor: 'Disenador', etiqueta: 'Diseñador' },
  { valor: 'Catalogo', etiqueta: 'Catálogo' },
  { valor: 'Asiatico', etiqueta: 'Asiático' },
]

/** Valida en tiempo de ejecución si un valor corresponde a una categoría de perfume admitida */
export function esCategoriaPerfumeValida(
  valor: unknown,
): valor is CategoriaPerfume {
  return (
    valor === 'Arabe' ||
    valor === 'Nicho' ||
    valor === 'Disenador' ||
    valor === 'Catalogo' ||
    valor === 'Asiatico'
  )
}

/** Normaliza el nombre de una marca para indexarla de forma consistente */
export function normalizarClaveMarca(marca: string): string {
  return marca.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Configuración persistida por marca (categoría asignada y estado de eliminación permanente) */
export interface ConfiguracionMarca {
  marca_norm: string
  marca: string
  categoria: CategoriaPerfume | null
  eliminada: boolean
}

/** Tipo de lista de precios al importar */
export type TipoListaImportacion = CategoriaPerfume | 'Mixta'

/** Valor de filtro para categoría en el catálogo */
export type FiltroCategoriaPerfume = CategoriaPerfume | 'SIN_CATEGORIA' | null

/** Monedas soportadas por los proveedores y la visualización */
export type Moneda = 'ARS' | 'USD'

/** Estados de disponibilidad informados por cada proveedor */
export type EstadoStock = 'Disponible' | 'Agotado' | 'Proximamente'

/** Criterios de ordenamiento disponibles en el catálogo */
export type CriterioOrdenamiento =
  | 'precio_asc'
  | 'precio_desc'
  | 'costo_ml_asc'
  | 'mayor_baja'
  | 'mayor_brecha'
  | 'mayor_ganancia'
  | 'nombre_asc'
  | 'marca_asc'

/** Filtros rápidos de inteligencia de precios, watchlist y reposición */
export type FiltroInteligenciaPrecios =
  | 'TODOS'
  | 'BAJARON'
  | 'SUBIERON'
  | 'ARBITRAJE'
  | 'SEGUIMIENTO'
  | 'ALERTAS_ACTIVAS'
  | 'FALTA_REPONER'

/** Resumen de variación respecto al registro histórico previo */
export interface VariacionPrecioOferta {
  precioAnterior: number | null
  fechaAnterior: string | null
  variacionPorcentaje: number | null
}

/** Mapa indexado por `${producto_id}__${proveedor}` */
export type MapaVariacionesPrecios = Record<string, VariacionPrecioOferta>

/** Modos de cálculo de escala mayorista por proveedor en el carrito */
export type ModoEscalaMayorista = 'AUTO' | 'BASE' | '12+' | '24+'

/** Etiqueta legible de la escala efectivamente aplicada a un pedido */
export type EtiquetaEscalaAplicada = 'Base' | '12+' | '24+'

/** Registro exacto de la tabla `catalogo_productos` en Supabase */
export interface CatalogoProducto {
  id: number
  slug: string
  ean6: string | null
  marca: string
  nombre: string
  tipo: TipoProducto
  concentracion: ConcentracionPerfume | null
  ml: number | null
  genero: GeneroPerfume | null
  categoria?: CategoriaPerfume | null
  imagen_url: string | null
  precio_venta_manual_ars?: number | null
  created_at: string
}

/** Registro exacto de la tabla `precios_proveedores` en Supabase */
export interface PrecioProveedorFila {
  id: number
  producto_id: number
  proveedor: string
  moneda: Moneda
  precio_base: number | null
  precio_12: number | null
  precio_24: number | null
  estado_stock: EstadoStock
  updated_at: string
  precio_venta_manual_ars?: number | null
}

/** Registro exacto de la tabla `historial_precios` en Supabase */
export interface HistorialPrecioFila {
  id: number
  producto_id: number
  proveedor: string
  moneda: Moneda
  precio_base: number
  precio_12: number | null
  precio_24: number | null
  fecha: string
}

/** Mapeo exacto de una fila devuelta por la vista `vista_comparador` */
export interface FilaVistaComparador {
  producto_id: number
  ean6: string | null
  marca: string
  nombre: string
  tipo: TipoProducto
  concentracion: ConcentracionPerfume | null
  ml: number | null
  genero: GeneroPerfume | null
  categoria?: CategoriaPerfume | null
  imagen_url: string | null
  proveedor: string
  moneda: Moneda
  precio_base: number | null
  precio_12: number | null
  precio_24: number | null
  estado_stock: EstadoStock
  updated_at: string
  precio_venta_manual_ars?: number | null
}

/**
 * Datos de precio y stock de un proveedor específico para un producto,
 * incluyendo precios originales y normalizados en ARS y USD según la cotización del día.
 */
export interface OfertaProveedor {
  proveedor: string
  moneda: Moneda
  precioBase: number | null
  precio12: number | null
  precio24: number | null
  precioBaseEnARS: number | null
  precioBaseEnUSD: number | null
  precio12EnARS: number | null
  precio12EnUSD: number | null
  precio24EnARS: number | null
  precio24EnUSD: number | null
  estadoStock: EstadoStock
  disponible: boolean
  updatedAt: string
  precioAnterior: number | null
  fechaPrecioAnterior: string | null
  variacionPorcentaje: number | null
  costoPorMlARS: number | null
  costoPorMlUSD: number | null
}

/**
 * Entidad agrupada para la Pestaña Global del comparador.
 * Reúne los metadatos del perfume y todas sus ofertas indexadas por proveedor.
 */
export interface ProductoComparado {
  producto_id: number
  ean6: string | null
  marca: string
  nombre: string
  tipo: TipoProducto
  concentracion: ConcentracionPerfume | null
  ml: number | null
  genero: GeneroPerfume | null
  categoria: CategoriaPerfume | null
  imagen_url: string | null
  ofertas: Record<string, OfertaProveedor>
  mejorPrecioARS: number | null
  mejorPrecioUSD: number | null
  proveedorMasBarato: string | null
  tieneStockDisponible: boolean
  segundoMejorPrecioARS: number | null
  segundoMejorPrecioUSD: number | null
  proveedorSegundoMasBarato: string | null
  brechaArbitrajePorcentaje: number | null
  ahorroArbitrajeARS: number | null
  ahorroArbitrajeUSD: number | null
  variacionMejorPrecioPorcentaje: number | null
  menorVariacionPorcentaje: number | null
  mayorSubaPorcentaje: number | null
  mejorCostoPorMlARS: number | null
  mejorCostoPorMlUSD: number | null
  mejorCostoPor100MlARS: number | null
  mejorCostoPor100MlUSD: number | null
  precioVentaManualARS?: number | null
}

/**
 * Punto de historial pivotado por fecha para alimentar gráficos de Recharts.
 * Ejemplo: { fecha: '2026-11-14', Milano_ARS: 43400, Milano_USD: 31, Supa_ARS: 42000, ... }
 */
export interface PuntoHistorialGrafico {
  fecha: string
  [claveProveedor: string]: string | number | null
}

/** Estado completo de filtros y ordenamiento para el catálogo */
export interface FiltrosCatalogo {
  busqueda: string
  marcasSeleccionadas: string[]
  tiposSeleccionados: string[]
  genero: string | null
  categoria: FiltroCategoriaPerfume
  soloEnStock: boolean
  rangoPrecioARS: [number | null, number | null]
  ordenarPor: CriterioOrdenamiento
  pestanaActiva: 'GLOBAL' | string
  filtroInteligencia: FiltroInteligenciaPrecios
}

/** Vistas principales disponibles en el espacio de trabajo */
export type VistaActiva = 'overview' | 'catalog' | 'history' | 'cart'

/** Cantidad inicial de productos por página en el catálogo */
export const TAMANO_PAGINA_INICIAL = 32

/** Estado inicial por defecto para los filtros del catálogo */
export const FILTROS_CATALOGO_INICIALES: FiltrosCatalogo = {
  busqueda: '',
  marcasSeleccionadas: [],
  tiposSeleccionados: [],
  genero: null,
  categoria: null,
  soloEnStock: false,
  rangoPrecioARS: [null, null],
  ordenarPor: 'precio_asc',
  pestanaActiva: 'GLOBAL',
  filtroInteligencia: 'TODOS',
}

/** Ítem persistido dentro del carrito simulador multi-proveedor */
export interface ItemCarrito {
  productoId: number
  proveedor: string
  cantidad: number
  marca: string
  nombre: string
  concentracion: ConcentracionPerfume | null
  ml: number | null
  imagenUrl: string | null
  moneda: Moneda
  precioBase: number
  precio12: number | null
  precio24: number | null
}

/** Ítem del carrito con los cálculos de escala y subtotales aplicados */
export interface ItemCarritoCalculado extends ItemCarrito {
  precioUnitarioAplicado: number
  escalaItem: EtiquetaEscalaAplicada
  subtotalOrigen: number
  subtotalARS: number
  subtotalUSD: number
  ahorroUnitario: number
  ahorroTotal: number
}

/** Resumen agrupado de pedido y escalas mayoristas para un proveedor */
export interface ResumenProveedorCarrito {
  proveedor: string
  monedaOrigen: Moneda
  totalUnidades: number
  modoEscala: ModoEscalaMayorista
  escalaAplicada: EtiquetaEscalaAplicada
  items: ItemCarritoCalculado[]
  totalEnMonedaOrigen: number
  totalEnARS: number
  totalEnUSD: number
  ahorroTotalEnMonedaOrigen: number
}

/** Detalle individual del proceso de sincronización automática de imágenes */
export interface DetalleSincronizacionImagen {
  productoId: number
  marca: string
  nombre: string
  estado: 'actualizado' | 'sin_coincidencia' | 'error'
  imagenUrl: string | null
  motivo?: string
}

/** Respuesta JSON devuelta por POST /api/imagenes/sincronizar */
export interface ResultadoSincronizacionImagenes {
  procesados: number
  actualizados: number
  sinCoincidencia: number
  errores: number
  detalles: DetalleSincronizacionImagen[]
  mensaje: string
}

/** Parámetros configurables para calcular precios de reventa y rentabilidad */
export interface ConfiguracionRentabilidad {
  margenGeneralPorcentaje: number
  margenPorTipo: Partial<Record<TipoProducto, number>>
  comisionPlataformaPorcentaje: number
  costoFijoEnvioEmbalajeARS: number
  costoEnvioPorPerfumeUSD: number
  gananciaFijaAdicionalARS: number
  preciosVentaManualesARS: Record<number, number>
  mostrarRentabilidadEnCatalogo: boolean
}

/** Resultado detallado de rentabilidad unitaria para un producto */
export interface CalculoRentabilidadUnitaria {
  margenPorcentaje: number
  costoBaseARS: number
  costoBaseUSD: number
  costoEnvioPorPerfumeARS: number
  costoEnvioPorPerfumeUSD: number
  gananciaFijaAdicionalARS: number
  costoTotalARS: number
  costoTotalUSD: number
  precioCalculadoFormulaARS: number
  precioCalculadoFormulaUSD: number
  precioVentaSugeridoARS: number
  precioVentaSugeridoUSD: number
  esPrecioManual: boolean
  gananciaNetaARS: number
  gananciaNetaUSD: number
  roiPorcentaje: number
  costoPorMlARS: number | null
  costoPorMlUSD: number | null
  costoPor100MlARS: number | null
  costoPor100MlUSD: number | null
}

/** Producto guardado en el Watchlist con alertas de stock y precio objetivo */
export interface ItemWatchlist {
  productoId: number
  precioObjetivo: number | null
  monedaObjetivo: Moneda
  avisarStock: boolean
  avisarBajaPrecio: boolean
  nota?: string
  createdAt: string
}

/** Resultado de evaluar un ítem del Watchlist contra el catálogo actual */
export interface AlertaWatchlistEvaluada {
  item: ItemWatchlist
  producto: ProductoComparado
  cumplePrecioObjetivo: boolean
  cumpleStockDisponible: boolean
  cumpleBajaPrecio: boolean
  tieneAlertaActiva: boolean
  diferenciaObjetivoPorcentaje: number | null
}

/** Fuente seleccionada para la cotización del dólar del día */
export type TipoCotizacionDolar = 'manual' | 'blue' | 'mep' | 'oficial'

/** Últimas cotizaciones consultadas desde el proveedor de tipo de cambio */
export interface CotizacionesDolarDia {
  blue: number | null
  mep: number | null
  oficial: number | null
  updatedAt: string | null
  fuente: 'en_vivo' | 'respaldo'
}

/** Control de inventario propio del negocio por producto */
export interface RegistroStockPropio {
  productoId: number
  cantidadActual: number
  stockMinimo: number
  updatedAt: string
}

/** Fila interpretada de una lista de precios importada (CSV / TSV / texto) */
export interface FilaImportadaCruda {
  lineaNumero: number
  marca: string
  nombre: string
  ean6: string | null
  tipo: TipoProducto
  concentracion: ConcentracionPerfume | null
  ml: number | null
  genero: GeneroPerfume | null
  categoria: CategoriaPerfume | null
  precioBase: number
  precio12: number | null
  precio24: number | null
  estadoStock: EstadoStock
}

/** Clasificación del impacto de una fila importada frente al catálogo actual */
export type EstadoCambioImportacion =
  | 'nuevo_producto'
  | 'nueva_oferta'
  | 'bajo_precio'
  | 'subio_precio'
  | 'cambio_stock'
  | 'sin_cambios'

/** Fila enriquecida para la vista previa antes de aplicar una importación */
export interface ItemPrevisualizacionImportacion {
  fila: FilaImportadaCruda
  productoExistenteId: number | null
  nombreConsolidado: string
  marcaConsolidada: string
  estadoCambio: EstadoCambioImportacion
  precioAnterior: number | null
  variacionPorcentaje: number | null
  stockAnterior: EstadoStock | null
}

/** Resumen global de la previsualización de lista de proveedor */
export interface ResumenPrevisualizacionImportacion {
  proveedor: string
  moneda: Moneda
  tipoLista: TipoListaImportacion
  items: ItemPrevisualizacionImportacion[]
  conteoNuevosProductos: number
  conteoNuevasOfertas: number
  conteoBajasPrecio: number
  conteoSubasPrecio: number
  conteoCambiosStock: number
  conteoSinCambios: number
  erroresFormato: string[]
}
