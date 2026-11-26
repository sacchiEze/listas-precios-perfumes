import { obtenerRecargoUnitarioARS } from '@/lib/rentabilidad'
import {
  calcularResumenProveedor,
  calcularResumenesPorProveedor,
} from '@/store/useCarritoStore'
import type {
  ConcentracionPerfume,
  ConfiguracionRentabilidad,
  EtiquetaEscalaAplicada,
  ItemCarrito,
  ItemCarritoCalculado,
  ModoEscalaMayorista,
  Moneda,
  OfertaProveedor,
  ProductoComparado,
} from '@/types/perfumeria'

/** Mínimo de perfumes (unidades) requerido por tienda al separar un pedido */
export const MIN_UNIDADES_POR_TIENDA = 5

const MAX_TIENDAS_EVALUACION_SEPARADA = 6
const UMBRAL_DIFERENCIA_ARS = 1

export interface ItemRequeridoCarrito {
  productoId: number
  cantidad: number
  marca: string
  nombre: string
  concentracion: ConcentracionPerfume | null
  ml: number | null
  imagenUrl: string | null
}

export interface PrecioOfertaEscalaResuelto {
  precioUnitarioOrigen: number
  moneda: Moneda
  precioUnitarioARS: number
  precioUnitarioUSD: number
  escalaItem: EtiquetaEscalaAplicada
}

export interface EvaluacionTiendaUnica {
  proveedor: string
  tieneListaCompleta: boolean
  totalUnidadesCubiertas: number
  totalProductosCubiertos: number
  productosFaltantes: ItemRequeridoCarrito[]
  monedaOrigen: Moneda
  modoEscala: ModoEscalaMayorista
  escalaAplicada: EtiquetaEscalaAplicada
  totalOrigen: number
  totalARS: number
  totalUSD: number
  diferenciaVsActualARS: number
  diferenciaVsActualUSD: number
  itemsAsignados: ItemCarrito[]
}

export interface AsignacionTiendaSeparada {
  proveedor: string
  monedaOrigen: Moneda
  totalUnidades: number
  escalaAplicada: EtiquetaEscalaAplicada
  totalOrigen: number
  totalARS: number
  totalUSD: number
  items: ItemCarritoCalculado[]
}

export interface EvaluacionPedidoSeparado {
  tiendas: AsignacionTiendaSeparada[]
  totalARS: number
  totalUSD: number
  ahorroVsActualARS: number
  ahorroVsActualUSD: number
  ahorroVsMejorTiendaUnicaARS: number | null
  ahorroVsMejorTiendaUnicaUSD: number | null
  itemsAsignados: ItemCarrito[]
}

export type EstrategiaOptimizacionCarrito =
  | 'SEPARAR_PEDIDO'
  | 'TIENDA_UNICA'
  | 'ACTUAL_ES_OPTIMO'
  | 'SIN_COBERTURA_COMPLETA'

export interface ResultadoOptimizacionCarrito {
  itemsRequeridos: ItemRequeridoCarrito[]
  totalUnidadesRequeridas: number
  totalActualARS: number
  totalActualUSD: number
  cumpleMinimoActual: boolean
  evaluacionesTiendas: EvaluacionTiendaUnica[]
  mejorTiendaUnica: EvaluacionTiendaUnica | null
  mejorSeparacion: EvaluacionPedidoSeparado | null
  estrategiaRecomendada: EstrategiaOptimizacionCarrito
  ahorroMaximoARS: number
  ahorroMaximoUSD: number
  itemsOptimosParaAplicar: ItemCarrito[] | null
}

export interface EntradaOptimizacionCarrito {
  itemsCarrito: ItemCarrito[]
  productosCatalogo: ProductoComparado[]
  proveedoresActivos: string[]
  escalaForzadaPorProveedor: Record<string, ModoEscalaMayorista>
  dolarDelDia: number
  configRentabilidad?: Pick<
    ConfiguracionRentabilidad,
    'costoEnvioPorPerfumeUSD' | 'costoFijoEnvioEmbalajeARS'
  >
}

/**
 * Resuelve el precio unitario efectivo de una oferta aplicando la misma lógica
 * de escalas mayoristas (Base / 12+ / 24+) que utiliza el carrito.
 */
