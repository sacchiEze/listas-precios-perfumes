import { normalizarTextoBusqueda } from '@/hooks/useCatalogoPerfumes'

interface HitAlgoliaFragrantica {
  objectID?: string
  id?: number | string
  naslov?: string
  name?: string
  marka?: string
  brand?: string
  url?: string
  slika?: string
  img?: string
  image?: string
}

interface RespuestaAlgolia {
  hits?: HitAlgoliaFragrantica[]
}

interface TarjetaBingImagen {
  purl?: string
  murl?: string
  turl?: string
  t?: string
}

interface ProductoShopifySuggest {
  title?: string
  image?: string
  featured_image?: {
    url?: string
  }
}

interface RespuestaShopifySuggest {
  resources?: {
    results?: {
      products?: ProductoShopifySuggest[]
    }
  }
}

const REGEX_ID_FRAGRANTICA_URL =
  /fragrantica\.(?:com|es|fr|de|it|pl|ru|com\.br)\/perfume\/[^/]+\/([^/?#]+)-(\d+)\.html/i
const REGEX_ID_GENERICO_URL = /-(\d+)\.html/i
const REGEX_ID_IMAGEN_FIMG =
  /fimgs\.net\/mdimg\/perfume(?:-thumbs)?\/(?:\d+x\d+|o|m|t|social)\.(\d+)\.(?:jpg|jpeg|png|webp)/i
const REGEX_ID_IMAGEN_SIMPLE = /\/(\d+)\.(?:jpg|jpeg|png|webp)/i

const USER_AGENT_NAVEGADOR =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

const TIENDAS_SHOPIFY_PERFUMES = [
  'https://tripletraders.com',
  'https://lattafa-usa.com',
  'https://intenseoud.com',
  'https://perfumeoriental.com',
]

const DOMINIOS_IMAGEN_PRIORITARIOS = [
  'fimgs.net',
  'cdn.shopify.com',
  'http2.mlstatic.com',
  'acdn.mitiendanube.com',
  'acdn-us.mitiendanube.com',
  'm.media-amazon.com',
  'cdn.notinoimg.com',
]

const ALIAS_MARCAS: Record<string, string> = {
  'fragance w.': 'Fragrance World',
  'fragance w': 'Fragrance World',
  fw: 'Fragrance World',
  french: 'French Avenue',
  isabele: 'Isabelle La Belle',
  isabelle: 'Isabelle La Belle',
  'niche c.': 'Khalis Niche Collection',
  'niche c': 'Khalis Niche Collection',
  'paris emir': 'Paris Corner Emir',
  'copa del m.zakat': 'Zakat',
  love: 'Love Collection',
  'l-affair': "L'Affair",
  "l'affair": "L'Affair",
}

const TAGS_COLOR_ENVASE =
  /\((?:negro|blanco|rosado|azul|azu|verde|rojo|marron|lila|naranja|dorado|cremita|purple|silver|t\/azul|tapa\s+amarillo|negro\/silv|silver\s+c\/negro|badee|angel)\)/gi

/**
 * Normaliza alias de marcas y abreviaturas habituales de listas mayoristas
 * para obtener consultas limpias y precisas al buscar imágenes de frascos.
 */
export function limpiarConsultaPerfume(
  marca: string,
  nombre: string,
): { marcaLimpia: string; nombreLimpio: string } {
  const marcaBase = marca.trim()
  const marcaLimpia = ALIAS_MARCAS[marcaBase.toLowerCase()] ?? marcaBase

  let nombreLimpio = nombre
    .trim()
    .replace(/"/g, "'")
    .replace(/Fakhar\s*\(Blanco\)/gi, 'Fakhar Rose')
    .replace(/Fakhar\s*\(Negro\)/gi, 'Fakhar Black')
    .replace(/Qaed Al Fursan\s*\(Blanco\)/gi, 'Qaed Al Fursan Unlimited')
    .replace(/Infinity\s*\(Dorado\)/gi, 'Infinity Gold')
    .replace(/Infinity\s*\(Silver\)/gi, 'Infinity Silver')
    .replace(/^G\./i, 'Give Me Gourmand ')
    .replace(/^T\.Pote\b/i, 'Tubbees ')
    .replace(/^M\.Al\b/i, 'Mahd Al ')
    .replace(/^Niche E\./i, 'Niche Emarati ')
    .replace(/^Lux\./i, 'Luxury ')
    .replace(/\bClub D Nuit\b/gi, 'Club De Nuit')
    .replace(/Ico\/Nic/gi, 'Iconic')
    .replace(/\b(?:Inten|Int)\.(?=\s|$|\w)/gi, 'Intense ')
    .replace(/\b(?:Inten|Int)\b/gi, 'Intense')
    .replace(/Sabah\s+Al\.?\s*W(?:a\.?|ard|\.)?\s*/gi, 'Sabah Al Ward ')
    .replace(/Marshmall\./gi, 'Marshmallow ')
    .replace(/S\*X/gi, 'Sex')
    .replace(/P\*Rn/gi, 'Porn')
    .replace(/\bKingdon\b/gi, 'Kingdom')
    .replace(/\bRaghaba\b/gi, 'Raghba')
    .replace(/\bBaroque Roug\b/gi, 'Baroque Rouge')
    .replace(/\bCluods\b/gi, 'Clouds')
    .replace(/\bWord Cup\b/gi, 'World Cup')
    .replace(/\bN02\b/gi, 'No. 2 Men')
    .replace(/\bEqaad\b/gi, 'Eqaab')
    .replace(/\bIntedict\b/gi, 'Interdicted')
    .replace(/\bAtheri\b/gi, 'Atheeri')
    .replace(/\((?:import|imprt|imp|sin sello|sello antiguo|amasado)\)/gi, ' ')
    .replace(
      /\(\s*(?:\d+\s*(?:ml|pz|pzs|pcs)|[^)]*(?:\+|x\d+ml|x\d+pcs)[^)]*)\s*\)/gi,
      ' ',
    )
    .replace(TAGS_COLOR_ENVASE, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!nombreLimpio) {
    nombreLimpio = nombre.trim()
  }

  return { marcaLimpia, nombreLimpio }
}

function construirUrlBotellaFragrantica(idPerfume: string): string {
  return `https://fimgs.net/mdimg/perfume/375x500.${idPerfume}.jpg`
}

function extraerTokensSignificativos(texto: string): string[] {
  return normalizarTextoBusqueda(texto)
    .split(' ')
    .filter((token) => token.length > 1)
}

function calcularPuntajeTokens(
  marcaBuscada: string,
  nombreBuscado: string,
  textoCandidato: string,
): number {
  const tokensNombre = extraerTokensSignificativos(nombreBuscado)
  const tokensMarca = extraerTokensSignificativos(marcaBuscada)
  const tokensTotales = Array.from(new Set([...tokensMarca, ...tokensNombre]))

  if (tokensTotales.length === 0) return 0

  const normalizado = normalizarTextoBusqueda(textoCandidato)
  const palabrasCandidato = new Set(normalizado.split(' ').filter(Boolean))

  let coincidencias = 0
  for (const token of tokensTotales) {
    if (palabrasCandidato.has(token) || normalizado.includes(token)) {
      coincidencias += 1
    }
  }

  // Exigimos que al menos una parte significativa del nombre también aparezca
  if (tokensNombre.length > 0) {
    let coincidenciasNombre = 0
    for (const token of tokensNombre) {
      if (palabrasCandidato.has(token) || normalizado.includes(token)) {
        coincidenciasNombre += 1
      }
    }
    if (coincidenciasNombre === 0) return 0
  }

  return coincidencias / tokensTotales.length
}

function extraerIdPerfumeAlgolia(hit: HitAlgoliaFragrantica): string | null {
  if (hit.id !== undefined && hit.id !== null) {
    const idTexto = String(hit.id).trim()
    if (/^\d+$/.test(idTexto)) return idTexto
  }

  if (hit.objectID && /^\d+$/.test(hit.objectID.trim())) {
    return hit.objectID.trim()
  }

  if (hit.url) {
    const coincidenciaUrl = hit.url.match(REGEX_ID_GENERICO_URL)
    if (coincidenciaUrl?.[1]) return coincidenciaUrl[1]
  }

  const imagenCruda = hit.slika ?? hit.img ?? hit.image
  if (imagenCruda) {
    const coincidenciaImg = imagenCruda.match(REGEX_ID_IMAGEN_SIMPLE)
    if (coincidenciaImg?.[1]) return coincidenciaImg[1]
  }

  return null
}

async function verificarImagenDisponible(
  url: string,
  verificarContentType = false,
): Promise<boolean> {
  try {
    const respuesta = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': USER_AGENT_NAVEGADOR },
      signal: AbortSignal.timeout(4000),
    })
    if (!respuesta.ok) return false
    if (verificarContentType) {
      const tipo = respuesta.headers.get('content-type')?.toLowerCase() ?? ''
      if (tipo && !tipo.startsWith('image/')) return false
    }
    return true
  } catch {
    return false
  }
}

