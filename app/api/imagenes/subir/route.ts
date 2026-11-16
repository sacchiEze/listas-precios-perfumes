import { NextResponse } from 'next/server'
import {
  crearClienteSupabaseAdmin,
  estaSupabaseConfigurado,
} from '@/lib/supabase/cliente'

const BUCKET_IMAGENES = 'perfumes-imagenes'
const LIMITE_BYTES_ARCHIVO = 10 * 1024 * 1024 // 10 MB

function obtenerExtensionSegura(mimeType: string, nombreOriginal: string): string {
  const tipo = mimeType.toLowerCase()
  if (tipo.includes('webp')) return 'webp'
  if (tipo.includes('jpeg') || tipo.includes('jpg')) return 'jpg'
  if (tipo.includes('png')) return 'png'
  if (tipo.includes('avif')) return 'avif'
  if (tipo.includes('gif')) return 'gif'

  const coincidencia = nombreOriginal.toLowerCase().match(/\.([a-z0-9]{2,5})$/)
  return coincidencia?.[1] ?? 'webp'
}

/**
 * POST /api/imagenes/subir
 *
 * Recibe una imagen ya recortada en proporción 1:1 y optimizada en el cliente
 * mediante `multipart/form-data`, la almacena en el bucket público `perfumes-imagenes`
 * de Supabase Storage y actualiza `imagen_url` en `catalogo_productos`.
 */
export async function POST(request: Request) {
  if (!estaSupabaseConfigurado()) {
    return NextResponse.json(
      { error: 'Supabase no está configurado en el servidor.' },
      { status: 500 },
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { error: 'No se pudo procesar el formulario de subida de imagen.' },
      { status: 400 },
    )
  }

  const productoIdRaw = formData.get('productoId')
  const productoId = Number(productoIdRaw)
  if (!Number.isInteger(productoId) || productoId <= 0) {
    return NextResponse.json(
      { error: 'El productoId debe ser un entero positivo.' },
      { status: 400 },
    )
  }

  const archivo = formData.get('archivo')
  if (!(archivo instanceof Blob) || archivo.size === 0) {
    return NextResponse.json(
      { error: 'No se recibió ningún archivo de imagen válido.' },
      { status: 400 },
    )
  }

  if (archivo.size > LIMITE_BYTES_ARCHIVO) {
    return NextResponse.json(
      { error: 'El archivo supera el límite máximo permitido de 10 MB.' },
      { status: 400 },
    )
  }

  const supabaseAdmin = crearClienteSupabaseAdmin()

  // Garantizamos que el bucket exista y sea público antes de subir
  const { data: bucketsExistentes } = await supabaseAdmin.storage.listBuckets()
  const existeBucket = (bucketsExistentes ?? []).some(
    (b) => b.id === BUCKET_IMAGENES,
  )

  if (!existeBucket) {
    await supabaseAdmin.storage.createBucket(BUCKET_IMAGENES, {
      public: true,
      fileSizeLimit: LIMITE_BYTES_ARCHIVO,
    })
  }

  const nombreOriginal =
    archivo instanceof File && archivo.name ? archivo.name : 'perfume.webp'
  const contentType = archivo.type || 'image/webp'
  const extension = obtenerExtensionSegura(contentType, nombreOriginal)
  const rutaArchivo = `productos/perfume-${productoId}-${Date.now()}.${extension}`

  const bufferArchivo = Buffer.from(await archivo.arrayBuffer())

  const { error: errorSubida } = await supabaseAdmin.storage
    .from(BUCKET_IMAGENES)
    .upload(rutaArchivo, bufferArchivo, {
      contentType,
      cacheControl: '31536000',
      upsert: true,
    })

  if (errorSubida) {
    return NextResponse.json(
      {
        error: `No se pudo subir la imagen a Supabase Storage: ${errorSubida.message}`,
      },
      { status: 500 },
    )
  }

  const { data: publicUrlData } = supabaseAdmin.storage
    .from(BUCKET_IMAGENES)
    .getPublicUrl(rutaArchivo)

  const imagenUrl = publicUrlData.publicUrl

  const { error: errorBaseDatos } = await supabaseAdmin
    .from('catalogo_productos')
    .update({ imagen_url: imagenUrl })
    .eq('id', productoId)

  if (errorBaseDatos) {
    return NextResponse.json(
      {
        error: `La imagen se subió pero no se pudo vincular al producto ${productoId}: ${errorBaseDatos.message}`,
      },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    productoId,
    imagenUrl,
    bytes: bufferArchivo.byteLength,
  })
}
