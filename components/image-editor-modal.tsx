'use client'

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import {
  Check,
  Crop,
  ImagePlus,
  Link2,
  Loader2,
  Maximize2,
  Minimize2,
  Move,
  RotateCw,
  Sparkles,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type { ProductoComparado } from '@/types/perfumeria'

export type ModoEditorImagen = 'upload' | 'url'

const TAMANO_LIENZO_SALIDA = 600
const TAMANO_VISOR_CSS = 296
const CALIDAD_WEBP_INICIAL = 0.84
const CALIDAD_WEBP_COMPRIMIDA = 0.75
const UMBRAL_RECOMPRESION_BYTES = 95 * 1024 // 95 KB

export function formatearTamanoBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(2)} MB`
}

function detectarFormatoLegible(mimeType: string, nombreArchivo?: string): string {
  const limpio = mimeType.toLowerCase()
  if (limpio.includes('webp')) return 'WebP'
  if (limpio.includes('png')) return 'PNG'
  if (limpio.includes('jpeg') || limpio.includes('jpg')) return 'JPEG'
  if (limpio.includes('avif')) return 'AVIF'
  if (limpio.includes('gif')) return 'GIF'
  if (limpio.includes('svg')) return 'SVG'
  if (limpio.includes('bmp')) return 'BMP'
  if (limpio.includes('tiff') || limpio.includes('tif')) return 'TIFF'
  if (limpio.includes('heic') || limpio.includes('heif')) return 'HEIC'

  if (nombreArchivo) {
    const ext = nombreArchivo.split('.').pop()?.toUpperCase()
    if (ext && ext.length <= 5) return ext
  }
  return 'Imagen'
}

/**
 * Dibuja la imagen sobre un lienzo cuadrado 1:1 preservando estrictamente
 * la relación de aspecto original (escala uniforme en X e Y: nunca estira ni deforma).
 */
function dibujarRecorte1x1EnCanvas(
  canvas: HTMLCanvasElement,
  imagen: HTMLImageElement,
  zoom: number,
  offset: { x: number; y: number },
  rotacionGrados: number,
  tamanoSalida = TAMANO_LIENZO_SALIDA,
) {
  canvas.width = tamanoSalida
  canvas.height = tamanoSalida

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // Fondo blanco puro de estudio para que botellas verticales o PNGs con transparencia
  // mantengan estética uniforme en el catálogo sin bordes oscuros.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, tamanoSalida, tamanoSalida)

  const rotacionNormalizada = ((rotacionGrados % 360) + 360) % 360
  const intercambiaEjes =
    rotacionNormalizada === 90 || rotacionNormalizada === 270

  const anchoNatural = Math.max(1, imagen.naturalWidth || imagen.width)
  const altoNatural = Math.max(1, imagen.naturalHeight || imagen.height)

  const anchoEfectivo = intercambiaEjes ? altoNatural : anchoNatural
  const altoEfectivo = intercambiaEjes ? anchoNatural : altoNatural

  // Escala base "Encajar" (fit): toda la imagen entra en el cuadrado 1:1 sin deformarse
  const escalaBaseFit = Math.min(
    tamanoSalida / anchoEfectivo,
    tamanoSalida / altoEfectivo,
  )

  // Escala uniforme idéntica para ancho y alto -> garantiza 0% estiramiento
  const escalaUniforme = escalaBaseFit * zoom
  const factorDesplazamiento = tamanoSalida / TAMANO_VISOR_CSS

  ctx.translate(
    tamanoSalida / 2 + offset.x * factorDesplazamiento,
    tamanoSalida / 2 + offset.y * factorDesplazamiento,
  )
  ctx.rotate((rotacionNormalizada * Math.PI) / 180)

  const anchoDibujo = anchoNatural * escalaUniforme
  const altoDibujo = altoNatural * escalaUniforme

  ctx.drawImage(
    imagen,
    -anchoDibujo / 2,
    -altoDibujo / 2,
    anchoDibujo,
    altoDibujo,
  )
  ctx.restore()
}

function exportarCanvasOptimizado(
  canvas: HTMLCanvasElement,
  calidad: number,
  mimeType = 'image/webp',
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        resolve(blob)
      },
      mimeType,
      calidad,
    )
  })
}

async function generarBlobOptimizado1x1(
  canvas: HTMLCanvasElement,
): Promise<{ blob: Blob; formato: string }> {
  let blob = await exportarCanvasOptimizado(
    canvas,
    CALIDAD_WEBP_INICIAL,
    'image/webp',
  )

  if (blob && blob.type === 'image/webp') {
    if (blob.size > UMBRAL_RECOMPRESION_BYTES) {
      const recomprimido = await exportarCanvasOptimizado(
        canvas,
        CALIDAD_WEBP_COMPRIMIDA,
        'image/webp',
      )
      if (recomprimido && recomprimido.size < blob.size) {
        blob = recomprimido
      }
    }
    return { blob, formato: 'WebP' }
  }

  // Respaldo JPEG si el navegador no codificara WebP
  const blobJpeg = await exportarCanvasOptimizado(
    canvas,
    CALIDAD_WEBP_INICIAL,
    'image/jpeg',
  )
  if (!blobJpeg) {
    throw new Error('No se pudo optimizar la imagen en el navegador.')
  }
  return { blob: blobJpeg, formato: 'JPEG' }
}

export interface PropsModalEditorImagen {
  producto: ProductoComparado
  modoInicial: ModoEditorImagen
  archivoInicial?: File | null
  usandoDemo: boolean
  onCerrar: () => void
  onGuardarUrl: (nuevaUrl: string) => Promise<void>
  onGuardarArchivoOptimizado: (
    blobOptimizado: Blob,
    dataUrlRespaldo: string,
  ) => Promise<void>
}

export function ModalEditorImagenPerfume({
  producto,
  modoInicial,
  archivoInicial = null,
  onCerrar,
  onGuardarUrl,
  onGuardarArchivoOptimizado,
}: PropsModalEditorImagen) {
  const inputArchivoId = useId()
  const inputArchivoRef = useRef<HTMLInputElement | null>(null)
  const canvasVisorRef = useRef<HTMLCanvasElement | null>(null)

  const [pestana, setPestana] = useState<ModoEditorImagen>(modoInicial)
  const [urlInput, setUrlInput] = useState(producto.imagen_url ?? '')

  // Estado de la imagen cargada en el recortador visual 1:1
  const [elementoImagen, setElementoImagen] =
    useState<HTMLImageElement | null>(null)
  const [cargandoImagen, setCargandoImagen] = useState(false)
  const [arrastrandoArchivo, setArrastrandoArchivo] = useState(false)

  // Parámetros de encuadre manual 1:1 (nunca estiran la imagen)
  const [zoom, setZoom] = useState(1)
  const [zoomRellenar, setZoomRellenar] = useState(1.25)
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [rotacion, setRotacion] = useState(0)
  const [arrastrandoLienzo, setArrastrandoLienzo] = useState(false)
  const puntoInicioArrastreRef = useRef<{
    cursorX: number
    cursorY: number
    offsetX: number
    offsetY: number
  } | null>(null)

  // Metadatos de optimización
  const [infoOriginal, setInfoOriginal] = useState<{
    nombre: string
    formato: string
    bytes: number | null
    ancho: number
    alto: number
  } | null>(null)
  const [infoOptimizada, setInfoOptimizada] = useState<{
    blob: Blob
    urlPreview: string
    formato: string
    bytes: number
  } | null>(null)

  const [guardando, setGuardando] = useState(false)
  const [errorLocal, setErrorLocal] = useState<string | null>(null)

  const calcularFactorRelleno = useCallback(
    (img: HTMLImageElement, rotacionGrados: number) => {
      const rot = ((rotacionGrados % 360) + 360) % 360
      const intercambia = rot === 90 || rot === 270
      const w = Math.max(1, intercambia ? img.naturalHeight : img.naturalWidth)
      const h = Math.max(1, intercambia ? img.naturalWidth : img.naturalHeight)
      const relacion = Math.max(w / h, h / w)
      return Number(Math.max(1, relacion).toFixed(3))
    },
    [],
  )

  const cargarDesdeFuente = useCallback(
    (
      src: string,
      metadatos: {
        nombre: string
        formato: string
        bytes: number | null
        revocarAlTerminar?: boolean
        modoInicialEncuadre?: 'fit' | 'cover'
      },
    ) => {
      setCargandoImagen(true)
      setErrorLocal(null)

      const img = new Image()
      img.crossOrigin = 'anonymous'

      img.onload = () => {
        if (metadatos.revocarAlTerminar) {
          URL.revokeObjectURL(src)
        }
        const factorCover = calcularFactorRelleno(img, 0)
        setElementoImagen(img)
        setRotacion(0)
        setZoomRellenar(factorCover)
        // Si la imagen es casi cuadrada o el usuario sube un recorte, iniciamos en encajar/rellenar suave
        const zoomInicial =
          metadatos.modoInicialEncuadre === 'cover' ? factorCover : 1
        setZoom(zoomInicial)
        setOffset({ x: 0, y: 0 })
        setInfoOriginal({
          nombre: metadatos.nombre,
          formato: metadatos.formato,
          bytes: metadatos.bytes,
          ancho: img.naturalWidth || img.width,
          alto: img.naturalHeight || img.height,
        })
        setCargandoImagen(false)
        setPestana('upload')
      }

      img.onerror = () => {
        if (metadatos.revocarAlTerminar) {
          URL.revokeObjectURL(src)
        }
        setCargandoImagen(false)
        setErrorLocal(
          'No se pudo decodificar la imagen seleccionada. Probá con otro archivo o enlace.',
        )
      }

      img.src = src
    },
    [calcularFactorRelleno],
  )

  const procesarArchivoSeleccionado = useCallback(
    (archivo: File) => {
      if (!archivo) return
      const urlObjeto = URL.createObjectURL(archivo)
      const formato = detectarFormatoLegible(archivo.type, archivo.name)
      cargarDesdeFuente(urlObjeto, {
        nombre: archivo.name,
        formato,
        bytes: archivo.size,
        revocarAlTerminar: true,
        modoInicialEncuadre: 'fit',
      })
    },
    [cargarDesdeFuente],
  )

  const cargarUrlEnRecortador = useCallback(
    (urlExterna: string) => {
      const limpia = urlExterna.trim()
      if (!limpia) return

      if (limpia.startsWith('data:') || limpia.startsWith('blob:')) {
        cargarDesdeFuente(limpia, {
          nombre: `${producto.marca} ${producto.nombre}`,
          formato: 'Imagen actual',
          bytes: null,
        })
        return
      }

      const urlProxy = `/api/imagenes/proxy?url=${encodeURIComponent(limpia)}`
      cargarDesdeFuente(urlProxy, {
        nombre: `${producto.marca} ${producto.nombre}`,
        formato: detectarFormatoLegible('', limpia),
        bytes: null,
      })
    },
    [cargarDesdeFuente, producto.marca, producto.nombre],
  )

  // Si se abrió con un archivo inicial o con la imagen actual para recortar
  useEffect(() => {
    if (archivoInicial) {
      procesarArchivoSeleccionado(archivoInicial)
    } else if (modoInicial === 'upload' && producto.imagen_url) {
      cargarUrlEnRecortador(producto.imagen_url)
    }
  }, [archivoInicial, modoInicial, producto.imagen_url, procesarArchivoSeleccionado, cargarUrlEnRecortador])

  // Soporte para pegar imagen directamente desde el portapapeles (Ctrl+V)
  useEffect(() => {
    const manejarPaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items
      if (!items) return

      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const archivo = item.getAsFile()
          if (archivo) {
            event.preventDefault()
            procesarArchivoSeleccionado(archivo)
            return
          }
        }
      }
    }

    window.addEventListener('paste', manejarPaste)
    return () => window.removeEventListener('paste', manejarPaste)
  }, [procesarArchivoSeleccionado])

  // Redibuja el lienzo 1:1 en tiempo real al mover, hacer zoom o rotar
  useEffect(() => {
    const canvas = canvasVisorRef.current
    if (!canvas || !elementoImagen) return

    dibujarRecorte1x1EnCanvas(
      canvas,
      elementoImagen,
      zoom,
      offset,
      rotacion,
      TAMANO_LIENZO_SALIDA,
    )
  }, [elementoImagen, zoom, offset, rotacion])

  // Calcula de forma reactiva (con debounce corto) la versión optimizada 1:1 en WebP
  useEffect(() => {
    const canvas = canvasVisorRef.current
    if (!canvas || !elementoImagen) return

    let cancelado = false
    const timer = window.setTimeout(async () => {
      try {
        const { blob, formato } = await generarBlobOptimizado1x1(canvas)
        if (cancelado) return
        const nuevaUrlPreview = URL.createObjectURL(blob)
        setInfoOptimizada((previo) => {
          if (previo?.urlPreview) {
            URL.revokeObjectURL(previo.urlPreview)
          }
          return {
            blob,
            urlPreview: nuevaUrlPreview,
            formato,
            bytes: blob.size,
          }
        })
      } catch {
        // Ignoramos errores transitorios durante el arrastre
      }
    }, 140)

    return () => {
      cancelado = true
      window.clearTimeout(timer)
    }
  }, [elementoImagen, zoom, offset, rotacion])

  // Limpieza del ObjectURL de vista previa al desmontar
  useEffect(() => {
    return () => {
      if (infoOptimizada?.urlPreview) {
        URL.revokeObjectURL(infoOptimizada.urlPreview)
      }
    }
  }, [infoOptimizada?.urlPreview])

  const limitarOffset = useCallback(
    (nuevoX: number, nuevoY: number) => {
      const limite = Math.max(TAMANO_VISOR_CSS * 0.65, TAMANO_VISOR_CSS * zoom * 0.55)
      return {
        x: Math.max(-limite, Math.min(limite, nuevoX)),
        y: Math.max(-limite, Math.min(limite, nuevoY)),
      }
    },
    [zoom],
  )

  const manejarPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!elementoImagen) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setArrastrandoLienzo(true)
    puntoInicioArrastreRef.current = {
      cursorX: event.clientX,
      cursorY: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    }
  }

  const manejarPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!arrastrandoLienzo || !puntoInicioArrastreRef.current) return
    const dx = event.clientX - puntoInicioArrastreRef.current.cursorX
    const dy = event.clientY - puntoInicioArrastreRef.current.cursorY
    setOffset(
      limitarOffset(
        puntoInicioArrastreRef.current.offsetX + dx,
        puntoInicioArrastreRef.current.offsetY + dy,
      ),
    )
  }

  const manejarPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setArrastrandoLienzo(false)
    puntoInicioArrastreRef.current = null
  }

  const manejarRuedaZoom = (event: ReactWheelEvent<HTMLCanvasElement>) => {
    if (!elementoImagen) return
    event.preventDefault()
    const paso = event.deltaY < 0 ? 0.08 : -0.08
    setZoom((previo) =>
      Number(Math.min(4, Math.max(0.5, previo + paso)).toFixed(2)),
    )
  }

  const manejarRotar90 = () => {
    if (!elementoImagen) return
    const nuevaRotacion = (rotacion + 90) % 360
    setRotacion(nuevaRotacion)
    setZoomRellenar(calcularFactorRelleno(elementoImagen, nuevaRotacion))
  }

  const manejarCambioInputArchivo = (event: ChangeEvent<HTMLInputElement>) => {
    const archivo = event.target.files?.[0]
    if (archivo) {
      procesarArchivoSeleccionado(archivo)
    }
    event.target.value = ''
  }

  const manejarDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setArrastrandoArchivo(false)
    const archivo = event.dataTransfer.files?.[0]
    if (archivo) {
      procesarArchivoSeleccionado(archivo)
    }
  }

  const manejarGuardarImagenRecortada = async () => {
    const canvas = canvasVisorRef.current
    if (!canvas || !elementoImagen) return

    setGuardando(true)
    setErrorLocal(null)

    try {
      dibujarRecorte1x1EnCanvas(
        canvas,
        elementoImagen,
        zoom,
        offset,
        rotacion,
        TAMANO_LIENZO_SALIDA,
      )
      const { blob } = await generarBlobOptimizado1x1(canvas)
      const dataUrlRespaldo = canvas.toDataURL('image/webp', CALIDAD_WEBP_INICIAL)

      await onGuardarArchivoOptimizado(blob, dataUrlRespaldo)
      onCerrar()
    } catch (error) {
      setErrorLocal(
        error instanceof Error
          ? error.message
          : 'No se pudo subir la imagen optimizada.',
      )
    } finally {
      setGuardando(false)
    }
  }

  const manejarGuardarUrlDirecta = async () => {
    const limpia = urlInput.trim()
    if (!limpia) return

    setGuardando(true)
    setErrorLocal(null)

    try {
      await onGuardarUrl(limpia)
      onCerrar()
    } catch (error) {
      setErrorLocal(
        error instanceof Error
          ? error.message
          : 'No se pudo actualizar la URL de la imagen.',
      )
    } finally {
      setGuardando(false)
    }
  }

  const porcentajeAhorro =
    infoOriginal?.bytes &&
    infoOptimizada?.bytes &&
    infoOriginal.bytes > infoOptimizada.bytes
      ? Math.round(
          ((infoOriginal.bytes - infoOptimizada.bytes) / infoOriginal.bytes) *
            100,
        )
      : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-xs sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget && !guardando) {
          onCerrar()
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-imagen"
        className="dashboard-card dashboard-modal max-h-[92vh] w-full max-w-[540px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-6"
      >
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.12em] text-violet-600">
              <Crop size={12} />
              Editor de imagen 1:1
            </span>
            <h3
              id="titulo-modal-imagen"
              className="mt-0.5 text-[16px] font-semibold tracking-tight text-slate-900"
            >
              {producto.marca} · {producto.nombre}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            disabled={guardando}
            aria-label="Cerrar editor de imagen"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </div>

        {/* Selector de modo (Menú en pestañas) */}
        <div className="mt-4 grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setPestana('upload')}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 text-[12px] font-semibold transition ${
              pestana === 'upload'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ImagePlus size={14} />
            <span>Subir y recortar (1:1)</span>
          </button>
          <button
            type="button"
            onClick={() => setPestana('url')}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 text-[12px] font-semibold transition ${
              pestana === 'url'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Link2 size={14} />
            <span>Ingresar link (URL)</span>
          </button>
        </div>

        {/* Input oculto universal para cualquier formato de imagen */}
        <input
          ref={inputArchivoRef}
          id={inputArchivoId}
          type="file"
          accept="image/*,.webp,.png,.jpg,.jpeg,.avif,.gif,.bmp,.svg,.tif,.tiff,.heic,.heif,.ico,.jfif"
          onChange={manejarCambioInputArchivo}
          className="hidden"
        />

        {errorLocal && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[11px] text-rose-700">
            {errorLocal}
          </div>
        )}

        {pestana === 'upload' ? (
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setArrastrandoArchivo(true)
            }}
            onDragLeave={() => setArrastrandoArchivo(false)}
            onDrop={manejarDrop}
            className="mt-4"
          >
            {!elementoImagen && !cargandoImagen ? (
              <div
                onClick={() => inputArchivoRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-9 text-center transition ${
                  arrastrandoArchivo
                    ? 'border-violet-500 bg-violet-50/60'
                    : 'border-slate-200 bg-slate-50/60 hover:border-violet-300 hover:bg-violet-50/30'
                }`}
              >
                <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                  <Upload size={20} />
                </span>
                <p className="text-[13px] font-semibold text-slate-800">
                  Hacé click para elegir una imagen o arrastrala acá
                </p>
                <p className="mt-1 max-w-[340px] text-[11px] text-slate-500">
                  Admite cualquier formato (JPG, PNG, WebP, AVIF, GIF, BMP, SVG,
                  HEIC) o pegá directo con{' '}
                  <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                    Ctrl+V
                  </kbd>
                </p>

                {producto.imagen_url && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      cargarUrlEnRecortador(producto.imagen_url!)
                    }}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow-2xs transition hover:bg-slate-50"
                  >
                    <Crop size={12} />
                    Ajustar imagen actual del producto
                  </button>
                )}
              </div>
            ) : cargandoImagen ? (
              <div className="flex h-[300px] flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 text-[12px] text-slate-500">
                <Loader2 size={22} className="animate-spin text-violet-600" />
                <span>Cargando imagen en el recortador 1:1...</span>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Barra superior de selección de archivo y preajustes 1:1 sin deformación */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => inputArchivoRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <Upload size={12} />
                    Cambiar archivo
                  </button>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setZoom(1)
                        setOffset({ x: 0, y: 0 })
                      }}
                      title="Encajar toda la botella dentro del cuadro 1:1 sin cortar nada"
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
                        Math.abs(zoom - 1) < 0.03 &&
                        offset.x === 0 &&
                        offset.y === 0
                          ? 'border-violet-300 bg-violet-50 text-violet-800'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Minimize2 size={12} />
                      Encajar todo
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setZoom(zoomRellenar)
                        setOffset({ x: 0, y: 0 })
                      }}
                      title="Cubrir todo el cuadrado 1:1 sin márgenes manteniendo la proporción"
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
                        Math.abs(zoom - zoomRellenar) < 0.03 && zoomRellenar > 1
                          ? 'border-violet-300 bg-violet-50 text-violet-800'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Maximize2 size={12} />
                      Rellenar 1:1
                    </button>

                    <button
                      type="button"
                      onClick={manejarRotar90}
                      title="Rotar 90°"
                      aria-label="Rotar 90 grados"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50"
                    >
                      <RotateCw size={12} />
                      90°
                    </button>
                  </div>
                </div>

                {/* Escenario visual interactivo 1:1 */}
                <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-100/80 p-3">
                  <div
                    className="relative overflow-hidden rounded-xl bg-white shadow-md ring-2 ring-violet-500/80"
                    style={{
                      width: TAMANO_VISOR_CSS,
                      height: TAMANO_VISOR_CSS,
                    }}
                  >
                    <canvas
                      ref={canvasVisorRef}
                      onPointerDown={manejarPointerDown}
                      onPointerMove={manejarPointerMove}
                      onPointerUp={manejarPointerUp}
                      onPointerCancel={manejarPointerUp}
                      onWheel={manejarRuedaZoom}
                      className={`size-full touch-none select-none ${
                        arrastrandoLienzo ? 'cursor-grabbing' : 'cursor-grab'
                      }`}
                    />

                    {/* Cuadrícula guía de tercios 1:1 */}
                    <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                      <div className="border-b border-r border-slate-400/25" />
                      <div className="border-b border-r border-slate-400/25" />
                      <div className="border-b border-slate-400/25" />
                      <div className="border-b border-r border-slate-400/25" />
                      <div className="border-b border-r border-slate-400/25" />
                      <div className="border-b border-slate-400/25" />
                      <div className="border-r border-slate-400/25" />
                      <div className="border-r border-slate-400/25" />
                      <div />
                    </div>

                    <span className="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-md bg-slate-900/70 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-xs">
                      <Move size={10} />
                      Arrastrá para encuadrar · 1:1
                    </span>
                  </div>

                  {/* Control deslizante de Zoom sin deformación */}
                  <div className="mt-3 flex w-full max-w-[320px] items-center gap-2.5">
                    <button
                      type="button"
                      aria-label="Alejar"
                      onClick={() =>
                        setZoom((z) =>
                          Number(Math.max(0.5, z - 0.1).toFixed(2)),
                        )
                      }
                      className="rounded-md p-1 text-slate-500 hover:bg-white hover:text-slate-800"
                    >
                      <ZoomOut size={15} />
                    </button>
                    <input
                      aria-label="Nivel de zoom"
                      type="range"
                      min="0.5"
                      max="4"
                      step="0.02"
                      value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="h-1.5 flex-1 cursor-pointer accent-violet-700"
                    />
                    <button
                      type="button"
                      aria-label="Acercar"
                      onClick={() =>
                        setZoom((z) => Number(Math.min(4, z + 0.1).toFixed(2)))
                      }
                      className="rounded-md p-1 text-slate-500 hover:bg-white hover:text-slate-800"
                    >
                      <ZoomIn size={15} />
                    </button>
                    <span className="w-11 text-right text-[11px] font-semibold text-slate-600">
                      {Math.round(zoom * 100)}%
                    </span>
                  </div>
                </div>

                {/* Panel de vista previa en catálogo y estado de optimización automática */}
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-11 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
                      {infoOptimizada?.urlPreview ? (
                        <img
                          src={infoOptimizada.urlPreview}
                          alt="Vista previa 1:1"
                          className="size-full object-contain"
                        />
                      ) : (
                        <div className="size-full animate-pulse bg-slate-100" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-800">
                        <Sparkles size={12} className="text-emerald-600" />
                        <span>
                          Optimización automática:{' '}
                          {infoOptimizada
                            ? `${infoOptimizada.formato} 1:1 (${TAMANO_LIENZO_SALIDA}×${TAMANO_LIENZO_SALIDA})`
                            : 'Procesando...'}
                        </span>
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-slate-500">
                        {infoOriginal && (
                          <>
                            Origen: {infoOriginal.formato} ({infoOriginal.ancho}×
                            {infoOriginal.alto}
                            {infoOriginal.bytes
                              ? ` · ${formatearTamanoBytes(infoOriginal.bytes)}`
                              : ''}
                            ){' → '}
                          </>
                        )}
                        {infoOptimizada ? (
                          <strong className="font-semibold text-emerald-700">
                            {formatearTamanoBytes(infoOptimizada.bytes)}
                            {porcentajeAhorro !== null && porcentajeAhorro > 0
                              ? ` (-${porcentajeAhorro}%)`
                              : ''}
                          </strong>
                        ) : (
                          'Calculando peso...'
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Acciones finales pestaña subida */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onCerrar}
                    disabled={guardando}
                    className="rounded-lg border border-slate-200 px-3.5 py-2 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void manejarGuardarImagenRecortada()}
                    disabled={guardando || !elementoImagen}
                    className="primary-action inline-flex items-center gap-1.5 rounded-lg bg-[#34294d] px-4 py-2 text-[11px] font-semibold text-white transition hover:bg-[#45365f] disabled:opacity-50"
                  >
                    {guardando ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        Optimizando y subiendo...
                      </>
                    ) : (
                      <>
                        <Check size={13} />
                        Guardar imagen 1:1 optimizada
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Pestaña de enlace URL */
          <div className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="input-url-perfume"
                className="block text-[11px] font-medium text-slate-600"
              >
                Enlace directo de la imagen (URL)
              </label>
              <input
                id="input-url-perfume"
                type="url"
                value={urlInput}
                onChange={(event) => setUrlInput(event.target.value)}
                placeholder="https://fimgs.net/mdimg/perfume/375x500.12345.jpg"
                className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-800 outline-none focus:border-violet-400"
              />
            </div>

            {urlInput.trim() && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={urlInput.trim()}
                    alt="Vista previa URL"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.src = '/placeholder.jpg'
                    }}
                    className="size-12 shrink-0 rounded-lg border border-slate-200 bg-white object-contain p-0.5"
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-slate-800">
                      ¿Querés recortar o encuadrar este link en 1:1?
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      Podés abrirlo en el editor visual para ajustarlo y
                      optimizarlo a WebP.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => cargarUrlEnRecortador(urlInput)}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11px] font-semibold text-violet-800 transition hover:bg-violet-100"
                >
                  <Crop size={12} />
                  Recortar 1:1
                </button>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onCerrar}
                disabled={guardando}
                className="rounded-lg border border-slate-200 px-3.5 py-2 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void manejarGuardarUrlDirecta()}
                disabled={guardando || !urlInput.trim()}
                className="primary-action inline-flex items-center gap-1.5 rounded-lg bg-[#34294d] px-4 py-2 text-[11px] font-semibold text-white transition hover:bg-[#45365f] disabled:opacity-50"
              >
                {guardando ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar URL directa'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Ícono vectorial exclusivo para productos de tipo `Desodorante`.
 * Representa un envase aerosol con válvula atomizadora y bruma de spray
 * para diferenciarlos visualmente de los frascos de perfume e identificarlos solo por su nombre.
 */
export function IconoBotellaDesodorante({
  className = 'size-[72px]',
  title = 'Desodorante en spray',
}: {
  className?: string
  title?: string
}) {
  return (
    <div
      role="img"
      aria-label={title}
      title={title}
      className={`flex items-center justify-center overflow-hidden rounded-lg border border-slate-200/80 bg-slate-50 text-slate-600 select-none ${className}`}
    >
      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="size-[78%] shrink-0"
        aria-hidden="true"
      >
        {/* Bruma de spray saliendo hacia la derecha */}
        <path
          d="M41 11L49 7M42 15H52M41 19L49 23"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle cx="55" cy="6" r="1.5" fill="currentColor" />
        <circle cx="57" cy="15" r="1.5" fill="currentColor" />
        <circle cx="55" cy="24" r="1.5" fill="currentColor" />

        {/* Cabezal / válvula pulsadora del aerosol */}
        <rect
          x="23"
          y="9"
          width="12"
          height="7"
          rx="2"
          fill="currentColor"
          fillOpacity="0.18"
          stroke="currentColor"
          strokeWidth="2.4"
        />
        <circle cx="32.5" cy="12.5" r="1.3" fill="currentColor" />

        {/* Cuello / hombro curvo del aerosol */}
        <path
          d="M19 24C19 19.2 22.8 16 27.5 16H30.5C35.2 16 39 19.2 39 24V26H19V24Z"
          fill="currentColor"
          fillOpacity="0.14"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />

        {/* Cuerpo cilíndrico alto de la lata de desodorante */}
        <rect
          x="19"
          y="25"
          width="20"
          height="32"
          rx="3.5"
          fill="#ffffff"
          stroke="currentColor"
          strokeWidth="2.5"
        />

        {/* Franja central con etiqueta DEO */}
        <rect
          x="20.2"
          y="33"
          width="17.6"
          height="13"
          fill="currentColor"
          fillOpacity="0.15"
        />
        <text
          x="29"
          y="42"
          textAnchor="middle"
          fill="currentColor"
          fontSize="7.5"
          fontWeight="800"
          letterSpacing="0.6"
          fontFamily="Arial, Helvetica, sans-serif"
        >
          DEO
        </text>
      </svg>
    </div>
  )
}

/**
 * Miniatura de perfume con menú desplegable al hacer click que permite:
 * 1. Subir una imagen en cualquier formato desde el dispositivo (y recortarla en 1:1).
 * 2. Recortar y optimizar visualmente la imagen actual en 1:1.
 * 3. Ingresar o cambiar el link (URL) de la imagen.
 *
 * Para los productos de tipo `Desodorante`, muestra siempre el ícono de botella de desodorante
 * sin imagen fotográfica, evitando confusiones con los frascos de perfume.
 */
export function MiniaturaPerfumeEditable({
  producto,
  onAbrirEditor,
  tamanoClase = 'size-[72px]',
}: {
  producto: ProductoComparado
  onAbrirEditor: (
    producto: ProductoComparado,
    modo: ModoEditorImagen,
    archivo?: File | null,
  ) => void
  tamanoClase?: string
}) {
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [posicionMenu, setPosicionMenu] = useState<{
    top: number
    left: number
  }>({ top: 0, left: 0 })
  const contenedorRef = useRef<HTMLDivElement | null>(null)
  const botonRef = useRef<HTMLButtonElement | null>(null)
  const inputRapidoRef = useRef<HTMLInputElement | null>(null)

  const alternarMenu = () => {
    if (!menuAbierto && botonRef.current) {
      const rect = botonRef.current.getBoundingClientRect()
      const altoEstimadoMenu = 148
      const anchoEstimadoMenu = 228
      const espacioAbajo = window.innerHeight - rect.bottom
      const top =
        espacioAbajo < altoEstimadoMenu && rect.top > altoEstimadoMenu
          ? rect.top - altoEstimadoMenu - 6
          : rect.bottom + 6
      const left = Math.min(
        Math.max(8, rect.left),
        window.innerWidth - anchoEstimadoMenu - 8,
      )
      setPosicionMenu({ top, left })
    }
    setMenuAbierto((prev) => !prev)
  }

  useEffect(() => {
    if (!menuAbierto) return

    const cerrarAlClickAfuera = (event: MouseEvent) => {
      if (
        contenedorRef.current &&
        !contenedorRef.current.contains(event.target as Node)
      ) {
        setMenuAbierto(false)
      }
    }

    const cerrarConEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuAbierto(false)
      }
    }

    const cerrarAlScrollear = () => {
      setMenuAbierto(false)
    }

    document.addEventListener('mousedown', cerrarAlClickAfuera)
    document.addEventListener('keydown', cerrarConEscape)
    window.addEventListener('scroll', cerrarAlScrollear, true)
    window.addEventListener('resize', cerrarAlScrollear)
    return () => {
      document.removeEventListener('mousedown', cerrarAlClickAfuera)
      document.removeEventListener('keydown', cerrarConEscape)
      window.removeEventListener('scroll', cerrarAlScrollear, true)
      window.removeEventListener('resize', cerrarAlScrollear)
    }
  }, [menuAbierto])

  if (producto.tipo === 'Desodorante') {
    return (
      <IconoBotellaDesodorante
        className={`shrink-0 ${tamanoClase}`}
        title={`Desodorante · ${producto.marca} ${producto.nombre}`}
      />
    )
  }

  return (
    <div ref={contenedorRef} className={`relative shrink-0 ${tamanoClase}`}>
      <input
        ref={inputRapidoRef}
        type="file"
        accept="image/*,.webp,.png,.jpg,.jpeg,.avif,.gif,.bmp,.svg,.tif,.tiff,.heic,.heif,.ico,.jfif"
        className="hidden"
        onChange={(event) => {
          const archivo = event.target.files?.[0]
          if (archivo) {
            setMenuAbierto(false)
            onAbrirEditor(producto, 'upload', archivo)
          }
          event.target.value = ''
        }}
      />

      <button
        ref={botonRef}
        type="button"
        aria-label={`Opciones de imagen para ${producto.nombre}`}
        aria-expanded={menuAbierto}
        title="Click para subir, recortar o cambiar imagen"
        onClick={alternarMenu}
        className="group/img relative size-full overflow-hidden rounded-xl border border-slate-200/80 bg-white p-0 focus:outline-none"
        style={{ backgroundColor: '#ffffff' }}
      >
        <img
          src={producto.imagen_url || '/placeholder.jpg'}
          alt={`${producto.marca} ${producto.nombre}`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(event) => {
            event.currentTarget.onerror = null
            event.currentTarget.src = '/placeholder.jpg'
          }}
          className="size-full bg-white object-contain p-0.5"
          style={{ backgroundColor: '#ffffff' }}
        />
        <span
          className={`absolute inset-0 flex items-center justify-center bg-black/50 text-white transition ${
            menuAbierto
              ? 'opacity-100'
              : 'opacity-0 group-hover/img:opacity-100 group-hover:opacity-100'
          }`}
        >
          <ImagePlus size={16} />
        </span>
      </button>

      {menuAbierto && (
        <div
          role="menu"
          aria-label={`Menú de imagen para ${producto.nombre}`}
          style={{
            top: `${posicionMenu.top}px`,
            left: `${posicionMenu.left}px`,
          }}
          className="dashboard-card dashboard-modal fixed z-50 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
        >
          <p className="truncate border-b border-slate-100 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Imagen · {producto.nombre}
          </p>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              inputRapidoRef.current?.click()
            }}
            className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[11px] font-medium text-slate-700 transition hover:bg-violet-50 hover:text-violet-800"
          >
            <Upload size={13} className="shrink-0 text-violet-600" />
            <span>Subir imagen (cualquier formato)</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuAbierto(false)
              onAbrirEditor(producto, 'upload', null)
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[11px] font-medium text-slate-700 transition hover:bg-violet-50 hover:text-violet-800"
          >
            <Crop size={13} className="shrink-0 text-violet-600" />
            <span>Recortar y ajustar (1:1)</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuAbierto(false)
              onAbrirEditor(producto, 'url', null)
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[11px] font-medium text-slate-700 transition hover:bg-violet-50 hover:text-violet-800"
          >
            <Link2 size={13} className="shrink-0 text-slate-500" />
            <span>Ingresar link (URL)</span>
          </button>
        </div>
      )}
    </div>
  )
}
