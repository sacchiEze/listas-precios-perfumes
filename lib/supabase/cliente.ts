import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ''
const PUBLIC_KEY_SUPABASE =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  ''

/**
 * Verifica si las variables públicas de conexión a Supabase están configuradas
 * y no corresponden a valores de ejemplo sin completar.
 */
export function estaSupabaseConfigurado(): boolean {
  if (!URL_SUPABASE || !PUBLIC_KEY_SUPABASE) {
    return false
  }

  const esPlaceholderUrl =
    URL_SUPABASE.includes('tu-proyecto.supabase.co') ||
    URL_SUPABASE.includes('placeholder.supabase.co')
  const esPlaceholderKey =
    PUBLIC_KEY_SUPABASE.includes('tu-anon-key') ||
    PUBLIC_KEY_SUPABASE.includes('tu-publishable-key') ||
    PUBLIC_KEY_SUPABASE === 'placeholder-anon-key'

  return !esPlaceholderUrl && !esPlaceholderKey
}

// Se proveen valores de respaldo inofensivos para evitar que createClient() arroje
// una excepción en tiempo de build/renderizado cuando .env.local aún no fue creado.
const urlCliente = URL_SUPABASE || 'https://placeholder.supabase.co'
const publicKeyCliente = PUBLIC_KEY_SUPABASE || 'placeholder-anon-key'

/**
 * Cliente estándar de Supabase para uso en componentes del navegador y consultas públicas.
 * Compatible tanto con Publishable keys (`sb_publishable_...`) como con Anon keys legacy.
 */
export const supabase: SupabaseClient = createClient(urlCliente, publicKeyCliente, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

/**
 * Crea un cliente de Supabase para Route Handlers del servidor utilizando la
 * Secret key (`sb_secret_...`) o Service Role Key legacy.
 */
export function crearClienteSupabaseAdmin(): SupabaseClient {
  const secretKey =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    publicKeyCliente

  return createClient(urlCliente, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