export function resolverPrecioOfertaConEscala(
  oferta: OfertaProveedor,
  totalUnidadesProveedor: number,
  modoEscala: ModoEscalaMayorista,
  cotizacionSegura: number,
): PrecioOfertaEscalaResuelto {
  const precioBase = oferta.precioBase ?? 0
  const desea24 =
    modoEscala === '24+' ||
    (modoEscala === 'AUTO' && totalUnidadesProveedor >= 24)
  const desea12 =
    modoEscala === '12+' ||
    (modoEscala === 'AUTO' && totalUnidadesProveedor >= 12)

  let precioUnitarioOrigen = precioBase
  let escalaItem: EtiquetaEscalaAplicada = 'Base'

  if (desea24) {
    if (oferta.precio24 !== null) {
      precioUnitarioOrigen = oferta.precio24
      escalaItem = '24+'
    } else if (oferta.precio12 !== null) {
      precioUnitarioOrigen = oferta.precio12
      escalaItem = '12+'
    }
  } else if (desea12) {
    if (oferta.precio12 !== null) {
      precioUnitarioOrigen = oferta.precio12
      escalaItem = '12+'
    }
  }

  const precioUnitarioARS =
    oferta.moneda === 'ARS'
      ? precioUnitarioOrigen
      : precioUnitarioOrigen * cotizacionSegura
  const precioUnitarioUSD =
    oferta.moneda === 'USD'
      ? precioUnitarioOrigen
      : precioUnitarioOrigen / cotizacionSegura

  return {
    precioUnitarioOrigen,
    moneda: oferta.moneda,
    precioUnitarioARS,
    precioUnitarioUSD,
    escalaItem,
  }
}

function consolidarItemsCarrito(
  itemsCarrito: ItemCarrito[],
  mapaProductos: Map<number, ProductoComparado>,
): ItemRequeridoCarrito[] {
  const mapaRequeridos = new Map<number, ItemRequeridoCarrito>()

  for (const item of itemsCarrito) {
    if (item.cantidad <= 0) continue
    const producto = mapaProductos.get(item.productoId)
    const existente = mapaRequeridos.get(item.productoId)

    if (existente) {
      existente.cantidad += item.cantidad
      continue
    }

    mapaRequeridos.set(item.productoId, {
      productoId: item.productoId,
      cantidad: item.cantidad,
      marca: producto?.marca ?? item.marca,
      nombre: producto?.nombre ?? item.nombre,
      concentracion: producto?.concentracion ?? item.concentracion,
      ml: producto?.ml ?? item.ml,
      imagenUrl: producto?.imagen_url ?? item.imagenUrl,
    })
  }

  return Array.from(mapaRequeridos.values())
}

function construirItemCarritoDesdeOferta(
  itemReq: ItemRequeridoCarrito,
  oferta: OfertaProveedor,
  cantidad: number,
): ItemCarrito {
  return {
    productoId: itemReq.productoId,
    proveedor: oferta.proveedor,
    cantidad,
    marca: itemReq.marca,
    nombre: itemReq.nombre,
    concentracion: itemReq.concentracion,
    ml: itemReq.ml,
    imagenUrl: itemReq.imagenUrl,
    moneda: oferta.moneda,
    precioBase: oferta.precioBase ?? 0,
    precio12: oferta.precio12,
    precio24: oferta.precio24,
  }
}

function inferirMonedaProveedor(
  proveedor: string,
  productosCatalogo: ProductoComparado[],
): Moneda {
  for (const producto of productosCatalogo) {
    const oferta = producto.ofertas[proveedor]
    if (oferta) return oferta.moneda
  }
  return 'USD'
}

interface TierEscalaCandidato {
  modoEvaluacion: ModoEscalaMayorista
  minimoUnidades: number
}

