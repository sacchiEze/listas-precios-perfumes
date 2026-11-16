export const NOMBRE_COOKIE_SESION = 'perfumeria_acceso_token'
export const DURACION_SESION_SEGUNDOS = 60 * 60 * 24 * 90 // 90 días

const encoder = new TextEncoder()

function bytesAHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function compararTiempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diferencia = 0
  for (let i = 0; i < a.length; i += 1) {
    diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diferencia === 0
}

async function importarClaveHmac(claveSecreta: string): Promise<CryptoKey> {
  const bytesClave = new Uint8Array(encoder.encode(claveSecreta))
  return crypto.subtle.importKey(
    'raw',
    bytesClave,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

async function firmarPayload(payload: string, claveSecreta: string): Promise<string> {
  const clave = await importarClaveHmac(claveSecreta)
  const datos = new Uint8Array(encoder.encode(payload))
  const firma = await crypto.subtle.sign('HMAC', clave, datos)
  return bytesAHex(new Uint8Array(firma))
}

/**
 * Genera un token de sesión firmado con HMAC-SHA256 y expiración de 90 días.
 * Compatible con Edge Runtime (middleware) y Node.js Runtime (API Routes).
 */
export async function crearTokenSesion(claveAcceso: string): Promise<string> {
  const expiraEn = Date.now() + DURACION_SESION_SEGUNDOS * 1000
  const payload = `autorizado:${expiraEn}`
  const firma = await firmarPayload(payload, claveAcceso)
  return `${payload}.${firma}`
}

/**
 * Verifica que el token de la cookie sea auténtico y no haya expirado.
 */
export async function verificarTokenSesion(
  token: string | undefined,
  claveAcceso: string,
): Promise<boolean> {
  if (!token || !claveAcceso) return false

  const indiceSeparador = token.lastIndexOf('.')
  if (indiceSeparador <= 0) return false

  const payload = token.slice(0, indiceSeparador)
  const firmaRecibida = token.slice(indiceSeparador + 1)
  if (!payload.startsWith('autorizado:') || !firmaRecibida) return false

  const timestampTexto = payload.slice('autorizado:'.length)
  const expiraEn = Number(timestampTexto)
  if (!Number.isFinite(expiraEn) || Date.now() > expiraEn) {
    return false
  }

  const firmaEsperada = await firmarPayload(payload, claveAcceso)
  return compararTiempoConstante(firmaRecibida, firmaEsperada)
}

/**
 * Compara en tiempo constante la clave enviada por el usuario contra la configurada en el entorno.
 */
export function validarClaveAcceso(claveIngresada: string, claveEsperada: string): boolean {
  if (!claveIngresada || !claveEsperada) return false
  return compararTiempoConstante(claveIngresada, claveEsperada)
}
