import { NextResponse } from 'next/server'

const USER_AGENT_NAVEGADOR =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

function esHostPrivadoOLocal(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local')
  ) {
    return true
  }
  if (/^(10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) {
    return true
  }
  return false
}

/**
 * GET /api/imagenes/proxy?url=...
 *
 * Descarga una imagen remota desde el servidor y la sirve con cabeceras CORS
 * del mismo origen para permitir que el recortador visual en `<canvas>` 1:1
 * pueda encuadrar y optimizar también imágenes provenientes de enlaces externos.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const urlObjetivo = searchParams.get('url')?.trim() ?? ''

  if (!urlObjetivo) {
    return NextResponse.json(
      { error: 'Falta el parámetro url.' },
      { status: 400 },
    )
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(urlObjetivo)
  } catch {
    return NextResponse.json(
      { error: 'La URL proporcionada no es válida.' },
      { status: 400 },
    )
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return NextResponse.json(
      { error: 'Solo se admiten enlaces HTTP o HTTPS.' },
      { status: 400 },
    )
  }

  if (esHostPrivadoOLocal(parsedUrl.hostname)) {
    return NextResponse.json(
      { error: 'El host solicitado no está permitido.' },
      { status: 400 },
    )
  }

  try {
    const respuesta = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': USER_AGENT_NAVEGADOR,
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!respuesta.ok) {
      return NextResponse.json(
        { error: `No se pudo descargar la imagen (HTTP ${respuesta.status}).` },
        { status: 400 },
      )
    }

    const contentType =
      respuesta.headers.get('content-type') || 'application/octet-stream'
    const arrayBuffer = await respuesta.arrayBuffer()

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Error al obtener la imagen remota.' },
      { status: 500 },
    )
  }
}