async function consultarAlgoliaFragrantica(
  marca: string,
  nombre: string,
): Promise<string | null> {
  const appId = process.env.FRAGRANTICA_ALGOLIA_APP_ID?.trim()
  const apiKey = process.env.FRAGRANTICA_ALGOLIA_API_KEY?.trim()
  const indice =
    process.env.FRAGRANTICA_ALGOLIA_INDEX?.trim() || 'fragrantica_perfumes'

  if (!appId || !apiKey) {
    return null
  }

  const endpoint = `https://${appId}-dsn.algolia.net/1/indexes/${encodeURIComponent(indice)}/query`
  const consulta = `${marca} ${nombre}`.trim()

  const respuesta = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Algolia-Application-Id': appId,
      'X-Algolia-API-Key': apiKey,
    },
    body: JSON.stringify({
      query: consulta,
      hitsPerPage: 5,
    }),
    signal: AbortSignal.timeout(5000),
  })

  if (!respuesta.ok) {
    return null
  }

  const datos = (await respuesta.json()) as RespuestaAlgolia
  const hits = datos.hits ?? []
  if (hits.length === 0) {
    return null
  }

  const ordenados = [...hits].sort(
    (a, b) =>
      calcularPuntajeTokens(
        marca,
        nombre,
        `${b.marka ?? b.brand ?? ''} ${b.naslov ?? b.name ?? ''} ${b.url ?? ''}`,
      ) -
      calcularPuntajeTokens(
        marca,
        nombre,
        `${a.marka ?? a.brand ?? ''} ${a.naslov ?? a.name ?? ''} ${a.url ?? ''}`,
      ),
  )

  for (const candidato of ordenados) {
    const puntaje = calcularPuntajeTokens(
      marca,
      nombre,
      `${candidato.marka ?? candidato.brand ?? ''} ${candidato.naslov ?? candidato.name ?? ''} ${candidato.url ?? ''}`,
    )
    if (puntaje < 0.5) continue

    const idPerfume = extraerIdPerfumeAlgolia(candidato)
    if (!idPerfume) continue

    const urlBotella = construirUrlBotellaFragrantica(idPerfume)
    if (await verificarImagenDisponible(urlBotella)) {
      return urlBotella
    }
  }

  return null
}

