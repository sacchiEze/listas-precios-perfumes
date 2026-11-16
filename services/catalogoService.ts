import { generarVariacionesRespaldo } from '@/lib/rentabilidad'
import { estaSupabaseConfigurado, supabase } from '@/lib/supabase/cliente'
import type {
  FilaVistaComparador,
  HistorialPrecioFila,
  MapaVariacionesPrecios,
  PuntoHistorialGrafico,
} from '@/types/perfumeria'

const TAMANO_PAGINA_SUPABASE = 1000

/**
 * Obtiene la totalidad del catálogo desde la vista `vista_comparador`.
 *
 * Nota técnica sobre paginación:
 * PostgREST (motor REST de Supabase) aplica un límite máximo por defecto de 1.000 filas
 * en cualquier consulta `.select('*')`. Como la combinación de productos por proveedor
 * supera fácilmente las 1.500 filas, iteramos en bloques de 1.000 registros mediante
 * `.range(desde, hasta)` con orden determinístico hasta recibir un bloque incompleto.
 */
export async function obtenerTodoElCatalogo(): Promise<FilaVistaComparador[]> {
  if (!estaSupabaseConfigurado()) {
    throw new Error(
      'Supabase no está configurado. Definí NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    )
  }

  const filasAcumuladas: FilaVistaComparador[] = []
  let desde = 0
  let hayMasPaginas = true

  while (hayMasPaginas) {
    const hasta = desde + TAMANO_PAGINA_SUPABASE - 1

    const { data, error } = await supabase
      .from('vista_comparador')
      .select('*')
      .order('producto_id', { ascending: true })
      .order('proveedor', { ascending: true })
      .range(desde, hasta)

    if (error) {
      throw new Error(`Error al consultar vista_comparador: ${error.message}`)
    }

    const paginaActual = (data ?? []) as FilaVistaComparador[]
    filasAcumuladas.push(...paginaActual)

    // Si Supabase devuelve menos filas que el tamaño de página, llegamos al final.
    if (paginaActual.length < TAMANO_PAGINA_SUPABASE) {
      hayMasPaginas = false
    } else {
      desde += TAMANO_PAGINA_SUPABASE
    }
  }

  return filasAcumuladas
}

/**
 * Consulta la evolución histórica de precios de un perfume en `historial_precios`
 * y la pivota por fecha para ser graficada en múltiples series con Recharts.
 *
 * Para cada proveedor genera:
 * - `${proveedor}_ARS`: precio normalizado a pesos argentinos usando `dolarDelDia`.
 * - `${proveedor}_USD`: precio normalizado a dólares estadounidenses usando `dolarDelDia`.
 * - `${proveedor}_ORIGEN`: precio original registrado por el proveedor en su moneda.
 */
export async function obtenerHistorialPorProducto(
  productoId: number,
  dolarDelDia: number,
): Promise<PuntoHistorialGrafico[]> {
  if (!estaSupabaseConfigurado()) {
    return []
  }

  const cotizacionSegura = dolarDelDia > 0 ? dolarDelDia : 1

  const { data, error } = await supabase
    .from('historial_precios')
    .select('id, producto_id, proveedor, moneda, precio_base, precio_12, precio_24, fecha')
    .eq('producto_id', productoId)
    .order('fecha', { ascending: true })

  if (error) {
    throw new Error(`Error al obtener historial del producto ${productoId}: ${error.message}`)
  }

  const filas = (data ?? []) as HistorialPrecioFila[]
  const mapaPorFecha = new Map<string, PuntoHistorialGrafico>()

  for (const fila of filas) {
    const puntoExistente = mapaPorFecha.get(fila.fecha) ?? { fecha: fila.fecha }

    const precioEnARS =
      fila.moneda === 'ARS'
        ? Number(fila.precio_base.toFixed(2))
        : Number((fila.precio_base * cotizacionSegura).toFixed(2))

    const precioEnUSD =
      fila.moneda === 'USD'
        ? Number(fila.precio_base.toFixed(2))
        : Number((fila.precio_base / cotizacionSegura).toFixed(2))

    puntoExistente[`${fila.proveedor}_ARS`] = precioEnARS
    puntoExistente[`${fila.proveedor}_USD`] = precioEnUSD
    puntoExistente[`${fila.proveedor}_ORIGEN`] = fila.precio_base

    mapaPorFecha.set(fila.fecha, puntoExistente)
  }

  return Array.from(mapaPorFecha.values())
}

/**
 * Consulta los últimos registros de `historial_precios` para calcular la variación porcentual
 * de cada oferta respecto a su precio previo registrado.
 */
export async function obtenerMapaVariacionesPrecios(
  filasActuales: FilaVistaComparador[],
): Promise<MapaVariacionesPrecios> {
  if (!estaSupabaseConfigurado()) {
    return generarVariacionesRespaldo(filasActuales)
  }

  const { data, error } = await supabase
    .from('historial_precios')
    .select('producto_id, proveedor, moneda, precio_base, fecha')
    .order('fecha', { ascending: false })
    .limit(3000)

  if (error) {
    return {}
  }

  const filasHistorial = (data ?? []) as Array<
    Pick<HistorialPrecioFila, 'producto_id' | 'proveedor' | 'moneda' | 'precio_base' | 'fecha'>
  >

  if (filasHistorial.length === 0) {
    return generarVariacionesRespaldo(filasActuales)
  }

  const historialPorOferta = new Map<
    string,
    Array<Pick<HistorialPrecioFila, 'moneda' | 'precio_base' | 'fecha'>>
  >()

  for (const registro of filasHistorial) {
    const clave = `${registro.producto_id}__${registro.proveedor}`
    const lista = historialPorOferta.get(clave) ?? []
    lista.push({
      moneda: registro.moneda,
      precio_base: registro.precio_base,
      fecha: registro.fecha,
    })
    historialPorOferta.set(clave, lista)
  }

  const mapa: MapaVariacionesPrecios = {}

  for (const fila of filasActuales) {
    if (fila.precio_base === null || fila.precio_base <= 0) continue

    const clave = `${fila.producto_id}__${fila.proveedor}`
    const serie = historialPorOferta.get(clave)
    if (!serie || serie.length === 0) continue

    const registrosMismaMoneda = serie.filter((r) => r.moneda === fila.moneda)
    if (registrosMismaMoneda.length === 0) continue

    let registroPrevio = registrosMismaMoneda.find(
      (r) => Math.abs(r.precio_base - fila.precio_base!) > 0.0001,
    )

    if (!registroPrevio && registrosMismaMoneda.length > 1) {
      registroPrevio = registrosMismaMoneda[1]
    }

    if (!registroPrevio || registroPrevio.precio_base <= 0) continue

    const variacionPorcentaje = Number(
      (
        ((fila.precio_base - registroPrevio.precio_base) /
          registroPrevio.precio_base) *
        100
      ).toFixed(1),
    )

    mapa[clave] = {
      precioAnterior: registroPrevio.precio_base,
      fechaAnterior: registroPrevio.fecha,
      variacionPorcentaje,
    }
  }

  return mapa
}

/**
 * Actualiza manualmente la URL de la imagen de un perfume en `catalogo_productos`
 * a través del Route Handler del servidor protegido por sesión.
 */
export async function actualizarImagenProducto(
  productoId: number,
  nuevaUrl: string,
): Promise<void> {
  if (!estaSupabaseConfigurado()) {
    throw new Error(
      'Supabase no está configurado. No se puede guardar la imagen en la base de datos.',
    )
  }

  const urlLimpia = nuevaUrl.trim()
  if (!urlLimpia) {
    throw new Error('La URL de la imagen no puede estar vacía.')
  }

  const respuesta = await fetch('/api/imagenes/actualizar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productoId, imagenUrl: urlLimpia }),
  })

  if (!respuesta.ok) {
    let mensajeError = `Error HTTP ${respuesta.status}`
    try {
      const datos = (await respuesta.json()) as { error?: string }
      if (datos?.error) {
        mensajeError = datos.error
      }
    } catch {
      // Mantenemos el mensaje por estado HTTP si no hay cuerpo JSON.
    }
    throw new Error(mensajeError)
  }
}

