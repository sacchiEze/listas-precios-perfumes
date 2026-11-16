import type {
  ConcentracionPerfume,
  EstadoCambioImportacion,
  EstadoStock,
  FilaImportadaCruda,
  FilaVistaComparador,
  GeneroPerfume,
  ItemPrevisualizacionImportacion,
  MapaVariacionesPrecios,
  Moneda,
  ProductoComparado,
  ResumenPrevisualizacionImportacion,
  TipoProducto,
} from '@/types/perfumeria'

export const PLANTILLA_EJEMPLO_IMPORTACION = [
  'Marca;Nombre;ML;Concentracion;PrecioBase;Precio12;Precio24;Stock',
  'Lattafa;Asad Bourbon;100;EDP;27.50;25.50;24.00;Disponible',
  'Afnan;9pm Elixir;100;Parfum;29.20;27.00;26.00;Disponible',
  'French Avenue;Liquid Brun;100;EDP;30.90;29.00;28.00;Disponible',
  'Lattafa;Khamrah Qahwa;100;EDP;28.40;26.50;25.00;Disponible',
  'Armaf;Club de Nuit Intense Man;105;EDT;31.50;29.80;28.50;Disponible',
].join('\n')

export function normalizarTextoImportacion(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function generarSlugProducto(
  marca: string,
  nombre: string,
  ml: number | null,
): string {
  const base = normalizarTextoImportacion(
    [marca, nombre, ml ? `${ml}ml` : ''].filter(Boolean).join(' '),
  )
    .replace(/\s+/g, '-')
    .slice(0, 72)

  return base || `perfume-${Date.now()}`
}

export function limpiarNumeroPrecio(raw: string | undefined): number | null {
  if (!raw) return null
  const limpio = raw
    .replace(/(usd|ars|u\$s|us\$|\$)/gi, '')
    .replace(/\s+/g, '')
    .trim()

  if (!limpio) return null

  const soloSignos = limpio.replace(/[^0-9.,]/g, '')
  if (!soloSignos) return null

  const ultimoPunto = soloSignos.lastIndexOf('.')
  const ultimaComa = soloSignos.lastIndexOf(',')

  let normalizado = soloSignos

  if (ultimoPunto >= 0 && ultimaComa >= 0) {
    if (ultimaComa > ultimoPunto) {
      normalizado = soloSignos.replace(/\./g, '').replace(',', '.')
    } else {
      normalizado = soloSignos.replace(/,/g, '')
    }
  } else if (ultimaComa >= 0) {
    if (/^\d{1,3}(,\d{3})+$/.test(soloSignos)) {
      normalizado = soloSignos.replace(/,/g, '')
    } else {
      normalizado = soloSignos.replace(',', '.')
    }
  } else if (ultimoPunto >= 0) {
    if (/^\d{1,3}(\.\d{3})+$/.test(soloSignos)) {
      normalizado = soloSignos.replace(/\./g, '')
    }
  }

  const numero = Number(normalizado)
  return Number.isFinite(numero) && numero > 0 ? numero : null
}

function detectarDelimitador(lineas: string[]): string {
  const candidatos = ['\t', ';', '|', ',']
  const muestra = lineas.slice(0, 5)

  let mejor = ';'
  let mejorPuntaje = -1

  for (const sep of candidatos) {
    const conteos = muestra.map((l) => l.split(sep).length - 1)
    const total = conteos.reduce((a, b) => a + b, 0)
    if (total === 0) continue
    const bonus = sep === '\t' || sep === ';' ? 1.2 : 1
    const puntaje = total * bonus
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje
      mejor = sep
    }
  }

  return mejor
}

function parsearLineaDelimitada(linea: string, sep: string): string[] {
  if (sep !== ',') {
    return linea.split(sep).map((c) => c.trim().replace(/^"|"$/g, ''))
  }

  const celdas: string[] = []
  let actual = ''
  let enComillas = false

  for (let i = 0; i < linea.length; i += 1) {
    const char = linea[i]
    if (char === '"') {
      enComillas = !enComillas
    } else if (char === sep && !enComillas) {
      celdas.push(actual.trim())
      actual = ''
    } else {
      actual += char
    }
  }
  celdas.push(actual.trim())
  return celdas
}

function parsearEstadoStock(valor?: string): EstadoStock {
  const norm = normalizarTextoImportacion(valor ?? '')
  if (!norm) return 'Disponible'
  if (
    norm.includes('agotado') ||
    norm.includes('sin stock') ||
    norm === 'no' ||
    norm === '0' ||
    norm.includes('falta')
  ) {
    return 'Agotado'
  }
  if (
    norm.includes('proximo') ||
    norm.includes('proximamente') ||
    norm.includes('pronto') ||
    norm.includes('llega')
  ) {
    return 'Proximamente'
  }
  return 'Disponible'
}