function decodificarEntidadesHtml(texto: string): string {
  return texto
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, codigo) => String.fromCharCode(Number(codigo)))
}

async function consultarBingImagenesHtml(
  consulta: string,
): Promise<{ html: string; tarjetas: TarjetaBingImagen[] } | null> {
  try {
    const url = `https://www.bing.com/images/search?q=${encodeURIComponent(consulta)}&form=HDRSC2&first=1`
    const respuesta = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT_NAVEGADOR,
        'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(6000),
    })

    if (!respuesta.ok) return null

    const html = await respuesta.text()
    const tarjetas: TarjetaBingImagen[] = []

    for (const coincidencia of html.matchAll(/m="(\{&quot;[^"]+\})"/g)) {
      try {
        const jsonTexto = decodificarEntidadesHtml(coincidencia[1])
        const parsed = JSON.parse(jsonTexto) as TarjetaBingImagen
        tarjetas.push(parsed)
      } catch {
        // Ignoramos tarjetas malformadas individuales
      }
    }

    return { html, tarjetas }
  } catch {
    return null
  }
}

/**
 * Fuente A: busca el ID oficial de Fragrantica a través de Bing Image Search
 * (evitando el bloqueo 403 de Cloudflare en fragrantica.com/search/) y verifica
 * que la foto oficial del frasco en fimgs.net responda 200.
 */
