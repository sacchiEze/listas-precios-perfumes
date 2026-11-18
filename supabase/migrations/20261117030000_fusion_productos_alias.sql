-- Fusión de perfumes duplicados entre proveedores.
-- Una sola tabla nueva (alias de nombres) y una función de fusión.

create table if not exists public.alias_productos (
  marca_norm text not null,
  nombre_norm text not null,
  ml integer not null default 0,
  producto_id integer not null references public.catalogo_productos(id) on delete cascade,
  primary key (marca_norm, nombre_norm, ml)
);
create index if not exists alias_productos_producto_idx on public.alias_productos(producto_id);
alter table public.alias_productos enable row level security;

create or replace function public.fusionar_productos(p_origen integer, p_destino integer, p_nombre text default null)
returns void
language plpgsql
set search_path = public
as $$
begin
  if p_origen = p_destino then
    raise exception 'El origen y el destino son el mismo producto';
  end if;
  if not exists (select 1 from catalogo_productos where id = p_origen)
     or not exists (select 1 from catalogo_productos where id = p_destino) then
    raise exception 'Producto inexistente';
  end if;
  if exists (
    select 1 from precios_proveedores a
    join precios_proveedores b on b.proveedor = a.proveedor
    where a.producto_id = p_origen and b.producto_id = p_destino
  ) then
    raise exception 'Ambos perfumes tienen precio del mismo proveedor; probablemente son productos distintos';
  end if;

  update precios_proveedores set producto_id = p_destino where producto_id = p_origen;
  update historial_precios set producto_id = p_destino where producto_id = p_origen;
  update alias_productos set producto_id = p_destino where producto_id = p_origen;

  update catalogo_productos d set
    nombre = coalesce(nullif(trim(p_nombre), ''), d.nombre),
    ean6 = coalesce(d.ean6, o.ean6),
    ml = coalesce(d.ml, o.ml),
    concentracion = case when d.concentracion is null or d.concentracion = 'N/A'
                         then coalesce(o.concentracion, d.concentracion)
                         else d.concentracion end,
    genero = coalesce(d.genero, o.genero),
    categoria = coalesce(d.categoria, o.categoria),
    imagen_url = coalesce(d.imagen_url, o.imagen_url),
    precio_venta_manual_ars = coalesce(d.precio_venta_manual_ars, o.precio_venta_manual_ars)
  from catalogo_productos o
  where d.id = p_destino and o.id = p_origen;

  delete from catalogo_productos where id = p_origen;
end;
$$;

revoke execute on function public.fusionar_productos(integer, integer, text) from public, anon, authenticated;
