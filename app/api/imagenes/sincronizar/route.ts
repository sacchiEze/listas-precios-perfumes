import { NextResponse } from 'next/server'
import {
  crearClienteSupabaseAdmin,
  estaSupabaseConfigurado,
} from '@/lib/supabase/cliente'
import { buscarImagenPerfume } from '@/services/imagenesService'
import type {
  CatalogoProducto,
  DetalleSincronizacionImagen,
  ResultadoSincronizacionImagenes,
} from '@/types/perfumeria'

const LIMITE_LOTE_POR_EJECUCION = 50
const LIMITE_MAXIMO_LOTE = 100
const CONCURRENCIA_SINCRONIZACION = 6

interface CuerpoPeticionSincronizacion {
  limite?: number
}

type ProductoPendiente = Pick<
  CatalogoProducto,
  'id' | 'marca' | 'nombre' | 'tipo' | 'imagen_url'
>

/**
 * POST /api/imagenes/sincronizar
 *
 * Busca productos en `catalogo_productos` cuya `imagen_url` sea NULL (excluyendo
 * los desodorantes, que utilizan únicamente el ícono de botella de desodorante),
 * consulta automáticamente la imagen del producto en lotes concurrentes y persiste
 * la URL encontrada respetando cualquier imagen que ya hubiera sido cargada o editada manualmente.
 */
export async function POST(request: Request) {
  if (!estaSupabaseConfigurado()) {
    return NextResponse.json(
      {
        error:
          'Supabase no está configurado. Definí las variables de entorno antes de sincronizar.',
      },
      { status: 500 },
    )
  }

  let limiteSolicitado = LIMITE_LOTE_POR_EJECUCION
  try {
    const cuerpo = (await request.json()) as CuerpoPeticionSincronizacion
    if (
      typeof cuerpo?.limite === 'number' &&
      Number.isFinite(cuerpo.limite) &&
      cuerpo.limite > 0
    ) {
      limiteSolicitado = Math.min(Math.floor(cuerpo.limite), LIMITE_MAXIMO_LOTE)
    }
  } catch {
    // El cuerpo JSON es opcional; si no se envía, usamos el lote por defecto de 50
  }

  const supabaseAdmin = crearClienteSupabaseAdmin()

  const { data: productosPendientes, error: errorConsulta } = await supabaseAdmin
    .from('catalogo_productos')
    .select('id, marca, nombre, tipo, imagen_url')
    .is('imagen_url', null)
    .neq('tipo', 'Desodorante')
    .order('id', { ascending: true })
    .limit(limiteSolicitado)

  if (errorConsulta) {
    return NextResponse.json(
      {
        error: `Error al consultar catalogo_productos: ${errorConsulta.message}`,
      },
      { status: 500 },
    )
  }

  const lote = (productosPendientes ?? []) as ProductoPendiente[]

  if (lote.length === 0) {
    const respuestaVacia: ResultadoSincronizacionImagenes = {
      procesados: 0,
      actualizados: 0,
      sinCoincidencia: 0,
      errores: 0,
      detalles: [],
      mensaje: 'Todos los productos del catálogo ya cuentan con una imagen asignada.',
    }
    return NextResponse.json(respuestaVacia)
  }

  const procesarProducto = async (
    producto: ProductoPendiente,
  ): Promise<DetalleSincronizacionImagen> => {
    try {
      const urlEncontrada = await buscarImagenPerfume(
        producto.marca,
        producto.nombre,
      )

      if (!urlEncontrada) {
        return {
          productoId: producto.id,
          marca: producto.marca,
          nombre: producto.nombre,
          estado: 'sin_coincidencia',
          imagenUrl: null,
          motivo:
            'No se encontró coincidencia confiable en el proveedor de imágenes.',
        }
      }

      // Condición explícita `.is('imagen_url', null)` para no sobrescribir ediciones manuales concurrentes
      const { error: errorActualizacion } = await supabaseAdmin
        .from('catalogo_productos')
        .update({ imagen_url: urlEncontrada })
        .eq('id', producto.id)
        .is('imagen_url', null)

      if (errorActualizacion) {
        return {
          productoId: producto.id,
          marca: producto.marca,
          nombre: producto.nombre,
          estado: 'error',
          imagenUrl: null,
          motivo: errorActualizacion.message,
        }
      }

      return {
        productoId: producto.id,
        marca: producto.marca,
        nombre: producto.nombre,
        estado: 'actualizado',
        imagenUrl: urlEncontrada,
      }
    } catch (error) {
      return {
        productoId: producto.id,
        marca: producto.marca,
        nombre: producto.nombre,
        estado: 'error',
        imagenUrl: null,
        motivo:
          error instanceof Error
            ? error.message
            : 'Error inesperado al buscar imagen.',
      }
    }
  }

  const detalles: DetalleSincronizacionImagen[] = []
  for (let i = 0; i < lote.length; i += CONCURRENCIA_SINCRONIZACION) {
    const subLote = lote.slice(i, i + CONCURRENCIA_SINCRONIZACION)
    const resultadosSubLote = await Promise.all(subLote.map(procesarProducto))
    detalles.push(...resultadosSubLote)
  }

  let actualizados = 0
  let sinCoincidencia = 0
  let errores = 0

  for (const detalle of detalles) {
    if (detalle.estado === 'actualizado') actualizados += 1
    else if (detalle.estado === 'sin_coincidencia') sinCoincidencia += 1
    else errores += 1
  }

  const resultado: ResultadoSincronizacionImagenes = {
    procesados: lote.length,
    actualizados,
    sinCoincidencia,
    errores,
    detalles,
    mensaje: `Lote finalizado: ${actualizados} actualizados, ${sinCoincidencia} sin coincidencia, ${errores} errores.`,
  }

  return NextResponse.json(resultado)
}