async function buscarEnFragranticaViaBing(
  marca: string,
  nombre: string,
): Promise<string | null> {
  const resultado = await consultarBingImagenesHtml(
    `${marca} ${nombre} fragrantica`.trim(),
  )
  if (!resultado) return null

  const candidatosPorId = new Map<string, number>()

  for (const tarjeta of resultado.tarjetas) {
    const textoContexto = `${tarjeta.t ?? ''} ${tarjeta.purl ?? ''}`
    const puntaje = calcularPuntajeTokens(marca, nombre, textoContexto)
    if (puntaje < 0.45) continue

    const matchPage = tarjeta.purl?.match(REGEX_ID_FRAGRANTICA_URL)
    if (matchPage?.[2]) {
      const id = matchPage[2]
      const slug = matchPage[1].replace(/-/g, ' ')
      const puntajeSlug = Math.max(
        puntaje,
        calcularPuntajeTokens(marca, nombre, `${tarjeta.purl ?? ''} ${slug}`),
      )
      candidatosPorId.set(
        id,
        Math.max(candidatosPorId.get(id) ?? 0, puntajeSlug),
      )
    }

    const matchFimg = tarjeta.murl?.match(REGEX_ID_IMAGEN_FIMG)
    if (matchFimg?.[1]) {
      const id = matchFimg[1]
      candidatosPorId.set(id, Math.max(candidatosPorId.get(id) ?? 0, puntaje))
    }
  }

  // Respaldo sobre URLs sueltas de Fragrantica presentes en el HTML devuelto por Bing
  for (const matchUrl of resultado.html.matchAll(
    /https?:\/\/(?:www\.)?fragrantica\.(?:com|es|fr|de|it|pl|ru|com\.br)\/perfume\/([^/"'&\s<>]+)\/([^/"'&\s<>]+)-(\d+)\.html/gi,
  )) {
    const id = matchUrl[3]
    const puntaje = calcularPuntajeTokens(
      marca,
      nombre,
      `${matchUrl[1].replace(/-/g, ' ')} ${matchUrl[2].replace(/-/g, ' ')}`,
    )
    if (puntaje >= 0.45) {
      candidatosPorId.set(id, Math.max(candidatosPorId.get(id) ?? 0, puntaje))
    }
  }

  const ordenados = Array.from(candidatosPorId.entries()).sort(
    (a, b) => b[1] - a[1],
  )

  for (const [idPerfume] of ordenados.slice(0, 5)) {
    const urlBotella = construirUrlBotellaFragrantica(idPerfume)
    if (await verificarImagenDisponible(urlBotella)) {
      return urlBotella
    }
  }

  return null
}

/**
 * Fuente B: consulta las APIs públicas de sugerencia de Shopify en perfumerías árabes
 * especializadas para recuperar fotos de catálogo cuando no existe ficha en Fragrantica.
 */
async function buscarEnTiendasShopify(
  marca: string,
  nombre: string,
): Promise<string | null> {
  const consulta = `${marca} ${nombre}`.trim()

  const resultados = await Promise.all(
    TIENDAS_SHOPIFY_PERFUMES.map(async (tienda) => {
      try {
        const url = `${tienda}/search/suggest.json?q=${encodeURIComponent(consulta)}&resources[type]=product`
        const respuesta = await fetch(url, {
          headers: { 'User-Agent': USER_AGENT_NAVEGADOR },
          signal: AbortSignal.timeout(4500),
        })
        if (!respuesta.ok) return null

        const datos = (await respuesta.json()) as RespuestaShopifySuggest
        const productos = datos.resources?.results?.products ?? []

        let mejorCandidato: { url: string; puntaje: number } | null = null
        for (const prod of productos) {
          const imagen = prod.image || prod.featured_image?.url
          if (!imagen || !prod.title) continue

          const puntaje = calcularPuntajeTokens(marca, nombre, prod.title)
          if (puntaje >= 0.6 && (!mejorCandidato || puntaje > mejorCandidato.puntaje)) {
            mejorCandidato = {
              url: imagen.startsWith('//') ? `https:${imagen}` : imagen,
              puntaje,
            }
          }
        }
        return mejorCandidato
      } catch {
        return null
      }
    }),
  )

  const validos = resultados
    .filter((r): r is { url: string; puntaje: number } => r !== null)
    .sort((a, b) => b.puntaje - a.puntaje)

  for (const candidato of validos) {
    if (await verificarImagenDisponible(candidato.url, true)) {
      return candidato.url
    }
  }

  return null
}

function esCdnPrioritario(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return DOMINIOS_IMAGEN_PRIORITARIOS.some(
      (dominio) => host === dominio || host.endsWith(`.${dominio}`),
    )
  } catch {
    return false
  }
}

/**
 * Fuente C: búsqueda general de fotografía del frasco/producto en Bing Image Search,
 * priorizando CDNs confiables de e-commerce y usando `turl` como respaldo si el origen bloquea hotlinking.
 */
async function buscarImagenProductoEnBing(
  marca: string,
  nombre: string,
): Promise<string | null> {
  const resultado = await consultarBingImagenesHtml(
    `${marca} ${nombre} perfume bottle`.trim(),
  )
  if (!resultado || resultado.tarjetas.length === 0) return null

  const evaluadas = resultado.tarjetas
    .map((tarjeta) => {
      const puntajeBase = calcularPuntajeTokens(
        marca,
        nombre,
        `${tarjeta.t ?? ''} ${tarjeta.purl ?? ''}`,
      )
      const bonusCdn = tarjeta.murl && esCdnPrioritario(tarjeta.murl) ? 0.15 : 0
      return {
        tarjeta,
        puntajeBase,
        puntajeTotal: puntajeBase + bonusCdn,
      }
    })
    .filter((item) => item.puntajeBase >= 0.4)
    .sort((a, b) => b.puntajeTotal - a.puntajeTotal)

  for (const { tarjeta } of evaluadas.slice(0, 6)) {
    if (tarjeta.murl && (await verificarImagenDisponible(tarjeta.murl, true))) {
      return tarjeta.murl
    }
  }

  for (const { tarjeta } of evaluadas.slice(0, 3)) {
    if (tarjeta.turl && (await verificarImagenDisponible(tarjeta.turl, true))) {
      return tarjeta.turl
    }
  }

  return null
}

/**
 * Busca automáticamente la fotografía de la botella de un perfume.
 * Normaliza la consulta y aplica en cascada: Algolia (si está configurado),
 * Fragrantica vía Bing Image Search, catálogos Shopify de perfumería y búsqueda general de producto.
 */
export async function buscarImagenPerfume(
  marca: string,
  nombre: string,
): Promise<string | null> {
  if (!marca.trim() && !nombre.trim()) {
    return null
  }

  const { marcaLimpia, nombreLimpio } = limpiarConsultaPerfume(marca, nombre)

  try {
    const desdeAlgolia = await consultarAlgoliaFragrantica(
      marcaLimpia,
      nombreLimpio,
    )
    if (desdeAlgolia) {
      return desdeAlgolia
    }
  } catch {
    // Continuamos con la cascada pública si Algolia falla o no está configurado
  }

  if (marcaLimpia !== 'Love Collection') {
    const desdeFragranticaBing = await buscarEnFragranticaViaBing(
      marcaLimpia,
      nombreLimpio,
    )
    if (desdeFragranticaBing) {
      return desdeFragranticaBing
    }
  }

  const desdeShopify = await buscarEnTiendasShopify(marcaLimpia, nombreLimpio)
  if (desdeShopify) {
    return desdeShopify
  }

  return buscarImagenProductoEnBing(marcaLimpia, nombreLimpio)
}