function parsearTipoProducto(valor?: string): TipoProducto {
  const norm = normalizarTextoImportacion(valor ?? '')
  if (norm.includes('kit') || norm.includes('set') || norm.includes('coffret')) {
    return 'Kit'
  }
  if (norm.includes('splash') || norm.includes('mist')) return 'Body Splash'
  if (norm.includes('desodorante') || norm.includes('deo')) return 'Desodorante'
  if (norm.includes('crema') || norm.includes('lotion')) return 'Crema'
  if (norm.includes('aceite') || norm.includes('oil')) return 'Aceite'
  if (norm === 'otro') return 'Otro'
  return 'Perfume'
}

function parsearConcentracion(valor?: string): ConcentracionPerfume | null {
  const norm = normalizarTextoImportacion(valor ?? '')
  if (!norm) return null
  if (norm.includes('extrait') || norm.includes('extract')) return 'Extrait'
  if (norm.includes('edp') || norm.includes('eau de parfum')) return 'EDP'
  if (norm.includes('edt') || norm.includes('eau de toilette')) return 'EDT'
  if (norm.includes('parfum')) return 'Parfum'
  if (norm === 'n a' || norm === 'na') return 'N/A'
  return null
}

function parsearGenero(valor?: string): GeneroPerfume | null {
  const norm = normalizarTextoImportacion(valor ?? '')
  if (!norm) return null
  if (
    norm.includes('masc') ||
    norm.includes('hombre') ||
    norm.includes('men') ||
    norm === 'm'
  ) {
    return 'Masculino'
  }
  if (
    norm.includes('fem') ||
    norm.includes('mujer') ||
    norm.includes('women') ||
    norm === 'f'
  ) {
    return 'Femenino'
  }
  if (norm.includes('unisex') || norm === 'u') return 'Unisex'
  return null
}

function extraerMetadatosDeTextoProducto(texto: string): {
  marcaInferida: string
  nombreLimpio: string
  ml: number | null
  concentracion: ConcentracionPerfume | null
} {
  let restante = texto.trim()

  let ml: number | null = null
  const matchMl = restante.match(/\b(\d{2,4})\s*ml\b/i)
  if (matchMl) {
    const val = Number(matchMl[1])
    if (Number.isFinite(val) && val > 0) ml = val
    restante = restante.replace(matchMl[0], ' ')
  }

  let concentracion: ConcentracionPerfume | null = null
  const matchConc = restante.match(/\b(Extrait|Parfum|EDP|EDT)\b/i)
  if (matchConc) {
    concentracion = parsearConcentracion(matchConc[1])
    restante = restante.replace(matchConc[0], ' ')
  }

  restante = restante.replace(/\s+/g, ' ').trim()

  const partes = restante.split(' ').filter(Boolean)
  if (partes.length >= 2) {
    return {
      marcaInferida: partes[0],
      nombreLimpio: partes.slice(1).join(' '),
      ml,
      concentracion,
    }
  }

  return {
    marcaInferida: 'Sin marca',
    nombreLimpio: restante,
    ml,
    concentracion,
  }
}

interface IndicesCabecera {
  marca?: number
  nombre?: number
  ean6?: number
  tipo?: number
  concentracion?: number
  ml?: number
  genero?: number
  precioBase?: number
  precio12?: number
  precio24?: number
  stock?: number
}

function detectarIndicesCabecera(celdas: string[]): IndicesCabecera | null {
  const indices: IndicesCabecera = {}
  let coincidencias = 0

  celdas.forEach((celda, idx) => {
    const h = normalizarTextoImportacion(celda)
    if (!h) return

    if (h === 'marca' || h === 'brand') {
      indices.marca = idx
      coincidencias += 1
    } else if (
      h === 'nombre' ||
      h === 'producto' ||
      h === 'perfume' ||
      h === 'fragancia' ||
      h === 'descripcion' ||
      h === 'item'
    ) {
      indices.nombre = idx
      coincidencias += 1
    } else if (h.includes('ean') || h === 'codigo' || h === 'sku') {
      indices.ean6 = idx
      coincidencias += 1
    } else if (h === 'tipo' || h === 'categoria') {
      indices.tipo = idx
      coincidencias += 1
    } else if (h.includes('conc')) {
      indices.concentracion = idx
      coincidencias += 1
    } else if (h === 'ml' || h === 'tamano' || h === 'volumen') {
      indices.ml = idx
      coincidencias += 1
    } else if (h === 'genero' || h === 'sexo') {
      indices.genero = idx
      coincidencias += 1
    } else if (
      h === 'preciobase' ||
      h === 'precio base' ||
      h === 'precio' ||
      h === 'base' ||
      h === 'valor' ||
      h === 'unitario' ||
      h === 'costo'
    ) {
      indices.precioBase = idx
      coincidencias += 1
    } else if (h.includes('12')) {
      indices.precio12 = idx
      coincidencias += 1
    } else if (h.includes('24')) {
      indices.precio24 = idx
      coincidencias += 1
    } else if (h.includes('stock') || h === 'estado' || h === 'disponible') {
      indices.stock = idx
      coincidencias += 1
    }
  })

  if (coincidencias >= 2 && (indices.nombre !== undefined || indices.precioBase !== undefined)) {
    return indices
  }
  return null
}

