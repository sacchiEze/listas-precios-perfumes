'use client'

import { useMemo } from 'react'
import { calcularRentabilidadUnitaria } from '@/lib/rentabilidad'
import { CONFIG_RENTABILIDAD_INICIAL } from '@/store/useConfiguracionStore'
import type {
  ConfiguracionRentabilidad,
  FilaVistaComparador,
  FiltrosCatalogo,
  MapaVariacionesPrecios,
  Moneda,
  OfertaProveedor,
  ProductoComparado,
  TipoProducto,
  VariacionPrecioOferta,
} from '@/types/perfumeria'

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

export interface OpcionesExtrasCatalogo {
  mapaVariaciones?: MapaVariacionesPrecios
  idsWatchlist?: Set<number>
  idsAlertasActivas?: Set<number>
  idsFaltaReponer?: Set<number>
  configRentabilidad?: ConfiguracionRentabilidad
}

interface ResultadoHookCatalogo {
  productos: ProductoComparado[]
  totalSinFiltrar: number
  proveedoresDisponibles: string[]
  marcasDisponibles: string[]
  tiposDisponibles: TipoProducto[]
}

/**
 * Normaliza un texto para búsqueda tolerante a errores:
 * convierte a minúsculas, elimina tildes/diacríticos y limpia símbolos especiales.
 */