/**
 * Sube una imagen ya recortada (1:1) y optimizada en el cliente al servidor,
 * donde se almacena en Supabase Storage y se actualiza `catalogo_productos.imagen_url`.
 * Devuelve la URL pública final asignada al producto.
 */
export async function subirImagenProductoOptimizada(
  productoId: number,
  archivoOptimizado: Blob,
  nombreArchivo = 'perfume-1x1.webp',
): Promise<string> {
  if (!estaSupabaseConfigurado()) {
    throw new Error(
      'Supabase no está configurado. No se puede subir la imagen al servidor.',
    )
  }

  const formData = new FormData()
  formData.append('productoId', String(productoId))
  formData.append('archivo', archivoOptimizado, nombreArchivo)

  const respuesta = await fetch('/api/imagenes/subir', {
    method: 'POST',
    body: formData,
  })

  let datos: { ok?: boolean; imagenUrl?: string; error?: string } | null = null
  try {
    datos = (await respuesta.json()) as {
      ok?: boolean
      imagenUrl?: string
      error?: string
    }
  } catch {
    // Si la respuesta no es JSON válido, manejamos abajo el código HTTP
  }

  if (!respuesta.ok || !datos?.imagenUrl) {
    throw new Error(
      datos?.error ?? `Error al subir la imagen (HTTP ${respuesta.status})`,
    )
  }

  return datos.imagenUrl
}

/**
 * Persiste o elimina el precio de venta manual (en ARS) de un perfume en `catalogo_productos` en Supabase.
 */
export async function actualizarPrecioVentaManualProducto(
  productoId: number,
  precioVentaManualARS: number | null,
): Promise<void> {
  if (!estaSupabaseConfigurado()) {
    return
  }

  const respuesta = await fetch('/api/productos/precio-manual', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productoId, precioVentaManualARS }),
  })

  if (!respuesta.ok) {
    let mensajeError = `Error HTTP ${respuesta.status}`
    try {
      const datos = (await respuesta.json()) as { error?: string }
      if (datos?.error) {
        mensajeError = datos.error
      }
    } catch {
      // Mantenemos el mensaje por estado HTTP
    }
    throw new Error(mensajeError)
  }
}