/**
 * Parsea texto crudo de una lista de precios (CSV, TSV de Excel/Sheets o texto separado por `;`/`|`)
 * devolviendo las filas estructuradas y eventuales errores de formato por línea.
 */
export function parsearTextoListaProveedor(texto: string): {
  filas: FilaImportadaCruda[]
  errores: string[]
} {
  const lineasCrudas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  if (lineasCrudas.length === 0) {
    return { filas: [], errores: [] }
  }

  const sep = detectarDelimitador(lineasCrudas)
  const primeraCeldas = parsearLineaDelimitada(lineasCrudas[0], sep)
  const cabecera = detectarIndicesCabecera(primeraCeldas)

  const inicio = cabecera ? 1 : 0
  const filas: FilaImportadaCruda[] = []
  const errores: string[] = []

  for (let i = inicio; i < lineasCrudas.length; i += 1) {
    const lineaNumero = i + 1
    const celdas = parsearLineaDelimitada(lineasCrudas[i], sep)

    if (celdas.length < 2) {
      errores.push(`Línea ${lineaNumero}: se esperaban al menos 2 columnas.`)
      continue
    }

    let marca = ''
    let nombre = ''
    let ean6: string | null = null
    let tipo: TipoProducto = 'Perfume'
    let concentracion: ConcentracionPerfume | null = null
    let ml: number | null = null
    let genero: GeneroPerfume | null = null
    let precioBase: number | null = null
    let precio12: number | null = null
    let precio24: number | null = null
    let estadoStock: EstadoStock = 'Disponible'

    if (cabecera) {
      marca = (cabecera.marca !== undefined ? celdas[cabecera.marca] : '')?.trim() ?? ''
      nombre = (cabecera.nombre !== undefined ? celdas[cabecera.nombre] : '')?.trim() ?? ''
      ean6 = cabecera.ean6 !== undefined ? celdas[cabecera.ean6]?.trim() || null : null
      tipo = parsearTipoProducto(cabecera.tipo !== undefined ? celdas[cabecera.tipo] : undefined)
      concentracion = parsearConcentracion(
        cabecera.concentracion !== undefined ? celdas[cabecera.concentracion] : undefined,
      )
      const mlRaw = cabecera.ml !== undefined ? Number(celdas[cabecera.ml]) : NaN
      ml = Number.isFinite(mlRaw) && mlRaw > 0 ? Math.round(mlRaw) : null
      genero = parsearGenero(cabecera.genero !== undefined ? celdas[cabecera.genero] : undefined)
      precioBase = limpiarNumeroPrecio(
        cabecera.precioBase !== undefined ? celdas[cabecera.precioBase] : undefined,
      )
      precio12 = limpiarNumeroPrecio(
        cabecera.precio12 !== undefined ? celdas[cabecera.precio12] : undefined,
      )
      precio24 = limpiarNumeroPrecio(
        cabecera.precio24 !== undefined ? celdas[cabecera.precio24] : undefined,
      )
      estadoStock = parsearEstadoStock(
        cabecera.stock !== undefined ? celdas[cabecera.stock] : undefined,
      )

      if (!marca && nombre) {
        const meta = extraerMetadatosDeTextoProducto(nombre)
        marca = meta.marcaInferida
        nombre = meta.nombreLimpio
        if (ml === null) ml = meta.ml
        if (!concentracion) concentracion = meta.concentracion
      }
    } else if (celdas.length === 2) {
      const meta = extraerMetadatosDeTextoProducto(celdas[0])
      marca = meta.marcaInferida
      nombre = meta.nombreLimpio
      ml = meta.ml
      concentracion = meta.concentracion
      precioBase = limpiarNumeroPrecio(celdas[1])
    } else if (celdas.length === 3) {
      marca = celdas[0].trim()
      const meta = extraerMetadatosDeTextoProducto(celdas[1])
      nombre = meta.nombreLimpio || celdas[1].trim()
      if (!marca) marca = meta.marcaInferida
      ml = meta.ml
      concentracion = meta.concentracion
      precioBase = limpiarNumeroPrecio(celdas[2])
    } else {
      marca = celdas[0].trim()
      const meta = extraerMetadatosDeTextoProducto(celdas[1])
      nombre = meta.nombreLimpio || celdas[1].trim()
      ml = meta.ml
      concentracion = meta.concentracion
      precioBase = limpiarNumeroPrecio(celdas[2])
      precio12 = limpiarNumeroPrecio(celdas[3])
      precio24 = celdas.length >= 5 ? limpiarNumeroPrecio(celdas[4]) : null
      if (celdas.length >= 6) {
        estadoStock = parsearEstadoStock(celdas[5])
      } else if (celdas.length >= 4 && precio12 === null) {
        estadoStock = parsearEstadoStock(celdas[3])
      }
    }

    if (!nombre || precioBase === null) {
      errores.push(
        `Línea ${lineaNumero}: falta el nombre o un precio base válido.`,
      )
      continue
    }

    filas.push({
      lineaNumero,
      marca: marca || 'Sin marca',
      nombre,
      ean6,
      tipo,
      concentracion,
      ml,
      genero,
      precioBase,
      precio12,
      precio24,
      estadoStock,
    })
  }

  return { filas, errores }
}

