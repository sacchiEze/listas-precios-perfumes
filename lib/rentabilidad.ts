import type {
  CalculoRentabilidadUnitaria,
  ConfiguracionRentabilidad,
  FilaVistaComparador,
  MapaVariacionesPrecios,
  TipoProducto,
} from '@/types/perfumeria'

export interface CalculoCostoPerfume {
  costoBaseARS: number
  costoBaseUSD: number
  comisionUSD: number
  comisionARS: number
  envioAproximadoARS: number
  envioAproximadoUSD: number
  costoTotalARS: number
  costoTotalUSD: number
}

export interface EntradaCostoPerfume {
  costoBaseARS: number
  costoBaseUSD?: number | null
  comisionUSD: number
  envioAproximadoARS: number
  dolarDelDia: number
}

/**
 * Indica si un proveedor no tiene costos agregados (comisión/envío),
 * por lo que el precio en pesos de su lista ya es el costo final.
 */
export function esProveedorSinCostosAgregados(
  proveedor?: string | null,
): boolean {
  if (!proveedor) return false
  return proveedor.trim().toLowerCase() === 'supa'
}

/**
 * Resuelve los costos agregados aplicables a un proveedor específico.
 * Para proveedores sin costos agregados (como `supa`), devuelve 0 en ambos conceptos.
 */
export function obtenerCostosAgregadosParaProveedor(
  proveedor: string | null | undefined,
  config: Pick<
    ConfiguracionRentabilidad,
    'costoEnvioPorPerfumeUSD' | 'costoFijoEnvioEmbalajeARS'
  >,
): { comisionUSD: number; envioAproximadoARS: number } {
  if (esProveedorSinCostosAgregados(proveedor)) {
    return { comisionUSD: 0, envioAproximadoARS: 0 }
  }
  const comisionUSD =
    Number.isFinite(config.costoEnvioPorPerfumeUSD) &&
    config.costoEnvioPorPerfumeUSD > 0
      ? config.costoEnvioPorPerfumeUSD
      : 0
  const envioAproximadoARS =
    Number.isFinite(config.costoFijoEnvioEmbalajeARS) &&
    config.costoFijoEnvioEmbalajeARS > 0
      ? config.costoFijoEnvioEmbalajeARS
      : 0
  return { comisionUSD, envioAproximadoARS }
}

/**
 * Devuelve el recargo unitario total en ARS (comisión en USD + envío fijo en ARS)
 * que se suma al precio de lista de un proveedor al compararlo.
 */
export function obtenerRecargoUnitarioARS(
  proveedor: string | null | undefined,
  config: Pick<
    ConfiguracionRentabilidad,
    'costoEnvioPorPerfumeUSD' | 'costoFijoEnvioEmbalajeARS'
  >,
  dolarDelDia: number,
): number {
  const { comisionUSD, envioAproximadoARS } =
    obtenerCostosAgregadosParaProveedor(proveedor, config)
  if (comisionUSD === 0 && envioAproximadoARS === 0) return 0
  const cotizacionSegura =
    Number.isFinite(dolarDelDia) && dolarDelDia > 0 ? dolarDelDia : 1400
  return comisionUSD * cotizacionSegura + envioAproximadoARS
}

/**
 * Calcula en memoria el costo final por perfume sumando la comisión en USD
 * y el envío aproximado en ARS al precio base del proveedor.
 */
export function calcularCostoPerfume({
  costoBaseARS,
  costoBaseUSD,
  comisionUSD,
  envioAproximadoARS,
  dolarDelDia,
}: EntradaCostoPerfume): CalculoCostoPerfume {
  const cotizacionSegura =
    Number.isFinite(dolarDelDia) && dolarDelDia > 0 ? dolarDelDia : 1400
  const baseARS =
    Number.isFinite(costoBaseARS) && costoBaseARS > 0 ? costoBaseARS : 0
  const baseUSD =
    costoBaseUSD !== null &&
    costoBaseUSD !== undefined &&
    Number.isFinite(costoBaseUSD) &&
    costoBaseUSD > 0
      ? costoBaseUSD
      : baseARS / cotizacionSegura

  const comisionSeguraUSD =
    Number.isFinite(comisionUSD) && comisionUSD > 0 ? comisionUSD : 0
  const comisionARS = comisionSeguraUSD * cotizacionSegura

  const envioSeguroARS =
    Number.isFinite(envioAproximadoARS) && envioAproximadoARS > 0
      ? envioAproximadoARS
      : 0
  const envioUSD = envioSeguroARS / cotizacionSegura

  const costoTotalARS = baseARS + comisionARS + envioSeguroARS
  const costoTotalUSD = baseUSD + comisionSeguraUSD + envioUSD

  return {
    costoBaseARS: baseARS,
    costoBaseUSD: baseUSD,
    comisionUSD: comisionSeguraUSD,
    comisionARS,
    envioAproximadoARS: envioSeguroARS,
    envioAproximadoUSD: envioUSD,
    costoTotalARS,
    costoTotalUSD,
  }
}