function obtenerTiersCandidatosProveedor(
  proveedor: string,
  itemsRequeridos: ItemRequeridoCarrito[],
  mapaProductos: Map<number, ProductoComparado>,
  modoConfigurado: ModoEscalaMayorista,
  totalUnidadesRequeridas: number,
): TierEscalaCandidato[] {
  if (modoConfigurado !== 'AUTO') {
    return [
      {
        modoEvaluacion: modoConfigurado,
        minimoUnidades: MIN_UNIDADES_POR_TIENDA,
      },
    ]
  }

  const tiers: TierEscalaCandidato[] = [
    { modoEvaluacion: 'BASE', minimoUnidades: MIN_UNIDADES_POR_TIENDA },
  ]

  let tienePrecio12 = false
  let tienePrecio24 = false
  for (const item of itemsRequeridos) {
    const oferta = mapaProductos.get(item.productoId)?.ofertas[proveedor]
    if (!oferta || !oferta.disponible || oferta.precioBase === null) continue
    if (oferta.precio12 !== null) tienePrecio12 = true
    if (oferta.precio24 !== null) tienePrecio24 = true
    if (tienePrecio12 && tienePrecio24) break
  }

  if (tienePrecio12 && totalUnidadesRequeridas >= 12 + MIN_UNIDADES_POR_TIENDA) {
    tiers.push({ modoEvaluacion: '12+', minimoUnidades: 12 })
  }
  if (tienePrecio24 && totalUnidadesRequeridas >= 24 + MIN_UNIDADES_POR_TIENDA) {
    tiers.push({ modoEvaluacion: '24+', minimoUnidades: 24 })
  }

  return tiers
}

/**
 * Resuelve la asignación exacta de mínimo costo en ARS para un subconjunto fijo de tiendas
 * y niveles de escala dados, mediante flujo de costo mínimo por caminos aumentantes más cortos.
 */
