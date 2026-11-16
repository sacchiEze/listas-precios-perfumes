'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, KeyRound, Lock, ShieldCheck } from 'lucide-react'

interface RespuestaLogin {
  autenticado?: boolean
  error?: string
}

export default function PaginaLogin() {
  const router = useRouter()
  const [clave, setClave] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function manejarEnvio(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!clave.trim()) {
      setError('Ingresá tu clave personal de acceso.')
      return
    }

    setCargando(true)
    setError(null)

    try {
      const respuesta = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave }),
      })

      const datos = (await respuesta.json()) as RespuestaLogin

      if (!respuesta.ok || !datos.autenticado) {
        setError(datos.error ?? 'No se pudo validar la clave.')
        setCargando(false)
        return
      }

      const parametros = new URLSearchParams(window.location.search)
      const rutaDestino = parametros.get('siguiente')
      const destinoSeguro =
        rutaDestino && rutaDestino.startsWith('/') ? rutaDestino : '/'

      router.replace(destinoSeguro)
      router.refresh()
    } catch {
      setError('Error de conexión con el servidor. Intentá nuevamente.')
      setCargando(false)
    }
  }

  return (
    <main className="dashboard-shell flex min-h-screen items-center justify-center bg-[#f7f8fa] px-4 py-10 text-slate-900">
      <section className="dashboard-card w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#29233e] text-white">
            <Lock size={19} />
          </div>
          <div>
            <h1 className="text-[16px] font-semibold tracking-tight text-slate-900">
              PerfumeHub Mayorista
            </h1>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
              Acceso privado
            </p>
          </div>
        </div>

        <p className="mb-6 text-[13px] leading-relaxed text-slate-500">
          Ingresá tu clave personal para consultar las listas de costos mayoristas,
          el comparador multi-proveedor y el historial de precios. La sesión queda
          guardada por 90 días en este dispositivo.
        </p>

        <form onSubmit={manejarEnvio} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Clave de acceso
            </span>
            <div className="relative">
              <KeyRound
                size={15}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="password"
                autoFocus
                autoComplete="current-password"
                value={clave}
                onChange={(evento) => setClave(evento.target.value)}
                placeholder="Ingresá tu clave secreta"
                className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              />
            </div>
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={cargando}
            className="primary-action mt-1 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#34294d] py-3 text-xs font-semibold text-white shadow-sm transition hover:bg-[#45365f] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cargando ? (
              'Verificando acceso...'
            ) : (
              <>
                <ShieldCheck size={15} />
                Ingresar al workspace
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>
      </section>
    </main>
  )
}
