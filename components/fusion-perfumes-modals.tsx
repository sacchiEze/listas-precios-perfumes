'use client'

import { useMemo, useState } from 'react'
import { GitMerge, Loader2, Search, X } from 'lucide-react'
import {
  ordenarOrigenDestino,
  type ParFusion,
} from '@/lib/detectorDuplicados'
import { normalizarTextoImportacion } from '@/lib/importadorListas'
import type { ProductoComparado } from '@/types/perfumeria'

function descripcion(nombre: string, ml: number | null, proveedores: string[]) {
  return `${nombre}${ml ? ` · ${ml} ml` : ''} · ${proveedores.join(', ') || 'sin proveedores'}`
}

function Cascaron({
  titulo,
  onCerrar,
  ocupado,
  children,
}: {
  titulo: string
  onCerrar: () => void
  ocupado: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-xs sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget && !ocupado) onCerrar()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="dashboard-card dashboard-modal max-h-[90vh] w-full max-w-[640px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <h3 className="inline-flex items-center gap-2 text-[15px] font-semibold text-slate-900">
            <GitMerge size={16} className="text-violet-600" />
            {titulo}
          </h3>
          <button
            type="button"
            onClick={onCerrar}
            disabled={ocupado}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Elegir con qué otro perfume se fusiona el seleccionado. */
export function ModalFusionManual({
  producto,
  productos,
  onFusionar,
  onCerrar,
}: {
  producto: ProductoComparado
  productos: ProductoComparado[]
  onFusionar: (origenId: number, destinoId: number, nombre: string) => Promise<void>
  onCerrar: () => void
}) {
  const [busqueda, setBusqueda] = useState(producto.marca)
  const [elegido, setElegido] = useState<ProductoComparado | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const candidatos = useMemo(() => {
    const tokens = normalizarTextoImportacion(busqueda).split(' ').filter(Boolean)
    return productos
      .filter((p) => p.producto_id !== producto.producto_id)
      .filter((p) => {
        const texto = normalizarTextoImportacion(`${p.marca} ${p.nombre}`)
        return tokens.every((t) => texto.includes(t))
      })
      .sort((a, b) => {
        const mismaA = a.marca === producto.marca ? 0 : 1
        const mismaB = b.marca === producto.marca ? 0 : 1
        if (mismaA !== mismaB) return mismaA - mismaB
        return a.nombre.localeCompare(b.nombre, 'es-AR')
      })
      .slice(0, 30)
  }, [busqueda, productos, producto])

  const conflicto = elegido
    ? Object.keys(elegido.ofertas).filter((p) => p in producto.ofertas)
    : []

  const resultado = elegido
    ? ordenarOrigenDestino(
        {
          id: producto.producto_id,
          nombre: producto.nombre,
          proveedores: new Set(Object.keys(producto.ofertas)),
        },
        {
          id: elegido.producto_id,
          nombre: elegido.nombre,
          proveedores: new Set(Object.keys(elegido.ofertas)),
        },
      )
    : null

  const confirmar = async () => {
    if (!resultado) return
    setGuardando(true)
    setError(null)
    try {
      await onFusionar(resultado.origen.id, resultado.destino.id, resultado.destino.nombre)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo fusionar.')
      setGuardando(false)
    }
  }

  return (
    <Cascaron titulo="Fusionar con otro perfume" onCerrar={onCerrar} ocupado={guardando}>
      <p className="mt-3 text-[12px] text-slate-600">
        <strong>
          {producto.marca} · {producto.nombre}
        </strong>
        {producto.ml ? ` (${producto.ml} ml)` : ''} se unirá con el perfume que elijas.
        Quedará el nombre más limpio y se conservarán los precios de todos los proveedores.
      </p>

      <label className="relative mt-3 block">
        <Search size={14} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
        <input
          type="text"
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value)
            setElegido(null)
          }}
          placeholder="Buscar perfume..."
          className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-[12px] text-slate-800 outline-none focus:border-violet-400"
        />
      </label>

      <ul className="mt-2 max-h-[240px] divide-y divide-slate-100 overflow-auto rounded-lg border border-slate-200">
        {candidatos.length === 0 && (
          <li className="px-3 py-3 text-[12px] text-slate-500">Sin resultados.</li>
        )}
        {candidatos.map((p) => (
          <li key={p.producto_id}>
            <button
              type="button"
              onClick={() => setElegido(p)}
              className={`block w-full px-3 py-2 text-left text-[12px] transition hover:bg-slate-50 ${
                elegido?.producto_id === p.producto_id ? 'bg-violet-50' : ''
              }`}
            >
              <span className="font-semibold text-slate-800">
                {p.marca} · {p.nombre}
              </span>
              <span className="block text-[11px] text-slate-500">
                {descripcion('', p.ml, Object.keys(p.ofertas)).replace(/^ · /, '')}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {elegido && resultado && (
        <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/60 p-3 text-[12px] text-slate-700">
          Quedará como <strong>{resultado.destino.nombre}</strong>; se absorbe «
          {resultado.origen.nombre}».
          {conflicto.length > 0 && (
            <p className="mt-1.5 font-medium text-rose-700">
              Ambos tienen precio de {conflicto.join(', ')}: no se pueden fusionar
              (probablemente son productos distintos).
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[11px] text-rose-700">
          {error}
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={onCerrar}
          disabled={guardando}
          className="rounded-lg border border-slate-200 px-3.5 py-2 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void confirmar()}
          disabled={!elegido || conflicto.length > 0 || guardando}
          className="primary-action inline-flex items-center gap-1.5 rounded-lg bg-[#34294d] px-4 py-2 text-[11px] font-semibold text-white transition hover:bg-[#45365f] disabled:opacity-50"
        >
          {guardando && <Loader2 size={13} className="animate-spin" />}
          Fusionar perfumes
        </button>
      </div>
    </Cascaron>
  )
}

/** Lista de posibles duplicados que el usuario acepta o descarta. */
export function ModalSugerenciasFusion({
  sugerencias,
  onAceptar,
  onDescartar,
  onCerrar,
}: {
  sugerencias: ParFusion[]
  onAceptar: (par: ParFusion) => Promise<void>
  onDescartar: (par: ParFusion) => void
  onCerrar: () => void
}) {
  const [procesando, setProcesando] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const aceptar = async (par: ParFusion) => {
    setProcesando(par.origenId)
    setError(null)
    try {
      await onAceptar(par)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo fusionar.')
    } finally {
      setProcesando(null)
    }
  }

  return (
    <Cascaron
      titulo={`Posibles duplicados (${sugerencias.length})`}
      onCerrar={onCerrar}
      ocupado={procesando !== null}
    >
      <p className="mt-3 text-[12px] text-slate-600">
        Los casos seguros ya se fusionan solos. Estos son parecidos pero no es seguro que
        sean el mismo perfume: revisalos y aceptá o descartá cada uno.
      </p>

      {error && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[11px] text-rose-700">
          {error}
        </div>
      )}

      <ul className="mt-3 space-y-2">
        {sugerencias.length === 0 && (
          <li className="rounded-lg border border-slate-200 px-3 py-4 text-center text-[12px] text-slate-500">
            No hay sugerencias pendientes.
          </li>
        )}
        {sugerencias.map((par) => (
          <li
            key={`${par.origenId}-${par.destinoId}`}
            className="rounded-xl border border-slate-200 p-3 text-[12px]"
          >
            <div className="font-semibold text-slate-800">{par.marca}</div>
            <div className="mt-1 text-slate-700">
              {descripcion(par.nombreDestino, par.mlDestino, par.proveedoresDestino)}
            </div>
            <div className="text-slate-700">
              {descripcion(par.nombreOrigen, par.mlOrigen, par.proveedoresOrigen)}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Quedaría como «{par.nombreFinal}» · {par.motivo}
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => onDescartar(par)}
                disabled={procesando !== null}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
              >
                No son iguales
              </button>
              <button
                type="button"
                onClick={() => void aceptar(par)}
                disabled={procesando !== null}
                className="primary-action inline-flex items-center gap-1.5 rounded-lg bg-[#34294d] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#45365f] disabled:opacity-50"
              >
                {procesando === par.origenId && (
                  <Loader2 size={12} className="animate-spin" />
                )}
                Fusionar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Cascaron>
  )
}

/** Fusionar escribiendo los ID de los perfumes que son el mismo y el nombre final. */
export function ModalFusionPorId({
  productos,
  onFusionar,
  onCerrar,
}: {
  productos: ProductoComparado[]
  onFusionar: (ids: number[], nombre: string) => Promise<void>
  onCerrar: () => void
}) {
  const [textoIds, setTextoIds] = useState('')
  const [nombre, setNombre] = useState('')
  const [nombreEditado, setNombreEditado] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mapa = useMemo(
    () => new Map(productos.map((p) => [p.producto_id, p])),
    [productos],
  )

  const ids = useMemo(
    () =>
      Array.from(
        new Set(
          textoIds
            .split(/[^0-9]+/)
            .filter(Boolean)
            .map(Number),
        ),
      ),
    [textoIds],
  )
  const encontrados = ids.map((id) => mapa.get(id)).filter(Boolean) as ProductoComparado[]
  const faltantes = ids.filter((id) => !mapa.has(id))

  const proveedoresRepetidos = useMemo(() => {
    const vistos = new Map<string, number>()
    for (const p of encontrados) {
      for (const prov of Object.keys(p.ofertas)) {
        vistos.set(prov, (vistos.get(prov) ?? 0) + 1)
      }
    }
    return Array.from(vistos.entries())
      .filter(([, n]) => n > 1)
      .map(([prov]) => prov)
  }, [encontrados])

  const nombreSugerido = useMemo(() => {
    if (encontrados.length === 0) return ''
    return [...encontrados].sort(
      (a, b) =>
        Number(/\(/.test(a.nombre)) - Number(/\(/.test(b.nombre)) ||
        a.nombre.length - b.nombre.length,
    )[0].nombre
  }, [encontrados])

  const nombreFinal = nombreEditado ? nombre : nombreSugerido
  const puedeFusionar =
    encontrados.length >= 2 &&
    faltantes.length === 0 &&
    proveedoresRepetidos.length === 0 &&
    nombreFinal.trim().length > 0

  const confirmar = async () => {
    setGuardando(true)
    setError(null)
    try {
      await onFusionar(ids, nombreFinal.trim())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo fusionar.')
      setGuardando(false)
    }
  }

  return (
    <Cascaron titulo="Fusionar perfumes por ID" onCerrar={onCerrar} ocupado={guardando}>
      <p className="mt-3 text-[12px] text-slate-600">
        Escribí los ID (se ven en la tabla) de los perfumes que son el mismo, separados
        por coma o espacio, y el nombre con el que querés que quede.
      </p>

      <label className="mt-3 block">
        <span className="text-[11px] font-medium text-slate-600">ID a fusionar</span>
        <input
          type="text"
          value={textoIds}
          onChange={(e) => setTextoIds(e.target.value)}
          placeholder="Ej: 12, 458, 1059"
          className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-800 outline-none focus:border-violet-400"
        />
      </label>

      {ids.length > 0 && (
        <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 text-[12px]">
          {ids.map((id) => {
            const p = mapa.get(id)
            return (
              <li key={id} className="px-3 py-2">
                <span className="font-mono text-[11px] text-slate-500">#{id}</span>{' '}
                {p ? (
                  <>
                    <span className="font-semibold text-slate-800">
                      {p.marca} · {p.nombre}
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      {p.ml ? `${p.ml} ml · ` : ''}
                      {Object.keys(p.ofertas).join(', ') || 'sin proveedores'}
                    </span>
                  </>
                ) : (
                  <span className="font-medium text-rose-600">No existe</span>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <label className="mt-3 block">
        <span className="text-[11px] font-medium text-slate-600">Nombre final</span>
        <input
          type="text"
          value={nombreFinal}
          onChange={(e) => {
            setNombre(e.target.value)
            setNombreEditado(true)
          }}
          placeholder="Nombre con el que queda el perfume"
          className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-800 outline-none focus:border-violet-400"
        />
      </label>

      {proveedoresRepetidos.length > 0 && (
        <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[11px] text-rose-700">
          Más de uno de esos perfumes tiene precio de {proveedoresRepetidos.join(', ')}:
          un mismo proveedor no puede tener dos precios para un perfume, revisá los ID.
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[11px] text-rose-700">
          {error}
        </p>
      )}

      <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={onCerrar}
          disabled={guardando}
          className="rounded-lg border border-slate-200 px-3.5 py-2 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void confirmar()}
          disabled={!puedeFusionar || guardando}
          className="primary-action inline-flex items-center gap-1.5 rounded-lg bg-[#34294d] px-4 py-2 text-[11px] font-semibold text-white transition hover:bg-[#45365f] disabled:opacity-50"
        >
          {guardando && <Loader2 size={13} className="animate-spin" />}
          Fusionar {encontrados.length >= 2 ? `${encontrados.length} perfumes` : ''}
        </button>
      </div>
    </Cascaron>
  )
}