function resolverAsignacionParaTiers(
  tiendas: string[],
  tiers: TierEscalaCandidato[],
  itemsRequeridos: ItemRequeridoCarrito[],
  mapaProductos: Map<number, ProductoComparado>,
  cotizacionSegura: number,
  recargoPorTiendaARS: number[],
): number[][] | null {
  const k = tiendas.length
  const n = itemsRequeridos.length

  const sumaMinimos = tiers.reduce((acc, t) => acc + t.minimoUnidades, 0)
  const totalUnidades = itemsRequeridos.reduce((acc, it) => acc + it.cantidad, 0)
  if (sumaMinimos > totalUnidades) return null

  const ofertasMatriz: Array<Array<OfertaProveedor | null>> = new Array(n)
  const preciosMatriz: Array<Array<number>> = new Array(n)
  const asignacion: number[][] = Array.from({ length: n }, () =>
    new Array<number>(k).fill(0),
  )
  const unidadesPorTienda = new Array<number>(k).fill(0)

  for (let i = 0; i < n; i++) {
    const item = itemsRequeridos[i]
    const prod = mapaProductos.get(item.productoId)
    ofertasMatriz[i] = new Array<OfertaProveedor | null>(k).fill(null)
    preciosMatriz[i] = new Array<number>(k).fill(Number.POSITIVE_INFINITY)

    let mejorJ = -1
    let mejorPrecio = Number.POSITIVE_INFINITY

    for (let j = 0; j < k; j++) {
      const oferta = prod?.ofertas[tiendas[j]]
      if (!oferta || !oferta.disponible || oferta.precioBase === null) continue
      ofertasMatriz[i][j] = oferta
      const resuelto = resolverPrecioOfertaConEscala(
        oferta,
        tiers[j].minimoUnidades,
        tiers[j].modoEvaluacion,
        cotizacionSegura,
      )
      const costoFinalUnitarioARS =
        resuelto.precioUnitarioARS + (recargoPorTiendaARS[j] ?? 0)
      preciosMatriz[i][j] = costoFinalUnitarioARS
      if (costoFinalUnitarioARS < mejorPrecio) {
        mejorPrecio = costoFinalUnitarioARS
        mejorJ = j
      }
    }

    if (mejorJ === -1) return null
    asignacion[i][mejorJ] = item.cantidad
    unidadesPorTienda[mejorJ] += item.cantidad
  }

  // Reasignar unidades desde tiendas con excedente hacia tiendas por debajo de su mínimo
  while (true) {
    const tiendasConDeficit: number[] = []
    const tiendasConExcedente: number[] = []

    for (let j = 0; j < k; j++) {
      if (unidadesPorTienda[j] < tiers[j].minimoUnidades) {
        tiendasConDeficit.push(j)
      } else if (unidadesPorTienda[j] > tiers[j].minimoUnidades) {
        tiendasConExcedente.push(j)
      }
    }

    if (tiendasConDeficit.length === 0) {
      return asignacion
    }
    if (tiendasConExcedente.length === 0) {
      return null
    }

    // Construir mejor arista dirigida u -> v entre cada par de tiendas
    const mejorArista: Array<
      Array<{ costo: number; itemIdx: number } | null>
    > = Array.from({ length: k }, () => new Array(k).fill(null))

    for (let u = 0; u < k; u++) {
      for (let v = 0; v < k; v++) {
        if (u === v) continue
        let mejorCostoArista = Number.POSITIVE_INFINITY
        let mejorItemArista = -1

        for (let i = 0; i < n; i++) {
          if (asignacion[i][u] <= 0 || ofertasMatriz[i][v] === null) continue
          const costo = preciosMatriz[i][v] - preciosMatriz[i][u]
          if (costo < mejorCostoArista) {
            mejorCostoArista = costo
            mejorItemArista = i
          }
        }

        if (mejorItemArista !== -1) {
          mejorArista[u][v] = {
            costo: mejorCostoArista,
            itemIdx: mejorItemArista,
          }
        }
      }
    }

    // Bellman-Ford desde todos los nodos con excedente hacia cualquier nodo con déficit
    const dist = new Array<number>(k).fill(Number.POSITIVE_INFINITY)
    const prevNodo = new Array<number>(k).fill(-1)
    const prevItem = new Array<number>(k).fill(-1)

    for (const u of tiendasConExcedente) {
      dist[u] = 0
    }

    for (let paso = 0; paso < k - 1; paso++) {
      let huboCambio = false
      for (let u = 0; u < k; u++) {
        if (!Number.isFinite(dist[u])) continue
        for (let v = 0; v < k; v++) {
          const arista = mejorArista[u][v]
          if (!arista) continue
          const nuevoCosto = dist[u] + arista.costo
          if (nuevoCosto < dist[v] - 1e-9) {
            dist[v] = nuevoCosto
            prevNodo[v] = u
            prevItem[v] = arista.itemIdx
            huboCambio = true
          }
        }
      }
      if (!huboCambio) break
    }

    let destinoElegido = -1
    let menorDistancia = Number.POSITIVE_INFINITY
    for (const d of tiendasConDeficit) {
      if (dist[d] < menorDistancia) {
        menorDistancia = dist[d]
        destinoElegido = d
      }
    }

    if (destinoElegido === -1 || !Number.isFinite(menorDistancia)) {
      return null
    }

    // Reconstruir el camino y calcular cuántas unidades se pueden mover en bloque
    const camino: Array<{ u: number; v: number; itemIdx: number }> = []
    let actual = destinoElegido
    let visitados = 0
    while (prevNodo[actual] !== -1 && visitados < k) {
      const padre = prevNodo[actual]
      camino.push({ u: padre, v: actual, itemIdx: prevItem[actual] })
      actual = padre
      visitados += 1
    }

    if (camino.length === 0 || prevNodo[actual] !== -1) {
      return null
    }

    const origen = actual
    let flujo = Math.min(
      unidadesPorTienda[origen] - tiers[origen].minimoUnidades,
      tiers[destinoElegido].minimoUnidades - unidadesPorTienda[destinoElegido],
    )
    for (const paso of camino) {
      flujo = Math.min(flujo, asignacion[paso.itemIdx][paso.u])
    }

    if (flujo <= 0) return null

    for (const paso of camino) {
      asignacion[paso.itemIdx][paso.u] -= flujo
      asignacion[paso.itemIdx][paso.v] += flujo
    }
    unidadesPorTienda[origen] -= flujo
    unidadesPorTienda[destinoElegido] += flujo
  }
}

