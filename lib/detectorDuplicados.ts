import { normalizarTextoImportacion } from '@/lib/importadorListas'
import type { FilaVistaComparador } from '@/types/perfumeria'

/** Par de perfumes que parecen el mismo: `origen` se fusiona dentro de `destino`. */
export interface ParFusion {
  origenId: number
  destinoId: number
  /** Nombre que debería quedar (el más limpio de los dos). */
  nombreFinal: string
  marca: string
  nombreOrigen: string
  nombreDestino: string
  mlOrigen: number | null
  mlDestino: number | null
  proveedoresOrigen: string[]
  proveedoresDestino: string[]
  motivo: string
}

export interface ResultadoDeteccionDuplicados {
  /** Se pueden fusionar solos. */
  altaConfianza: ParFusion[]
  /** Requieren que el usuario los acepte o descarte. */
  sugerencias: ParFusion[]
}

interface ProductoResumen {
  id: number
  marca: string
  nombre: string
  ml: number | null
  concentracion: string | null
  tipo: string
  proveedores: Set<string>
  base: string
  parentesis: string
  esKit: boolean
}

/** Palabras que suelen variar entre proveedores sin cambiar el perfume. */
const PALABRAS_RUIDO = new Set([
  'men',
  'man',
  'homme',
  'pour',
  'femme',
  'feme',
  'woman',
  'women',
  'her',
  'him',
  'f',
  'm',
  'edition',
  'dubai',
  'edp',
  'edt',
  'extrait',
  'parfum',
])

function analizarNombre(nombre: string): {
  base: string
  parentesis: string
  esKit: boolean
} {
  const parentesisEncontrados = nombre.match(/\([^)]*\)/g) ?? []
  const parentesis = normalizarTextoImportacion(parentesisEncontrados.join(' '))
  const esKit =
    /\d/.test(parentesis) ||
    /\b(\d+\s*x\s*\d+|\d+\s*pz|set|kit|collection|coleccion)\b/i.test(nombre)
  const sinParentesis = nombre.replace(/\([^)]*\)/g, ' ')
  return {
    base: normalizarTextoImportacion(sinParentesis),
    parentesis,
    esKit,
  }
}

function mlCompatibles(a: number | null, b: number | null): boolean {
  return a === null || b === null || a === b
}

function concentracionCompatible(a: string | null, b: string | null): boolean {
  const limpiar = (v: string | null) => (v && v !== 'N/A' ? v : null)
  const ca = limpiar(a)
  const cb = limpiar(b)
  return ca === null || cb === null || ca === cb
}

function proveedoresDisjuntos(a: Set<string>, b: Set<string>): boolean {
  for (const p of a) if (b.has(p)) return false
  return true
}

function tokensSinRuido(base: string): string[] {
  return base.split(' ').filter((t) => t && !PALABRAS_RUIDO.has(t))
}

/** El nombre "más limpio": sin paréntesis y, en empate, el más corto. */
function esMasLimpio(a: ProductoResumen, b: ProductoResumen): boolean {
  const aTieneParentesis = a.parentesis !== ''
  const bTieneParentesis = b.parentesis !== ''
  if (aTieneParentesis !== bTieneParentesis) return !aTieneParentesis
  if (a.nombre.length !== b.nombre.length) return a.nombre.length < b.nombre.length
  return a.proveedores.size >= b.proveedores.size
}

/** Decide cuál es destino (nombre más limpio) y cuál origen. */
export function ordenarOrigenDestino<
  T extends { id: number; nombre: string; proveedores: Set<string> },
>(a: T, b: T): { origen: T; destino: T } {
  const infoA = analizarNombre(a.nombre)
  const infoB = analizarNombre(b.nombre)
  const aTiene = infoA.parentesis !== ''
  const bTiene = infoB.parentesis !== ''
  let aEsDestino: boolean
  if (aTiene !== bTiene) aEsDestino = !aTiene
  else if (a.nombre.length !== b.nombre.length)
    aEsDestino = a.nombre.length < b.nombre.length
  else aEsDestino = a.proveedores.size >= b.proveedores.size
  return aEsDestino ? { origen: b, destino: a } : { origen: a, destino: b }
}

function construirProductos(filas: FilaVistaComparador[]): ProductoResumen[] {
  const mapa = new Map<number, ProductoResumen>()
  for (const fila of filas) {
    let p = mapa.get(fila.producto_id)
    if (!p) {
      const analisis = analizarNombre(fila.nombre)
      p = {
        id: fila.producto_id,
        marca: fila.marca,
        nombre: fila.nombre,
        ml: fila.ml,
        concentracion: fila.concentracion,
        tipo: fila.tipo,
        proveedores: new Set(),
        ...analisis,
      }
      mapa.set(fila.producto_id, p)
    }
    if (fila.proveedor) p.proveedores.add(fila.proveedor)
  }
  return Array.from(mapa.values())
}