/**
 * Cruza las filas importadas contra el catálogo actual para previsualizar exactamente
 * qué productos son nuevos, cuáles bajaron o subieron de precio y cuáles cambiaron de stock.
 */
export function generarPrevisualizacionImportacion(
  texto: string,
  proveedor: string,
  moneda: Moneda,
  productosExistentes: ProductoComparado[],
): ResumenPrevisualizacionImportacion {
  const { filas, errores } = parsearTextoListaProveedor(texto)
  const proveedorLimpio = proveedor.trim() || 'Nuevo Proveedor'

  const porEan = new Map<string, ProductoComparado>()
  const porMarcaNombre = new Map<string, ProductoComparado>()
  const porNombreSolo = new Map<string, ProductoComparado>()

  for (const prod of productosExistentes) {
    if (prod.ean6) {
      porEan.set(normalizarTextoImportacion(prod.ean6), prod)
    }
    const claveFull = normalizarTextoImportacion(`${prod.marca} ${prod.nombre}`)
    porMarcaNombre.set(claveFull, prod)
    porNombreSolo.set(normalizarTextoImportacion(prod.nombre), prod)
  }

  let conteoNuevosProductos = 0
  let conteoNuevasOfertas = 0
  let conteoBajasPrecio = 0
  let conteoSubasPrecio = 0
  let conteoCambiosStock = 0
  let conteoSinCambios = 0

  const items: ItemPrevisualizacionImportacion[] = filas.map((fila) => {
    let match: ProductoComparado | undefined

    if (fila.ean6) {
      match = porEan.get(normalizarTextoImportacion(fila.ean6))
    }
    if (!match) {
      const claveFull = normalizarTextoImportacion(`${fila.marca} ${fila.nombre}`)
      match =
        porMarcaNombre.get(claveFull) ??
        porNombreSolo.get(normalizarTextoImportacion(fila.nombre))
    }

    if (!match) {
      conteoNuevosProductos += 1
      return {
        fila,
        productoExistenteId: null,
        nombreConsolidado: fila.nombre,
        marcaConsolidada: fila.marca,
        estadoCambio: 'nuevo_producto',
        precioAnterior: null,
        variacionPorcentaje: null,
        stockAnterior: null,
      }
    }

    const ofertaActual = match.ofertas[proveedorLimpio]
    if (!ofertaActual || ofertaActual.precioBase === null) {
      conteoNuevasOfertas += 1
      return {
        fila,
        productoExistenteId: match.producto_id,
        nombreConsolidado: match.nombre,
        marcaConsolidada: match.marca,
        estadoCambio: 'nueva_oferta',
        precioAnterior: null,
        variacionPorcentaje: null,
        stockAnterior: ofertaActual?.estadoStock ?? null,
      }
    }

    const precioAnterior = ofertaActual.precioBase
    const variacionPorcentaje =
      precioAnterior > 0
        ? Number(
            (
              ((fila.precioBase - precioAnterior) / precioAnterior) *
              100
            ).toFixed(1),
          )
        : null

    let estadoCambio: EstadoCambioImportacion = 'sin_cambios'
    if (variacionPorcentaje !== null && variacionPorcentaje <= -0.1) {
      estadoCambio = 'bajo_precio'
      conteoBajasPrecio += 1
    } else if (variacionPorcentaje !== null && variacionPorcentaje >= 0.1) {
      estadoCambio = 'subio_precio'
      conteoSubasPrecio += 1
    } else if (fila.estadoStock !== ofertaActual.estadoStock) {
      estadoCambio = 'cambio_stock'
      conteoCambiosStock += 1
    } else {
      conteoSinCambios += 1
    }

    return {
      fila,
      productoExistenteId: match.producto_id,
      nombreConsolidado: match.nombre,
      marcaConsolidada: match.marca,
      estadoCambio,
      precioAnterior,
      variacionPorcentaje,
      stockAnterior: ofertaActual.estadoStock,
    }
  })

  return {
    proveedor: proveedorLimpio,
    moneda,
    items,
    conteoNuevosProductos,
    conteoNuevasOfertas,
    conteoBajasPrecio,
    conteoSubasPrecio,
    conteoCambiosStock,
    conteoSinCambios,
    erroresFormato: errores,
  }
}