function seleccionarProveedoresCandidatosSeparacion(
  proveedoresActivos: string[],
  evaluacionesTiendas: EvaluacionTiendaUnica[],
  itemsRequeridos: ItemRequeridoCarrito[],
  mapaProductos: Map<number, ProductoComparado>,
): string[] {
  if (proveedoresActivos.length <= MAX_TIENDAS_EVALUACION_SEPARADA) {
    return proveedoresActivos
  }

  // Priorizar proveedores que lideran al menos un ítem y los de mayor cobertura/menor costo
  const lideresPorItem = new Set<string>()
  for (const item of itemsRequeridos) {
    const prod = mapaProductos.get(item.productoId)
    if (!prod) continue
    let mejorProv: string | null = null
    let mejorARS = Number.POSITIVE_INFINITY
    for (const prov of proveedoresActivos) {
      const oferta = prod.ofertas[prov]
      if (!oferta || !oferta.disponible || oferta.precioBaseEnARS === null) {
        continue
      }
      if (oferta.precioBaseEnARS < mejorARS) {
        mejorARS = oferta.precioBaseEnARS
        mejorProv = prov
      }
    }
    if (mejorProv) lideresPorItem.add(mejorProv)
  }

  const ordenados = [...evaluacionesTiendas].sort((a, b) => {
    const aLider = lideresPorItem.has(a.proveedor) ? 1 : 0
    const bLider = lideresPorItem.has(b.proveedor) ? 1 : 0
    if (aLider !== bLider) return bLider - aLider
    if (a.totalUnidadesCubiertas !== b.totalUnidadesCubiertas) {
      return b.totalUnidadesCubiertas - a.totalUnidadesCubiertas
    }
    return a.totalARS - b.totalARS
  })

  return ordenados
    .slice(0, MAX_TIENDAS_EVALUACION_SEPARADA)
    .map((e) => e.proveedor)
}

