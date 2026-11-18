import { NextResponse } from 'next/server'
import {
  crearClienteSupabaseAdmin,
  estaSupabaseConfigurado,
} from '@/lib/supabase/cliente'

/**
 * GET /api/productos/alias
 *
 * Devuelve los alias de nombres creados al fusionar perfumes, para que el
 * importador reconozca cada nombre alternativo como el perfume ya existente.
 */
export async function GET() {
  if (!estaSupabaseConfigurado()) {
    return NextResponse.json({ alias: [] })
  }

  const { data, error } = await crearClienteSupabaseAdmin()
    .from('alias_productos')
    .select('marca_norm, nombre_norm, ml, producto_id')

  if (error) {
    // Si la tabla aún no existe, el importador funciona igual sin alias.
    return NextResponse.json({ alias: [] })
  }

  return NextResponse.json({ alias: data ?? [] })
}