/**
 * Aplica en memoria los cambios de una previsualización sobre `filasCatalogo`
 * y genera las entradas de variación de precios para reflejarlas de inmediato en la UI.
 */
export function aplicarImportacionEnMemoria(
  filasActuales: FilaVistaComparador[],
  resumen: ResumenPrevisualizacionImportacion,
  idsAsignados?: Record<number, number>,
): {
  nuevasFilas: FilaVistaComparador[]
  nuevasVariaciones: MapaVariacionesPrecios
} {
  const ahoraIso = new Date().toISOString()
  const fechaHoy = ahoraIso.slice(0, 10)
  let siguienteIdLocal =
    filasActuales.reduce((max, f) => Math.max(max, f.producto_id), 0) + 1

  const mapaFilas = new Map<string, FilaVistaComparador>()
  const plantillaPorProducto = new Map<number, FilaVistaComparador>()

  for (const fila of filasActuales) {
    mapaFilas.set(`${fila.producto_id}__${fila.proveedor}`, fila)
    if (!plantillaPorProducto.has(fila.producto_id)) {
      plantillaPorProducto.set(fila.producto_id, fila)
    }
  }

  const nuevasVariaciones: MapaVariacionesPrecios = {}

  for (const item of resumen.items) {
    const productoId =
      item.productoExistenteId ??
      idsAsignados?.[item.fila.lineaNumero] ??
      siguienteIdLocal++

    const clave = `${productoId}__${resumen.proveedor}`
    const existente = mapaFilas.get(clave)
    const plantilla = plantillaPorProducto.get(productoId)

    const filaActualizada: FilaVistaComparador = {
      producto_id: productoId,
      ean6: existente?.ean6 ?? plantilla?.ean6 ?? item.fila.ean6,
      marca: existente?.marca ?? plantilla?.marca ?? item.marcaConsolidada,
      nombre: existente?.nombre ?? plantilla?.nombre ?? item.nombreConsolidado,
      tipo: existente?.tipo ?? plantilla?.tipo ?? item.fila.tipo,
      concentracion:
        existente?.concentracion ??
        plantilla?.concentracion ??
        item.fila.concentracion,
      ml: existente?.ml ?? plantilla?.ml ?? item.fila.ml,
      genero: existente?.genero ?? plantilla?.genero ?? item.fila.genero,
      imagen_url: existente?.imagen_url ?? plantilla?.imagen_url ?? null,
      proveedor: resumen.proveedor,
      moneda: resumen.moneda,
      precio_base: item.fila.precioBase,
      precio_12: item.fila.precio12,
      precio_24: item.fila.precio24,
      estado_stock: item.fila.estadoStock,
      updated_at: ahoraIso,
      precio_venta_manual_ars:
        existente?.precio_venta_manual_ars ??
        plantilla?.precio_venta_manual_ars ??
        null,
    }

    mapaFilas.set(clave, filaActualizada)
    if (!plantillaPorProducto.has(productoId)) {
      plantillaPorProducto.set(productoId, filaActualizada)
    }

    if (
      item.precioAnterior !== null &&
      item.variacionPorcentaje !== null &&
      Math.abs(item.variacionPorcentaje) >= 0.1
    ) {
      nuevasVariaciones[clave] = {
        precioAnterior: item.precioAnterior,
        fechaAnterior: fechaHoy,
        variacionPorcentaje: item.variacionPorcentaje,
      }
    }
  }

  return {
    nuevasFilas: Array.from(mapaFilas.values()),
    nuevasVariaciones,
  }
}