export interface EntradaRentabilidadUnitaria {
  productoId?: number
  proveedor?: string | null
  costoARS: number
  costoUSD?: number | null
  costoCalculado?: CalculoCostoPerfume | null
  ml?: number | null
  tipo: TipoProducto
  dolarDelDia: number
  config: ConfiguracionRentabilidad
  precioVentaManualARS?: number | null
}

/**
 * Construye la URL directa de búsqueda en MercadoLibre Argentina para comparar el precio real de mercado.
 */
export function construirUrlBusquedaMercadoLibre({
  marca,
  nombre,
  concentracion,
  ml,
}: {
  marca: string
  nombre: string
  concentracion?: string | null
  ml?: number | null
}): string {
  const partes = [
    marca.trim(),
    nombre.trim(),
    concentracion && concentracion !== 'N/A' ? concentracion.trim() : '',
    ml !== null && ml !== undefined && ml > 0 ? `${ml}ml` : '',
  ].filter(Boolean)

  const slug = partes
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  return `https://listado.mercadolibre.com.ar/${encodeURIComponent(
    slug || 'perfume',
  )}`
}

const REGEX_ID_FRAGRANTICA_DESDE_IMAGEN =
  /fimgs\.net\/mdimg\/perfume(?:-thumbs)?\/(?:\d+x\d+|o|m|t|social)\.(\d+)\.(?:jpg|jpeg|png|webp)/i

function convertirASlugFragrantica(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
}

/**
 * Construye la URL hacia la ficha del perfume en Fragrantica en español (si la imagen oficial
 * de fimgs.net contiene el ID numérico de Fragrantica) o hacia el buscador de Fragrantica.
 */
export function construirUrlFragrantica({
  marca,
  nombre,
  imagenUrl,
}: {
  marca: string
  nombre: string
  imagenUrl?: string | null
}): string {
  const marcaLimpia = marca.trim() || 'Perfume'
  const nombreLimpio = nombre
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || nombre.trim()

  const coincidenciaId = imagenUrl?.match(REGEX_ID_FRAGRANTICA_DESDE_IMAGEN)
  if (coincidenciaId?.[1]) {
    const idPerfume = coincidenciaId[1]
    const marcaSlug = convertirASlugFragrantica(marcaLimpia) || 'Perfume'
    const nombreSlug = convertirASlugFragrantica(nombreLimpio) || 'Fragancia'
    return `https://www.fragrantica.es/perfume/${encodeURIComponent(
      marcaSlug,
    )}/${encodeURIComponent(nombreSlug)}-${idPerfume}.html`
  }

  const consulta = `${marcaLimpia} ${nombreLimpio}`.trim()
  return `https://www.fragrantica.es/buscar/?query=${encodeURIComponent(
    consulta,
  )}`
}

/**
 * Calcula precio sugerido de reventa, ganancia neta, ROI y costo por mililitro
 * contemplando comisión fija de retiro/envío en USD, gastos en ARS, ganancia fija adicional en ARS,
 * márgenes porcentuales y precio de venta manual por producto.
 */
