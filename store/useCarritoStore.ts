'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  EtiquetaEscalaAplicada,
  ItemCarrito,
  ItemCarritoCalculado,
  ModoEscalaMayorista,
  Moneda,
  ProductoComparado,
  ResumenProveedorCarrito,
} from '@/types/perfumeria'

/** Datos requeridos para agregar o sumar un perfume al carrito */
export type EntradaAgregarCarrito = Omit<ItemCarrito, 'cantidad'> & {
  cantidad?: number
}

interface EstadoCarrito {
  items: ItemCarrito[]
  escalaForzadaPorProveedor: Record<string, ModoEscalaMayorista>
  agregarItem: (entrada: EntradaAgregarCarrito) => void
  quitarItem: (productoId: number, proveedor: string) => void
  actualizarCantidad: (productoId: number, proveedor: string, cantidad: number) => void
  incrementarCantidad: (productoId: number, proveedor: string, delta?: number) => void
  vaciarCarrito: () => void
  vaciarProveedor: (proveedor: string) => void
  reemplazarItemsCarrito: (nuevosItems: ItemCarrito[]) => void
  setEscalaProveedor: (proveedor: string, modo: ModoEscalaMayorista) => void
  sincronizarPreciosDesdeCatalogo: (productos: ProductoComparado[]) => void
  obtenerResumenPorProveedor: (
    proveedor: string,
    dolarDelDia: number,
  ) => ResumenProveedorCarrito | null
  obtenerResumenesCarrito: (dolarDelDia: number) => ResumenProveedorCarrito[]
  generarMensajeWhatsApp: (proveedor: string, dolarDelDia: number) => string
  generarTodosLosMensajes: (dolarDelDia: number) => Record<string, string>
}

function resolverPrecioEscalaItem(
  item: ItemCarrito,
  totalUnidadesProveedor: number,
  modoEscala: ModoEscalaMayorista,
): { precioAplicado: number; escalaItem: EtiquetaEscalaAplicada } {
  const desea24 =
    modoEscala === '24+' || (modoEscala === 'AUTO' && totalUnidadesProveedor >= 24)
  const desea12 =
    modoEscala === '12+' || (modoEscala === 'AUTO' && totalUnidadesProveedor >= 12)

  if (desea24) {
    if (item.precio24 !== null) {
      return { precioAplicado: item.precio24, escalaItem: '24+' }
    }
    if (item.precio12 !== null) {
      return { precioAplicado: item.precio12, escalaItem: '12+' }
    }
    return { precioAplicado: item.precioBase, escalaItem: 'Base' }
  }

  if (desea12) {
    if (item.precio12 !== null) {
      return { precioAplicado: item.precio12, escalaItem: '12+' }
    }
    return { precioAplicado: item.precioBase, escalaItem: 'Base' }
  }

  return { precioAplicado: item.precioBase, escalaItem: 'Base' }
}

function resolverEtiquetaEscalaProveedor(
  items: ItemCarrito[],
  totalUnidadesProveedor: number,
  modoEscala: ModoEscalaMayorista,
): EtiquetaEscalaAplicada {
  if (modoEscala === '24+') return '24+'
  if (modoEscala === '12+') return '12+'
  if (modoEscala === 'BASE') return 'Base'

  if (totalUnidadesProveedor >= 24 && items.some((item) => item.precio24 !== null)) {
    return '24+'
  }
  if (totalUnidadesProveedor >= 12 && items.some((item) => item.precio12 !== null)) {
    return '12+'
  }
  return 'Base'
}

/**
 * Calcula los subtotales, escalas mayoristas y conversiones de moneda para un proveedor.
 */
export function calcularResumenProveedor(
  todosLosItems: ItemCarrito[],
  proveedor: string,
  modoEscala: ModoEscalaMayorista,
  dolarDelDia: number,
): ResumenProveedorCarrito | null {
  const itemsProveedor = todosLosItems.filter((item) => item.proveedor === proveedor)
  if (itemsProveedor.length === 0) {
    return null
  }

  const cotizacionSegura = dolarDelDia > 0 ? dolarDelDia : 1
  const monedaOrigen: Moneda = itemsProveedor[0].moneda
  const totalUnidades = itemsProveedor.reduce((acum, item) => acum + item.cantidad, 0)
  const escalaAplicada = resolverEtiquetaEscalaProveedor(
    itemsProveedor,
    totalUnidades,
    modoEscala,
  )

  const itemsCalculados: ItemCarritoCalculado[] = itemsProveedor.map((item) => {
    const { precioAplicado, escalaItem } = resolverPrecioEscalaItem(
      item,
      totalUnidades,
      modoEscala,
    )
    const subtotalOrigen = precioAplicado * item.cantidad
    const subtotalARS =
      item.moneda === 'ARS' ? subtotalOrigen : subtotalOrigen * cotizacionSegura
    const subtotalUSD =
      item.moneda === 'USD' ? subtotalOrigen : subtotalOrigen / cotizacionSegura
    const ahorroUnitario = Math.max(0, item.precioBase - precioAplicado)
    const ahorroTotal = ahorroUnitario * item.cantidad

    return {
      ...item,
      precioUnitarioAplicado: precioAplicado,
      escalaItem,
      subtotalOrigen,
      subtotalARS,
      subtotalUSD,
      ahorroUnitario,
      ahorroTotal,
    }
  })

  const totalEnMonedaOrigen = itemsCalculados.reduce(
    (acum, item) => acum + item.subtotalOrigen,
    0,
  )
  const totalEnARS = itemsCalculados.reduce((acum, item) => acum + item.subtotalARS, 0)
  const totalEnUSD = itemsCalculados.reduce((acum, item) => acum + item.subtotalUSD, 0)
  const ahorroTotalEnMonedaOrigen = itemsCalculados.reduce(
    (acum, item) => acum + item.ahorroTotal,
    0,
  )

  return {
    proveedor,
    monedaOrigen,
    totalUnidades,
    modoEscala,
    escalaAplicada,
    items: itemsCalculados,
    totalEnMonedaOrigen,
    totalEnARS,
    totalEnUSD,
    ahorroTotalEnMonedaOrigen,
  }
}