function buscarMejorSeparacionPedido(
  itemsRequeridos: ItemRequeridoCarrito[],
  totalUnidadesRequeridas: number,
  proveedoresActivos: string[],
  evaluacionesTiendas: EvaluacionTiendaUnica[],
  mapaProductos: Map<number, ProductoComparado>,
  escalaForzadaPorProveedor: Record<string, ModoEscalaMayorista>,
  cotizacionSegura: number,
  totalActualARS: number,
  totalActualUSD: number,
  mejorTiendaUnica: EvaluacionTiendaUnica | null,
  obtenerRecargoTiendaARS: (proveedor: string) => number,
): EvaluacionPedidoSeparado | null {
  if (
    totalUnidadesRequeridas < MIN_UNIDADES_POR_TIENDA * 2 ||
    proveedoresActivos.length < 2 ||
    itemsRequeridos.length === 0
  ) {
    return null
  }

  // Todo ítem debe existir disponible en al menos un proveedor activo
  for (const item of itemsRequeridos) {
    const prod = mapaProductos.get(item.productoId)
    const disponibleEnAlguno = proveedoresActivos.some((prov) => {
      const oferta = prod?.ofertas[prov]
      return Boolean(oferta && oferta.disponible && oferta.precioBase !== null)
    })
    if (!disponibleEnAlguno) return null
  }

  const candidatos = seleccionarProveedoresCandidatosSeparacion(
    proveedoresActivos,
    evaluacionesTiendas,
    itemsRequeridos,
    mapaProductos,
  )

  const maxTiendasEnParticion = Math.min(
    candidatos.length,
    Math.floor(totalUnidadesRequeridas / MIN_UNIDADES_POR_TIENDA),
  )
  if (maxTiendasEnParticion < 2) return null

  const tiersPorProveedor = new Map<string, TierEscalaCandidato[]>()
  for (const prov of candidatos) {
    tiersPorProveedor.set(
      prov,
      obtenerTiersCandidatosProveedor(
        prov,
        itemsRequeridos,
        mapaProductos,
        escalaForzadaPorProveedor[prov] ?? 'AUTO',
        totalUnidadesRequeridas,
      ),
    )
  }

  let mejorEvaluacion: EvaluacionPedidoSeparado | null = null
  let mejorTotalARS = Number.POSITIVE_INFINITY

  const evaluarSubconjunto = (tiendas: string[]) => {
    // Verificar cobertura rápida del subconjunto
    for (const item of itemsRequeridos) {
      const prod = mapaProductos.get(item.productoId)
      const cubierto = tiendas.some((prov) => {
        const oferta = prod?.ofertas[prov]
        return Boolean(oferta && oferta.disponible && oferta.precioBase !== null)
      })
      if (!cubierto) return
    }

    const tiersActuales: TierEscalaCandidato[] = []

    const explorarTiers = (idx: number, sumaMinimosAcum: number) => {
      if (sumaMinimosAcum > totalUnidadesRequeridas) return

      if (idx === tiendas.length) {
        const recargoPorTiendaARS = tiendas.map((prov) =>
          obtenerRecargoTiendaARS(prov),
        )
        const matriz = resolverAsignacionParaTiers(
          tiendas,
          tiersActuales,
          itemsRequeridos,
          mapaProductos,
          cotizacionSegura,
          recargoPorTiendaARS,
        )
        if (!matriz) return

        const itemsSeparados: ItemCarrito[] = []
        for (let j = 0; j < tiendas.length; j++) {
          const proveedor = tiendas[j]
          for (let i = 0; i < itemsRequeridos.length; i++) {
            const qty = matriz[i][j]
            if (qty <= 0) continue
            const oferta = mapaProductos.get(itemsRequeridos[i].productoId)
              ?.ofertas[proveedor]
            if (!oferta) return
            itemsSeparados.push(
              construirItemCarritoDesdeOferta(itemsRequeridos[i], oferta, qty),
            )
          }
        }

        const asignacionesTiendas: AsignacionTiendaSeparada[] = []
        let sumaARS = 0
        let sumaUSD = 0

        for (const proveedor of tiendas) {
          const modoEscala = escalaForzadaPorProveedor[proveedor] ?? 'AUTO'
          const resumen = calcularResumenProveedor(
            itemsSeparados,
            proveedor,
            modoEscala,
            cotizacionSegura,
          )
          if (!resumen || resumen.totalUnidades < MIN_UNIDADES_POR_TIENDA) {
            return
          }
          const recargoTotalARS =
            resumen.totalUnidades * obtenerRecargoTiendaARS(resumen.proveedor)
          const totalARS = resumen.totalEnARS + recargoTotalARS
          const totalUSD =
            resumen.totalEnUSD + recargoTotalARS / cotizacionSegura
          asignacionesTiendas.push({
            proveedor: resumen.proveedor,
            monedaOrigen: resumen.monedaOrigen,
            totalUnidades: resumen.totalUnidades,
            escalaAplicada: resumen.escalaAplicada,
            totalOrigen: resumen.totalEnMonedaOrigen,
            totalARS,
            totalUSD,
            items: resumen.items,
          })
          sumaARS += totalARS
          sumaUSD += totalUSD
        }

        if (asignacionesTiendas.length < 2) return

        if (sumaARS < mejorTotalARS - 0.01) {
          mejorTotalARS = sumaARS
          asignacionesTiendas.sort((a, b) => b.totalUnidades - a.totalUnidades)
          mejorEvaluacion = {
            tiendas: asignacionesTiendas,
            totalARS: sumaARS,
            totalUSD: sumaUSD,
            ahorroVsActualARS: totalActualARS - sumaARS,
            ahorroVsActualUSD: totalActualUSD - sumaUSD,
            ahorroVsMejorTiendaUnicaARS: mejorTiendaUnica
              ? mejorTiendaUnica.totalARS - sumaARS
              : null,
            ahorroVsMejorTiendaUnicaUSD: mejorTiendaUnica
              ? mejorTiendaUnica.totalUSD - sumaUSD
              : null,
            itemsAsignados: itemsSeparados,
          }
        }
        return
      }

      const opciones = tiersPorProveedor.get(tiendas[idx]) ?? []
      const restantes = tiendas.length - 1 - idx
      const minRestante = restantes * MIN_UNIDADES_POR_TIENDA

      for (const opcion of opciones) {
        if (sumaMinimosAcum + opcion.minimoUnidades + minRestante > totalUnidadesRequeridas) {
          continue
        }
        tiersActuales.push(opcion)
        explorarTiers(idx + 1, sumaMinimosAcum + opcion.minimoUnidades)
        tiersActuales.pop()
      }
    }

    explorarTiers(0, 0)
  }

  const seleccionActual: string[] = []
  const generarSubconjuntos = (inicio: number) => {
    if (seleccionActual.length >= 2) {
      evaluarSubconjunto([...seleccionActual])
    }
    if (seleccionActual.length >= maxTiendasEnParticion) return

    for (let idx = inicio; idx < candidatos.length; idx++) {
      seleccionActual.push(candidatos[idx])
      generarSubconjuntos(idx + 1)
      seleccionActual.pop()
    }
  }

  generarSubconjuntos(0)
  return mejorEvaluacion
}

/**
 * Compara el total de la lista de perfumes del carrito en cada tienda activa y evalúa
 * si conviene comprar todo en una tienda única o separar el pedido (mín. 5 perfumes por tienda).
 */