function crearPar(
  a: ProductoResumen,
  b: ProductoResumen,
  motivo: string,
): ParFusion {
  const { origen, destino } = esMasLimpio(a, b)
    ? { origen: b, destino: a }
    : { origen: a, destino: b }
  return {
    origenId: origen.id,
    destinoId: destino.id,
    nombreFinal: destino.nombre,
    marca: destino.marca,
    nombreOrigen: origen.nombre,
    nombreDestino: destino.nombre,
    mlOrigen: origen.ml,
    mlDestino: destino.ml,
    proveedoresOrigen: Array.from(origen.proveedores).sort(),
    proveedoresDestino: Array.from(destino.proveedores).sort(),
    motivo,
  }
}

/**
 * Detecta perfumes repetidos entre proveedores.
 *
 * - Alta confianza: misma marca, mismo nombre una vez quitados los paréntesis
 *   (colores como "(Rosado)"), ml iguales o uno vacío, misma concentración (si
 *   están informadas), sin proveedores en común y sin ser kits.
 * - Sugerencia: igual pero difiere en una palabra "de ruido" (Men, F, Edition…).
 */
export function detectarDuplicados(
  filas: FilaVistaComparador[],
  descartados: Set<string> = new Set(),
): ResultadoDeteccionDuplicados {
  const productos = construirProductos(filas).filter(
    (p) => !p.esKit && p.base && p.proveedores.size > 0,
  )

  const porMarca = new Map<string, ProductoResumen[]>()
  for (const p of productos) {
    const clave = normalizarTextoImportacion(p.marca)
    const lista = porMarca.get(clave) ?? []
    lista.push(p)
    porMarca.set(clave, lista)
  }

  const altaConfianza: ParFusion[] = []
  const sugerencias: ParFusion[] = []
  const fusionados = new Set<number>()

  for (const lista of porMarca.values()) {
    // Alta confianza: agrupar por nombre base y fusionar en cadena
    const porBase = new Map<string, ProductoResumen[]>()
    for (const p of lista) {
      const g = porBase.get(p.base) ?? []
      g.push(p)
      porBase.set(p.base, g)
    }

    for (const grupo of porBase.values()) {
      if (grupo.length < 2) continue
      const ordenados = [...grupo].sort((a, b) => {
        if (esMasLimpio(a, b) !== esMasLimpio(b, a)) return esMasLimpio(a, b) ? -1 : 1
        return b.proveedores.size - a.proveedores.size
      })

      const acumulados: ProductoResumen[] = []
      for (const candidato of ordenados) {
        const destino = acumulados.find(
          (d) =>
            proveedoresDisjuntos(d.proveedores, candidato.proveedores) &&
            mlCompatibles(d.ml, candidato.ml) &&
            concentracionCompatible(d.concentracion, candidato.concentracion) &&
            d.tipo === candidato.tipo &&
            (d.parentesis === '' ||
              candidato.parentesis === '' ||
              d.parentesis === candidato.parentesis),
        )
        if (!destino) {
          acumulados.push(candidato)
          continue
        }
        const clavePar = `${Math.min(destino.id, candidato.id)}-${Math.max(destino.id, candidato.id)}`
        if (descartados.has(clavePar)) {
          acumulados.push(candidato)
          continue
        }
        altaConfianza.push({
          ...crearPar(destino, candidato, 'Mismo nombre en distintos proveedores'),
          // el destino acumulado siempre se mantiene como destino
          destinoId: destino.id,
          origenId: candidato.id,
          nombreFinal: destino.nombre,
          nombreDestino: destino.nombre,
          nombreOrigen: candidato.nombre,
          mlDestino: destino.ml,
          mlOrigen: candidato.ml,
          proveedoresDestino: Array.from(destino.proveedores).sort(),
          proveedoresOrigen: Array.from(candidato.proveedores).sort(),
        })
        // el destino absorbe al candidato para los siguientes chequeos
        for (const prov of candidato.proveedores) destino.proveedores.add(prov)
        if (destino.ml === null) destino.ml = candidato.ml
        fusionados.add(candidato.id)
      }
    }

    // Sugerencias: difieren únicamente en palabras de ruido
    const restantes = lista.filter((p) => !fusionados.has(p.id))
    for (let i = 0; i < restantes.length; i += 1) {
      for (let j = i + 1; j < restantes.length; j += 1) {
        const a = restantes[i]
        const b = restantes[j]
        if (a.base === b.base) continue
        if (!proveedoresDisjuntos(a.proveedores, b.proveedores)) continue
        if (!mlCompatibles(a.ml, b.ml)) continue
        if (!concentracionCompatible(a.concentracion, b.concentracion)) continue
        if (a.tipo !== b.tipo) continue

        const ta = tokensSinRuido(a.base)
        const tb = tokensSinRuido(b.base)
        if (ta.length === 0 || ta.join(' ') !== tb.join(' ')) continue

        const clavePar = `${Math.min(a.id, b.id)}-${Math.max(a.id, b.id)}`
        if (descartados.has(clavePar)) continue
        sugerencias.push(
          crearPar(a, b, 'Solo cambia una palabra secundaria (Men, F, Edition…)'),
        )
      }
    }
  }

  return { altaConfianza, sugerencias }
}

export function claveParDescartado(a: number, b: number): string {
  return `${Math.min(a, b)}-${Math.max(a, b)}`
}