/**
 * Calcula los resúmenes agrupados de todos los proveedores presentes en el carrito.
 */
export function calcularResumenesPorProveedor(
  items: ItemCarrito[],
  escalaForzadaPorProveedor: Record<string, ModoEscalaMayorista>,
  dolarDelDia: number,
): ResumenProveedorCarrito[] {
  const proveedoresUnicos = Array.from(new Set(items.map((item) => item.proveedor)))
  const resumenes: ResumenProveedorCarrito[] = []

  for (const proveedor of proveedoresUnicos) {
    const modoEscala = escalaForzadaPorProveedor[proveedor] ?? 'AUTO'
    const resumen = calcularResumenProveedor(items, proveedor, modoEscala, dolarDelDia)
    if (resumen) {
      resumenes.push(resumen)
    }
  }

  return resumenes
}

function formatearMontoWhatsApp(valor: number, moneda: Moneda): string {
  if (moneda === 'USD') {
    return `USD ${valor.toFixed(2)}`
  }
  return `ARS $${Math.round(valor).toLocaleString('es-AR')}`
}

function formatearDescripcionPerfume(item: ItemCarrito): string {
  const partes = [item.marca.trim(), item.nombre.trim()]
  if (item.concentracion && item.concentracion !== 'N/A') {
    partes.push(item.concentracion)
  }
  if (item.ml !== null && item.ml > 0) {
    partes.push(`${item.ml}ml`)
  }
  return partes.filter(Boolean).join(' ')
}

function construirTextoWhatsApp(resumen: ResumenProveedorCarrito): string {
  const lineasProductos = resumen.items.map((item) => {
    const descripcion = formatearDescripcionPerfume(item)
    const unitario = formatearMontoWhatsApp(item.precioUnitarioAplicado, item.moneda)
    const subtotal = formatearMontoWhatsApp(item.subtotalOrigen, item.moneda)
    return `- ${item.cantidad}x ${descripcion} - ${unitario} c/u = ${subtotal}`
  })

  const etiquetaUnidades = resumen.totalUnidades === 1 ? 'unidad' : 'unidades'

  const totalPrincipal =
    resumen.monedaOrigen === 'USD'
      ? `USD ${resumen.totalEnUSD.toFixed(2)}`
      : `ARS $${Math.round(resumen.totalEnARS).toLocaleString('es-AR')}`

  const totalEquivalente =
    resumen.monedaOrigen === 'USD'
      ? `ARS $${Math.round(resumen.totalEnARS).toLocaleString('es-AR')}`
      : `USD ${resumen.totalEnUSD.toFixed(2)}`

  return [
    'Hola! Te paso este pedido para confirmar stock:',
    '',
    ...lineasProductos,
    '',
    `Cantidad total: ${resumen.totalUnidades} ${etiquetaUnidades} (Escala aplicada: ${resumen.escalaAplicada})`,
    `TOTAL: ${totalPrincipal} (Aprox. ${totalEquivalente})`,
  ].join('\n')
}

/**
 * Store del carrito simulador multi-proveedor persistido en localStorage.
 * Agrupa los pedidos por proveedor y calcula escalas mayoristas (12+ y 24+) de forma automática o simulada.
 */