export function optimizarCarritoPerfumes({
  itemsCarrito,
  productosCatalogo,
  proveedoresActivos,
  escalaForzadaPorProveedor,
  dolarDelDia,
  configRentabilidad,
}: EntradaOptimizacionCarrito): ResultadoOptimizacionCarrito {
  const cotizacionSegura = dolarDelDia > 0 ? dolarDelDia : 1
  const obtenerRecargoTiendaARS = (proveedor: string): number => {
    if (!configRentabilidad) return 0
    return obtenerRecargoUnitarioARS(
      proveedor,
      configRentabilidad,
      cotizacionSegura,
    )
  }

  const mapaProductos = new Map<number, ProductoComparado>(
    productosCatalogo.map((p) => [p.producto_id, p]),
  )

  const itemsRequeridos = consolidarItemsCarrito(itemsCarrito, mapaProductos)
  const totalUnidadesRequeridas = itemsRequeridos.reduce(
    (acc, it) => acc + it.cantidad,
    0,
  )

  const resumenesActuales = calcularResumenesPorProveedor(
    itemsCarrito,
    escalaForzadaPorProveedor,
    cotizacionSegura,
  )
  const totalActualARS = resumenesActuales.reduce(
    (acc, r) =>
      acc + r.totalEnARS + r.totalUnidades * obtenerRecargoTiendaARS(r.proveedor),
    0,
  )
  const totalActualUSD = resumenesActuales.reduce(
    (acc, r) =>
      acc +
      r.totalEnUSD +
      (r.totalUnidades * obtenerRecargoTiendaARS(r.proveedor)) /
        cotizacionSegura,
    0,
  )

  const cumpleMinimoActual =
    resumenesActuales.length <= 1 ||
    resumenesActuales.every((r) => r.totalUnidades >= MIN_UNIDADES_POR_TIENDA)

  if (itemsRequeridos.length === 0 || proveedoresActivos.length === 0) {
    return {
      itemsRequeridos,
      totalUnidadesRequeridas,
      totalActualARS,
      totalActualUSD,
      cumpleMinimoActual,
      evaluacionesTiendas: [],
      mejorTiendaUnica: null,
      mejorSeparacion: null,
      estrategiaRecomendada: 'SIN_COBERTURA_COMPLETA',
      ahorroMaximoARS: 0,
      ahorroMaximoUSD: 0,
      itemsOptimosParaAplicar: null,
    }
  }

  const evaluacionesTiendas: EvaluacionTiendaUnica[] = proveedoresActivos.map(
    (proveedor) => {
      const itemsDisponibles: ItemCarrito[] = []
      const productosFaltantes: ItemRequeridoCarrito[] = []
      let unidadesCubiertas = 0

      for (const itemReq of itemsRequeridos) {
        const oferta = mapaProductos.get(itemReq.productoId)?.ofertas[proveedor]
        if (oferta && oferta.disponible && oferta.precioBase !== null) {
          itemsDisponibles.push(
            construirItemCarritoDesdeOferta(itemReq, oferta, itemReq.cantidad),
          )
          unidadesCubiertas += itemReq.cantidad
        } else {
          productosFaltantes.push(itemReq)
        }
      }

      const modoEscala = escalaForzadaPorProveedor[proveedor] ?? 'AUTO'
      const resumen = calcularResumenProveedor(
        itemsDisponibles,
        proveedor,
        modoEscala,
        cotizacionSegura,
      )

      const tieneListaCompleta = productosFaltantes.length === 0
      const monedaOrigen =
        resumen?.monedaOrigen ?? inferirMonedaProveedor(proveedor, productosCatalogo)
      const recargoTotalARS =
        unidadesCubiertas * obtenerRecargoTiendaARS(proveedor)
      const totalARS = (resumen?.totalEnARS ?? 0) + recargoTotalARS
      const totalUSD =
        (resumen?.totalEnUSD ?? 0) + recargoTotalARS / cotizacionSegura

      return {
        proveedor,
        tieneListaCompleta,
        totalUnidadesCubiertas: unidadesCubiertas,
        totalProductosCubiertos: itemsDisponibles.length,
        productosFaltantes,
        monedaOrigen,
        modoEscala,
        escalaAplicada: resumen?.escalaAplicada ?? 'Base',
        totalOrigen: resumen?.totalEnMonedaOrigen ?? 0,
        totalARS,
        totalUSD,
        diferenciaVsActualARS: tieneListaCompleta ? totalARS - totalActualARS : 0,
        diferenciaVsActualUSD: tieneListaCompleta ? totalUSD - totalActualUSD : 0,
        itemsAsignados: itemsDisponibles,
      }
    },
  )

  evaluacionesTiendas.sort((a, b) => {
    if (a.tieneListaCompleta !== b.tieneListaCompleta) {
      return a.tieneListaCompleta ? -1 : 1
    }
    if (a.tieneListaCompleta) {
      if (a.totalARS !== b.totalARS) return a.totalARS - b.totalARS
      return a.proveedor.localeCompare(b.proveedor, 'es-AR')
    }
    if (a.totalUnidadesCubiertas !== b.totalUnidadesCubiertas) {
      return b.totalUnidadesCubiertas - a.totalUnidadesCubiertas
    }
    return a.totalARS - b.totalARS
  })

  const mejorTiendaUnica =
    evaluacionesTiendas.find((ev) => ev.tieneListaCompleta) ?? null

  const mejorSeparacion = buscarMejorSeparacionPedido(
    itemsRequeridos,
    totalUnidadesRequeridas,
    proveedoresActivos,
    evaluacionesTiendas,
    mapaProductos,
    escalaForzadaPorProveedor,
    cotizacionSegura,
    totalActualARS,
    totalActualUSD,
    mejorTiendaUnica,
    obtenerRecargoTiendaARS,
  )

  const separacionSuperaTiendaUnica =
    mejorSeparacion !== null &&
    (mejorTiendaUnica === null ||
      mejorSeparacion.totalARS < mejorTiendaUnica.totalARS - UMBRAL_DIFERENCIA_ARS)

  let mejorOpcionTipo: 'SEPARAR_PEDIDO' | 'TIENDA_UNICA' | 'SIN_COBERTURA_COMPLETA' =
    'SIN_COBERTURA_COMPLETA'
  let costoOptimoARS = totalActualARS
  let costoOptimoUSD = totalActualUSD
  let itemsOptimosParaAplicar: ItemCarrito[] | null = null

  if (separacionSuperaTiendaUnica && mejorSeparacion) {
    mejorOpcionTipo = 'SEPARAR_PEDIDO'
    costoOptimoARS = mejorSeparacion.totalARS
    costoOptimoUSD = mejorSeparacion.totalUSD
    itemsOptimosParaAplicar = mejorSeparacion.itemsAsignados
  } else if (mejorTiendaUnica) {
    mejorOpcionTipo = 'TIENDA_UNICA'
    costoOptimoARS = mejorTiendaUnica.totalARS
    costoOptimoUSD = mejorTiendaUnica.totalUSD
    itemsOptimosParaAplicar = mejorTiendaUnica.itemsAsignados
  }

  let estrategiaRecomendada: EstrategiaOptimizacionCarrito = mejorOpcionTipo
  if (
    mejorOpcionTipo !== 'SIN_COBERTURA_COMPLETA' &&
    cumpleMinimoActual &&
    totalActualARS <= costoOptimoARS + UMBRAL_DIFERENCIA_ARS
  ) {
    // Verificar que cada ítem actual del carrito esté disponible en proveedores activos
    const todosActualesCubiertos = resumenesActuales.every((r) =>
      proveedoresActivos.includes(r.proveedor),
    )
    if (todosActualesCubiertos) {
      estrategiaRecomendada = 'ACTUAL_ES_OPTIMO'
    }
  }

  const ahorroMaximoARS =
    mejorOpcionTipo === 'SIN_COBERTURA_COMPLETA'
      ? 0
      : Math.max(0, totalActualARS - costoOptimoARS)
  const ahorroMaximoUSD =
    mejorOpcionTipo === 'SIN_COBERTURA_COMPLETA'
      ? 0
      : Math.max(0, totalActualUSD - costoOptimoUSD)

  return {
    itemsRequeridos,
    totalUnidadesRequeridas,
    totalActualARS,
    totalActualUSD,
    cumpleMinimoActual,
    evaluacionesTiendas,
    mejorTiendaUnica,
    mejorSeparacion,
    estrategiaRecomendada,
    ahorroMaximoARS,
    ahorroMaximoUSD,
    itemsOptimosParaAplicar,
  }
}