export function calcularRentabilidadUnitaria({
  productoId,
  proveedor,
  costoARS,
  costoUSD,
  costoCalculado,
  ml,
  tipo,
  dolarDelDia,
  config,
  precioVentaManualARS,
}: EntradaRentabilidadUnitaria): CalculoRentabilidadUnitaria {
  const cotizacionSegura =
    Number.isFinite(dolarDelDia) && dolarDelDia > 0 ? dolarDelDia : 1400

  const { comisionUSD, envioAproximadoARS } =
    obtenerCostosAgregadosParaProveedor(proveedor, config)

  const resultadoCosto =
    costoCalculado ??
    calcularCostoPerfume({
      costoBaseARS: costoARS,
      costoBaseUSD: costoUSD,
      comisionUSD,
      envioAproximadoARS,
      dolarDelDia: cotizacionSegura,
    })

  const {
    costoBaseARS,
    costoBaseUSD,
    comisionARS: costoEnvioPorPerfumeARS,
    comisionUSD: costoEnvioPorPerfumeUSD,
    costoTotalARS,
    costoTotalUSD,
  } = resultadoCosto

  const margenBrutoConfig =
    config.margenPorTipo[tipo] ?? config.margenGeneralPorcentaje
  const margenPorcentaje =
    Number.isFinite(margenBrutoConfig) && margenBrutoConfig >= 0
      ? margenBrutoConfig
      : 0

  const gananciaFijaAdicionalARS =
    Number.isFinite(config.gananciaFijaAdicionalARS) &&
    config.gananciaFijaAdicionalARS > 0
      ? config.gananciaFijaAdicionalARS
      : 0

  const comisionBruta = Number.isFinite(config.comisionPlataformaPorcentaje)
    ? config.comisionPlataformaPorcentaje
    : 0
  const comisionClamped = Math.min(85, Math.max(0, comisionBruta))
  const factorRetencion = 1 - comisionClamped / 100

  const ingresoObjetivoARS =
    costoTotalARS * (1 + margenPorcentaje / 100) + gananciaFijaAdicionalARS
  const precioCalculadoFormulaARS =
    factorRetencion > 0
      ? ingresoObjetivoARS / factorRetencion
      : ingresoObjetivoARS
  const precioCalculadoFormulaUSD =
    precioCalculadoFormulaARS / cotizacionSegura

  const manualDesdeStore =
    productoId !== undefined &&
    config.preciosVentaManualesARS &&
    Number.isFinite(config.preciosVentaManualesARS[productoId]) &&
    config.preciosVentaManualesARS[productoId] > 0
      ? config.preciosVentaManualesARS[productoId]
      : null

  const manualEfectivoARS =
    precioVentaManualARS !== undefined &&
    precioVentaManualARS !== null &&
    Number.isFinite(precioVentaManualARS) &&
    precioVentaManualARS > 0
      ? precioVentaManualARS
      : manualDesdeStore

  const esPrecioManual = manualEfectivoARS !== null
  const precioVentaSugeridoARS =
    manualEfectivoARS !== null ? manualEfectivoARS : precioCalculadoFormulaARS
  const precioVentaSugeridoUSD = precioVentaSugeridoARS / cotizacionSegura

  const ingresoNetoARS = precioVentaSugeridoARS * factorRetencion
  const gananciaNetaARS = ingresoNetoARS - costoTotalARS
  const gananciaNetaUSD = gananciaNetaARS / cotizacionSegura
  const roiPorcentaje =
    costoTotalARS > 0 ? (gananciaNetaARS / costoTotalARS) * 100 : 0

  const mlValido = ml !== null && ml !== undefined && Number.isFinite(ml) && ml > 0
  const costoPorMlARS = mlValido ? costoBaseARS / ml : null
  const costoPorMlUSD = mlValido ? costoBaseUSD / ml : null
  const costoPor100MlARS = costoPorMlARS !== null ? costoPorMlARS * 100 : null
  const costoPor100MlUSD = costoPorMlUSD !== null ? costoPorMlUSD * 100 : null

  return {
    margenPorcentaje,
    costoBaseARS,
    costoBaseUSD,
    costoEnvioPorPerfumeARS,
    costoEnvioPorPerfumeUSD,
    gananciaFijaAdicionalARS,
    costoTotalARS,
    costoTotalUSD,
    precioCalculadoFormulaARS,
    precioCalculadoFormulaUSD,
    precioVentaSugeridoARS,
    precioVentaSugeridoUSD,
    esPrecioManual,
    gananciaNetaARS,
    gananciaNetaUSD,
    roiPorcentaje,
    costoPorMlARS,
    costoPorMlUSD,
    costoPor100MlARS,
    costoPor100MlUSD,
  }
}

/**
 * Genera variaciones porcentuales determinísticas de respaldo para modo Demo o
 * cuando la tabla `historial_precios` aún no tiene registros previos comparables.
 */
export function generarVariacionesRespaldo(
  filas: FilaVistaComparador[],
): MapaVariacionesPrecios {
  const mapa: MapaVariacionesPrecios = {}
  const deltasDemo = [-8.5, -5.2, 4.1, -3.4, 0, 6.8, -11.2, 2.5]

  for (const fila of filas) {
    if (fila.precio_base === null || fila.precio_base <= 0) continue

    let hashProveedor = 0
    for (let i = 0; i < fila.proveedor.length; i += 1) {
      hashProveedor += fila.proveedor.charCodeAt(i)
    }

    const indice = Math.abs(fila.producto_id * 7 + hashProveedor) % deltasDemo.length
    const delta = deltasDemo[indice]
    if (delta === 0) continue

    const precioAnterior = Number(
      (fila.precio_base / (1 + delta / 100)).toFixed(fila.moneda === 'USD' ? 2 : 0),
    )

    if (precioAnterior <= 0) continue

    const variacionPorcentaje = Number(
      (((fila.precio_base - precioAnterior) / precioAnterior) * 100).toFixed(1),
    )

    mapa[`${fila.producto_id}__${fila.proveedor}`] = {
      precioAnterior,
      fechaAnterior: '2026-11-07',
      variacionPorcentaje,
    }
  }

  return mapa
}