export const useCarritoStore = create<EstadoCarrito>()(
  persist(
    (set, get) => ({
      items: [],
      escalaForzadaPorProveedor: {},

      agregarItem: (entrada: EntradaAgregarCarrito) => {
        const cantidadAAgregar = Math.max(1, Math.floor(entrada.cantidad ?? 1))

        set((estado) => {
          const indiceExistente = estado.items.findIndex(
            (item) =>
              item.productoId === entrada.productoId &&
              item.proveedor === entrada.proveedor,
          )

          if (indiceExistente >= 0) {
            const itemsActualizados = estado.items.map((item, indice) =>
              indice === indiceExistente
                ? {
                    ...item,
                    cantidad: item.cantidad + cantidadAAgregar,
                    precioBase: entrada.precioBase,
                    precio12: entrada.precio12,
                    precio24: entrada.precio24,
                    imagenUrl: entrada.imagenUrl ?? item.imagenUrl,
                  }
                : item,
            )
            return { items: itemsActualizados }
          }

          const nuevoItem: ItemCarrito = {
            productoId: entrada.productoId,
            proveedor: entrada.proveedor,
            cantidad: cantidadAAgregar,
            marca: entrada.marca,
            nombre: entrada.nombre,
            concentracion: entrada.concentracion,
            ml: entrada.ml,
            imagenUrl: entrada.imagenUrl,
            moneda: entrada.moneda,
            precioBase: entrada.precioBase,
            precio12: entrada.precio12,
            precio24: entrada.precio24,
          }

          return { items: [...estado.items, nuevoItem] }
        })
      },

      quitarItem: (productoId: number, proveedor: string) => {
        set((estado) => ({
          items: estado.items.filter(
            (item) =>
              !(item.productoId === productoId && item.proveedor === proveedor),
          ),
        }))
      },

      actualizarCantidad: (productoId: number, proveedor: string, cantidad: number) => {
        const cantidadEntera = Math.floor(cantidad)
        if (cantidadEntera <= 0) {
          get().quitarItem(productoId, proveedor)
          return
        }

        set((estado) => ({
          items: estado.items.map((item) =>
            item.productoId === productoId && item.proveedor === proveedor
              ? { ...item, cantidad: cantidadEntera }
              : item,
          ),
        }))
      },

      incrementarCantidad: (productoId: number, proveedor: string, delta = 1) => {
        const itemActual = get().items.find(
          (item) => item.productoId === productoId && item.proveedor === proveedor,
        )
        if (!itemActual) return
        get().actualizarCantidad(productoId, proveedor, itemActual.cantidad + delta)
      },

      vaciarCarrito: () => {
        set({ items: [], escalaForzadaPorProveedor: {} })
      },

      vaciarProveedor: (proveedor: string) => {
        set((estado) => {
          const siguientesEscalas = { ...estado.escalaForzadaPorProveedor }
          delete siguientesEscalas[proveedor]
          return {
            items: estado.items.filter((item) => item.proveedor !== proveedor),
            escalaForzadaPorProveedor: siguientesEscalas,
          }
        })
      },

      reemplazarItemsCarrito: (nuevosItems: ItemCarrito[]) => {
        set({
          items: nuevosItems.map((item) => ({ ...item })),
        })
      },

      setEscalaProveedor: (proveedor: string, modo: ModoEscalaMayorista) => {
        set((estado) => ({
          escalaForzadaPorProveedor: {
            ...estado.escalaForzadaPorProveedor,
            [proveedor]: modo,
          },
        }))
      },

      sincronizarPreciosDesdeCatalogo: (productos: ProductoComparado[]) => {
        if (productos.length === 0) return
        const mapaProductos = new Map<number, ProductoComparado>(
          productos.map((producto) => [producto.producto_id, producto]),
        )

        set((estado) => ({
          items: estado.items.map((item) => {
            const productoActual = mapaProductos.get(item.productoId)
            const ofertaActual = productoActual?.ofertas[item.proveedor]
            if (!productoActual || !ofertaActual || ofertaActual.precioBase === null) {
              return item
            }

            return {
              ...item,
              marca: productoActual.marca,
              nombre: productoActual.nombre,
              concentracion: productoActual.concentracion,
              ml: productoActual.ml,
              imagenUrl: productoActual.imagen_url,
              moneda: ofertaActual.moneda,
              precioBase: ofertaActual.precioBase,
              precio12: ofertaActual.precio12,
              precio24: ofertaActual.precio24,
            }
          }),
        }))
      },

      obtenerResumenPorProveedor: (proveedor: string, dolarDelDia: number) => {
        const { items, escalaForzadaPorProveedor } = get()
        const modoEscala = escalaForzadaPorProveedor[proveedor] ?? 'AUTO'
        return calcularResumenProveedor(items, proveedor, modoEscala, dolarDelDia)
      },

      obtenerResumenesCarrito: (dolarDelDia: number) => {
        const { items, escalaForzadaPorProveedor } = get()
        return calcularResumenesPorProveedor(items, escalaForzadaPorProveedor, dolarDelDia)
      },

      generarMensajeWhatsApp: (proveedor: string, dolarDelDia: number) => {
        const resumen = get().obtenerResumenPorProveedor(proveedor, dolarDelDia)
        if (!resumen) return ''
        return construirTextoWhatsApp(resumen)
      },

      generarTodosLosMensajes: (dolarDelDia: number) => {
        const resumenes = get().obtenerResumenesCarrito(dolarDelDia)
        const mensajes: Record<string, string> = {}

        for (const resumen of resumenes) {
          mensajes[resumen.proveedor] = construirTextoWhatsApp(resumen)
        }

        return mensajes
      },
    }),
    {
      name: 'perfumeria-carrito-storage',
    },
  ),
)
