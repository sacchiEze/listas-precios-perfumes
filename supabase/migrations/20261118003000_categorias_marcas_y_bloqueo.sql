-- Categorías extendidas por marca (Arabe, Nicho, Disenador, Catalogo, Asiatico)
-- y configuración persistente de marcas (categoría predeterminada y eliminación permanente).

ALTER TABLE public.catalogo_productos
  DROP CONSTRAINT IF EXISTS catalogo_productos_categoria_check;

UPDATE public.catalogo_productos
SET categoria = 'Disenador'
WHERE categoria = 'Premium';

ALTER TABLE public.catalogo_productos
  ADD CONSTRAINT catalogo_productos_categoria_check
  CHECK (
    categoria IS NULL
    OR categoria IN ('Arabe', 'Nicho', 'Disenador', 'Catalogo', 'Asiatico')
  );

CREATE TABLE IF NOT EXISTS public.configuracion_marcas (
  marca_norm text PRIMARY KEY,
  marca text NOT NULL,
  categoria text NULL CHECK (
    categoria IS NULL
    OR categoria IN ('Arabe', 'Nicho', 'Disenador', 'Catalogo', 'Asiatico')
  ),
  eliminada boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.configuracion_marcas ENABLE ROW LEVEL SECURITY;