export function normalizarTextoBusqueda(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function convertirPrecios(
  precio: number | null,
  moneda: Moneda,
  cotizacionDolar: number,
): { enARS: number | null; enUSD: number | null } {
  if (precio === null || !Number.isFinite(precio)) {
    return { enARS: null, enUSD: null }
  }

  if (moneda === 'ARS') {
    return {
      enARS: Number(precio.toFixed(2)),
      enUSD: Number((precio / cotizacionDolar).toFixed(4)),
    }
  }

  return {
    enARS: Number((precio * cotizacionDolar).toFixed(2)),
    enUSD: Number(precio.toFixed(4)),
  }
}

function calcularCostosPorMl(
  precioARS: number | null,
  precioUSD: number | null,
  ml: number | null,
): {
  porMlARS: number | null
  porMlUSD: number | null
  por100MlARS: number | null
  por100MlUSD: number | null
} {
  if (ml === null || !Number.isFinite(ml) || ml <= 0) {
    return {
      porMlARS: null,
      porMlUSD: null,
      por100MlARS: null,
      por100MlUSD: null,
    }
  }

  const porMlARS =
    precioARS !== null && Number.isFinite(precioARS) ? precioARS / ml : null
  const porMlUSD =
    precioUSD !== null && Number.isFinite(precioUSD) ? precioUSD / ml : null

  return {
    porMlARS,
    porMlUSD,
    por100MlARS: porMlARS !== null ? porMlARS * 100 : null,
    por100MlUSD: porMlUSD !== null ? porMlUSD * 100 : null,
  }
}

function crearOfertaNormalizada(
  fila: FilaVistaComparador,
  cotizacionDolar: number,
  variacion?: VariacionPrecioOferta,
): OfertaProveedor {
  const base = convertirPrecios(fila.precio_base, fila.moneda, cotizacionDolar)
  const escala12 = convertirPrecios(fila.precio_12, fila.moneda, cotizacionDolar)
  const escala24 = convertirPrecios(fila.precio_24, fila.moneda, cotizacionDolar)
  const mlCostos = calcularCostosPorMl(base.enARS, base.enUSD, fila.ml)

  return {
    proveedor: fila.proveedor,
    moneda: fila.moneda,
    precioBase: fila.precio_base,
    precio12: fila.precio_12,
    precio24: fila.precio_24,
    precioBaseEnARS: base.enARS,
    precioBaseEnUSD: base.enUSD,
    precio12EnARS: escala12.enARS,
    precio12EnUSD: escala12.enUSD,
    precio24EnARS: escala24.enARS,
    precio24EnUSD: escala24.enUSD,
    estadoStock: fila.estado_stock,
    disponible: fila.estado_stock === 'Disponible' && fila.precio_base !== null,
    updatedAt: fila.updated_at,
    precioAnterior: variacion?.precioAnterior ?? null,
    fechaPrecioAnterior: variacion?.fechaAnterior ?? null,
    variacionPorcentaje: variacion?.variacionPorcentaje ?? null,
    costoPorMlARS: mlCostos.porMlARS,
    costoPorMlUSD: mlCostos.porMlUSD,
  }
}

function seleccionarMejorOferta(
  ofertas: OfertaProveedor[],
  ml: number | null,
): Pick<
  ProductoComparado,
  | 'mejorPrecioARS'
  | 'mejorPrecioUSD'
  | 'proveedorMasBarato'
  | 'tieneStockDisponible'
  | 'segundoMejorPrecioARS'
  | 'segundoMejorPrecioUSD'
  | 'proveedorSegundoMasBarato'
  | 'brechaArbitrajePorcentaje'
  | 'ahorroArbitrajeARS'
  | 'ahorroArbitrajeUSD'
  | 'variacionMejorPrecioPorcentaje'
  | 'menorVariacionPorcentaje'
  | 'mayorSubaPorcentaje'
  | 'mejorCostoPorMlARS'
  | 'mejorCostoPorMlUSD'
  | 'mejorCostoPor100MlARS'
  | 'mejorCostoPor100MlUSD'
> {
  const variaciones = ofertas
    .map((oferta) => oferta.variacionPorcentaje)
    .filter((v): v is number => v !== null && Number.isFinite(v))

  const menorVariacionPorcentaje =
    variaciones.length > 0 ? Math.min(...variaciones) : null
  const mayorSubaPorcentaje =
    variaciones.length > 0 ? Math.max(...variaciones) : null

  const disponiblesConPrecio = ofertas
    .filter((oferta) => oferta.disponible && oferta.precioBaseEnARS !== null)
    .sort((a, b) => (a.precioBaseEnARS ?? Infinity) - (b.precioBaseEnARS ?? Infinity))

  const todasConPrecio = ofertas
    .filter((oferta) => oferta.precioBaseEnARS !== null)
    .sort((a, b) => (a.precioBaseEnARS ?? Infinity) - (b.precioBaseEnARS ?? Infinity))

  if (disponiblesConPrecio.length > 0) {
    const ganadora = disponiblesConPrecio[0]
    const mejorARS = ganadora.precioBaseEnARS
    const mejorUSD = ganadora.precioBaseEnUSD

    const segundaOferta =
      disponiblesConPrecio[1] ??
      todasConPrecio.find(
        (oferta) =>
          oferta.proveedor !== ganadora.proveedor &&
          (oferta.precioBaseEnARS ?? 0) >= (mejorARS ?? 0),
      )

    const segundoARS = segundaOferta?.precioBaseEnARS ?? null
    const segundoUSD = segundaOferta?.precioBaseEnUSD ?? null

    let brechaArbitrajePorcentaje: number | null = null
    let ahorroArbitrajeARS: number | null = null
    let ahorroArbitrajeUSD: number | null = null

    if (
      mejorARS !== null &&
      segundoARS !== null &&
      segundoARS > 0 &&
      segundoARS >= mejorARS
    ) {
      ahorroArbitrajeARS = Number((segundoARS - mejorARS).toFixed(2))
      if (mejorUSD !== null && segundoUSD !== null) {
        ahorroArbitrajeUSD = Number((segundoUSD - mejorUSD).toFixed(4))
      }
      brechaArbitrajePorcentaje = Number(
        (((segundoARS - mejorARS) / segundoARS) * 100).toFixed(1),
      )
    }

    const mlCostos = calcularCostosPorMl(mejorARS, mejorUSD, ml)

    return {
      mejorPrecioARS: mejorARS,
      mejorPrecioUSD: mejorUSD,
      proveedorMasBarato: ganadora.proveedor,
      tieneStockDisponible: true,
      segundoMejorPrecioARS: segundoARS,
      segundoMejorPrecioUSD: segundoUSD,
      proveedorSegundoMasBarato: segundaOferta?.proveedor ?? null,
      brechaArbitrajePorcentaje,
      ahorroArbitrajeARS,
      ahorroArbitrajeUSD,
      variacionMejorPrecioPorcentaje: ganadora.variacionPorcentaje,
      menorVariacionPorcentaje,
      mayorSubaPorcentaje,
      mejorCostoPorMlARS: mlCostos.porMlARS,
      mejorCostoPorMlUSD: mlCostos.porMlUSD,
      mejorCostoPor100MlARS: mlCostos.por100MlARS,
      mejorCostoPor100MlUSD: mlCostos.por100MlUSD,
    }
  }

  if (todasConPrecio.length > 0) {
    const menorReferencia = todasConPrecio[0]
    const mlCostos = calcularCostosPorMl(
      menorReferencia.precioBaseEnARS,
      menorReferencia.precioBaseEnUSD,
      ml,
    )
    return {
      mejorPrecioARS: menorReferencia.precioBaseEnARS,
      mejorPrecioUSD: menorReferencia.precioBaseEnUSD,
      proveedorMasBarato: null,
      tieneStockDisponible: false,
      segundoMejorPrecioARS: null,
      segundoMejorPrecioUSD: null,
      proveedorSegundoMasBarato: null,
      brechaArbitrajePorcentaje: null,
      ahorroArbitrajeARS: null,
      ahorroArbitrajeUSD: null,
      variacionMejorPrecioPorcentaje: menorReferencia.variacionPorcentaje,
      menorVariacionPorcentaje,
      mayorSubaPorcentaje,
      mejorCostoPorMlARS: mlCostos.porMlARS,
      mejorCostoPorMlUSD: mlCostos.porMlUSD,
      mejorCostoPor100MlARS: mlCostos.por100MlARS,
      mejorCostoPor100MlUSD: mlCostos.por100MlUSD,
    }
  }

  return {
    mejorPrecioARS: null,
    mejorPrecioUSD: null,
    proveedorMasBarato: null,
    tieneStockDisponible: false,
    segundoMejorPrecioARS: null,
    segundoMejorPrecioUSD: null,
    proveedorSegundoMasBarato: null,
    brechaArbitrajePorcentaje: null,
    ahorroArbitrajeARS: null,
    ahorroArbitrajeUSD: null,
    variacionMejorPrecioPorcentaje: null,
    menorVariacionPorcentaje,
    mayorSubaPorcentaje,
    mejorCostoPorMlARS: null,
    mejorCostoPorMlUSD: null,
    mejorCostoPor100MlARS: null,
    mejorCostoPor100MlUSD: null,
  }
}

/**
 * Motor en memoria para agrupar, comparar, filtrar y ordenar el catálogo de perfumes.
 * Memoriza las transformaciones para responder de manera instantánea al cambiar el dólar o los filtros.
 */
export function useCatalogoPerfumes(
  filasCrudas: FilaVistaComparador[],
  dolarDelDia: number,
  filtros: FiltrosCatalogo,
  opcionesExtras?: OpcionesExtrasCatalogo,
): ResultadoHookCatalogo {
  const cotizacionSegura = dolarDelDia > 0 ? dolarDelDia : 1
  const mapaVariaciones = opcionesExtras?.mapaVariaciones
  const idsWatchlist = opcionesExtras?.idsWatchlist
  const idsAlertasActivas = opcionesExtras?.idsAlertasActivas
  const idsFaltaReponer = opcionesExtras?.idsFaltaReponer
  const configRentabilidad =
    opcionesExtras?.configRentabilidad ?? CONFIG_RENTABILIDAD_INICIAL

  const {
    productosAgrupados,
    proveedoresDisponibles,
    marcasDisponibles,
    tiposDisponibles,
  } = useMemo(() => {
    const conjuntoProveedores = new Set<string>()
    const conjuntoMarcas = new Set<string>()
    const conjuntoTipos = new Set<TipoProducto>()
    const mapaProductos = new Map<number, ProductoComparado>()

    for (const fila of filasCrudas) {
      if (fila.proveedor) conjuntoProveedores.add(fila.proveedor)
      if (fila.marca) conjuntoMarcas.add(fila.marca)
      if (fila.tipo) conjuntoTipos.add(fila.tipo)

      let producto = mapaProductos.get(fila.producto_id)
      const esDesodorante = fila.tipo === 'Desodorante'
      if (!producto) {
        producto = {
          producto_id: fila.producto_id,
          ean6: fila.ean6,
          marca: fila.marca,
          nombre: fila.nombre,
          tipo: fila.tipo,
          concentracion: fila.concentracion,
          ml: fila.ml,
          genero: fila.genero,
          categoria: fila.categoria ?? null,
          imagen_url: esDesodorante ? null : fila.imagen_url,
          ofertas: {},
          mejorPrecioARS: null,
          mejorPrecioUSD: null,
          proveedorMasBarato: null,
          tieneStockDisponible: false,
          segundoMejorPrecioARS: null,
          segundoMejorPrecioUSD: null,
          proveedorSegundoMasBarato: null,
          brechaArbitrajePorcentaje: null,
          ahorroArbitrajeARS: null,
          ahorroArbitrajeUSD: null,
          variacionMejorPrecioPorcentaje: null,
          menorVariacionPorcentaje: null,
          mayorSubaPorcentaje: null,
          mejorCostoPorMlARS: null,
          mejorCostoPorMlUSD: null,
          mejorCostoPor100MlARS: null,
          mejorCostoPor100MlUSD: null,
          precioVentaManualARS:
            fila.precio_venta_manual_ars !== null &&
            fila.precio_venta_manual_ars !== undefined &&
            Number(fila.precio_venta_manual_ars) > 0
              ? Number(fila.precio_venta_manual_ars)
              : null,
        }
        mapaProductos.set(fila.producto_id, producto)
      } else {
        if (!esDesodorante && !producto.imagen_url && fila.imagen_url) {
          producto.imagen_url = fila.imagen_url
        }
        if (!producto.categoria && fila.categoria) {
          producto.categoria = fila.categoria
        }
        if (
          !producto.precioVentaManualARS &&
          fila.precio_venta_manual_ars &&
          Number(fila.precio_venta_manual_ars) > 0
        ) {
          producto.precioVentaManualARS = Number(fila.precio_venta_manual_ars)
        }
      }

      const variacion = mapaVariaciones?.[`${fila.producto_id}__${fila.proveedor}`]
      producto.ofertas[fila.proveedor] = crearOfertaNormalizada(
        fila,
        cotizacionSegura,
        variacion,
      )
    }

    const listaProductos: ProductoComparado[] = []
    for (const producto of mapaProductos.values()) {
      const resumenGlobal = seleccionarMejorOferta(
        Object.values(producto.ofertas),
        producto.ml,
      )
      listaProductos.push({
        ...producto,
        ...resumenGlobal,
      })
    }

    return {
      productosAgrupados: listaProductos,
      proveedoresDisponibles: Array.from(conjuntoProveedores).sort((a, b) =>
        a.localeCompare(b, 'es-AR'),
      ),
      marcasDisponibles: Array.from(conjuntoMarcas).sort((a, b) =>
        a.localeCompare(b, 'es-AR'),
      ),
      tiposDisponibles: Array.from(conjuntoTipos).sort((a, b) =>
        a.localeCompare(b, 'es-AR'),
      ),
    }
  }, [filasCrudas, cotizacionSegura, mapaVariaciones])

  const productosFiltrados = useMemo(() => {
    const esModoGlobal = filtros.pestanaActiva === 'GLOBAL'
    const tokensBusqueda = normalizarTextoBusqueda(filtros.busqueda)
      .split(' ')
      .filter(Boolean)

    const marcasActivas = new Set(filtros.marcasSeleccionadas)
    const tiposActivos = new Set(filtros.tiposSeleccionados)
    const [precioMinARS, precioMaxARS] = filtros.rangoPrecioARS

    // En modo proveedor individual recalculamos el resumen de precio y stock
    // usando únicamente la oferta de ese proveedor para filtrar y ordenar con precisión.
    const candidatos: ProductoComparado[] = []

    for (const producto of productosAgrupados) {
      let productoContextual = producto

      if (!esModoGlobal) {
        const ofertaProveedor = producto.ofertas[filtros.pestanaActiva]
        if (!ofertaProveedor) continue

        const mlCostos = calcularCostosPorMl(
          ofertaProveedor.precioBaseEnARS,
          ofertaProveedor.precioBaseEnUSD,
          producto.ml,
        )

        productoContextual = {
          ...producto,
          mejorPrecioARS: ofertaProveedor.precioBaseEnARS,
          mejorPrecioUSD: ofertaProveedor.precioBaseEnUSD,
          proveedorMasBarato: ofertaProveedor.disponible
            ? ofertaProveedor.proveedor
            : null,
          tieneStockDisponible: ofertaProveedor.disponible,
          segundoMejorPrecioARS: null,
          segundoMejorPrecioUSD: null,
          proveedorSegundoMasBarato: null,
          brechaArbitrajePorcentaje: null,
          ahorroArbitrajeARS: null,
          ahorroArbitrajeUSD: null,
          variacionMejorPrecioPorcentaje: ofertaProveedor.variacionPorcentaje,
          menorVariacionPorcentaje: ofertaProveedor.variacionPorcentaje,
          mayorSubaPorcentaje: ofertaProveedor.variacionPorcentaje,
          mejorCostoPorMlARS: mlCostos.porMlARS,
          mejorCostoPorMlUSD: mlCostos.porMlUSD,
          mejorCostoPor100MlARS: mlCostos.por100MlARS,
          mejorCostoPor100MlUSD: mlCostos.por100MlUSD,
        }
      }

      if (filtros.soloEnStock && !productoContextual.tieneStockDisponible) {
        continue
      }

      if (filtros.filtroInteligencia === 'BAJARON') {
        if ((productoContextual.menorVariacionPorcentaje ?? 0) >= -0.1) {
          continue
        }
      } else if (filtros.filtroInteligencia === 'SUBIERON') {
        if ((productoContextual.mayorSubaPorcentaje ?? 0) <= 0.1) {
          continue
        }
      } else if (filtros.filtroInteligencia === 'ARBITRAJE') {
        if ((productoContextual.brechaArbitrajePorcentaje ?? 0) < 5) {
          continue
        }
      } else if (filtros.filtroInteligencia === 'SEGUIMIENTO') {
        if (!idsWatchlist?.has(productoContextual.producto_id)) {
          continue
        }
      } else if (filtros.filtroInteligencia === 'ALERTAS_ACTIVAS') {
        if (!idsAlertasActivas?.has(productoContextual.producto_id)) {
          continue
        }
      } else if (filtros.filtroInteligencia === 'FALTA_REPONER') {
        if (!idsFaltaReponer?.has(productoContextual.producto_id)) {
          continue
        }
      }

      if (marcasActivas.size > 0 && !marcasActivas.has(productoContextual.marca)) {
        continue
      }

      if (tiposActivos.size > 0 && !tiposActivos.has(productoContextual.tipo)) {
        continue
      }

      if (filtros.genero && productoContextual.genero !== filtros.genero) {
        continue
      }

      if (filtros.categoria === 'SIN_CATEGORIA') {
        if (productoContextual.categoria) continue
      } else if (
        filtros.categoria &&
        productoContextual.categoria !== filtros.categoria
      ) {
        continue
      }

      if (precioMinARS !== null) {
        if (
          productoContextual.mejorPrecioARS === null ||
          productoContextual.mejorPrecioARS < precioMinARS
        ) {
          continue
        }
      }

      if (precioMaxARS !== null) {
        if (
          productoContextual.mejorPrecioARS === null ||
          productoContextual.mejorPrecioARS > precioMaxARS
        ) {
          continue
        }
      }

      if (tokensBusqueda.length > 0) {
        const textoIndexado = normalizarTextoBusqueda(
          [
            productoContextual.marca,
            productoContextual.nombre,
            productoContextual.concentracion ?? '',
            productoContextual.ml !== null ? String(productoContextual.ml) : '',
            productoContextual.ml !== null ? `${productoContextual.ml}ml` : '',
            productoContextual.categoria ?? '',
            productoContextual.ean6 ?? '',
          ].join(' '),
        )

        const coincideTodosLosTokens = tokensBusqueda.every((token) =>
          textoIndexado.includes(token),
        )
        if (!coincideTodosLosTokens) continue
      }

      candidatos.push(productoContextual)
    }

    const gananciaUnitariaARS = (item: ProductoComparado): number => {
      if (!item.tieneStockDisponible || item.mejorPrecioARS === null) {
        return Number.NEGATIVE_INFINITY
      }
      return calcularRentabilidadUnitaria({
        productoId: item.producto_id,
        costoARS: item.mejorPrecioARS,
        costoUSD: item.mejorPrecioUSD,
        ml: item.ml,
        tipo: item.tipo,
        dolarDelDia: cotizacionSegura,
        config: configRentabilidad,
        precioVentaManualARS: item.precioVentaManualARS,
      }).gananciaNetaARS
    }

    candidatos.sort((a, b) => {
      switch (filtros.ordenarPor) {
        case 'precio_asc': {
          // Priorizamos productos con stock disponible cuando empatan o no tienen precio
          if (a.tieneStockDisponible !== b.tieneStockDisponible) {
            return a.tieneStockDisponible ? -1 : 1
          }
          const precioA = a.mejorPrecioARS ?? Number.POSITIVE_INFINITY
          const precioB = b.mejorPrecioARS ?? Number.POSITIVE_INFINITY
          if (precioA !== precioB) return precioA - precioB
          return a.nombre.localeCompare(b.nombre, 'es-AR')
        }

        case 'precio_desc': {
          const precioA = a.mejorPrecioARS ?? -1
          const precioB = b.mejorPrecioARS ?? -1
          if (precioA !== precioB) return precioB - precioA
          return a.nombre.localeCompare(b.nombre, 'es-AR')
        }

        case 'costo_ml_asc': {
          if (a.tieneStockDisponible !== b.tieneStockDisponible) {
            return a.tieneStockDisponible ? -1 : 1
          }
          const mlA = a.mejorCostoPorMlARS ?? Number.POSITIVE_INFINITY
          const mlB = b.mejorCostoPorMlARS ?? Number.POSITIVE_INFINITY
          if (mlA !== mlB) return mlA - mlB
          return a.nombre.localeCompare(b.nombre, 'es-AR')
        }

        case 'mayor_baja': {
          const varA = a.menorVariacionPorcentaje ?? Number.POSITIVE_INFINITY
          const varB = b.menorVariacionPorcentaje ?? Number.POSITIVE_INFINITY
          if (varA !== varB) return varA - varB
          return a.nombre.localeCompare(b.nombre, 'es-AR')
        }

        case 'mayor_brecha': {
          const brechaA = a.brechaArbitrajePorcentaje ?? -1
          const brechaB = b.brechaArbitrajePorcentaje ?? -1
          if (brechaA !== brechaB) return brechaB - brechaA
          return a.nombre.localeCompare(b.nombre, 'es-AR')
        }

        case 'mayor_ganancia': {
          const ganA = gananciaUnitariaARS(a)
          const ganB = gananciaUnitariaARS(b)
          if (ganA !== ganB) return ganB - ganA
          return a.nombre.localeCompare(b.nombre, 'es-AR')
        }

        case 'marca_asc': {
          const comparacionMarca = a.marca.localeCompare(b.marca, 'es-AR')
          if (comparacionMarca !== 0) return comparacionMarca
          return a.nombre.localeCompare(b.nombre, 'es-AR')
        }

        case 'nombre_asc':
        default: {
          return a.nombre.localeCompare(b.nombre, 'es-AR')
        }
      }
    })

    return candidatos
  }, [
    productosAgrupados,
    filtros,
    idsWatchlist,
    idsAlertasActivas,
    idsFaltaReponer,
    configRentabilidad,
    cotizacionSegura,
  ])

  return {
    productos: productosFiltrados,
    totalSinFiltrar: productosAgrupados.length,
    proveedoresDisponibles,
    marcasDisponibles,
    tiposDisponibles,
  }
}
