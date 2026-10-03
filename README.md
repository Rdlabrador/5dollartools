# 5dollartools

Herramientas fáciles y baratas. Cada herramienta vive en su propia carpeta y se publica con GitHub Pages en
`https://rdlabrador.github.io/5dollartools/<carpeta>/`.

| Herramienta | Carpeta | Para qué sirve |
|---|---|---|
| MyBags (conceptualizador de bolsas) | [`conceptualizador-bolsas/`](conceptualizador-bolsas/) | Muestra al cliente su logo impreso en la bolsa (mockup) y exporta el archivo de impresión en SVG a tamaño real. |
| MyMugs (conceptualizador de tazas) — en desarrollo | [`conceptualizador-tazas/`](conceptualizador-tazas/) | Compone el diseño por capas (imágenes y texto), lo muestra sobre la taza en 3D y exporta la tira de sublimación a tamaño real, en espejo. |

`comun/` guarda lo que comparten las herramientas (estilos, clientes y versiones, limpieza de imágenes, exportación).

## Agregar una herramienta nueva

1. Crea una carpeta con nombre corto, en minúsculas y con guiones (ej. `conceptualizador-tazas/`).
2. Dentro, su `index.html` y lo que necesite. Las herramientas de la suite comparten estructura, flujo y diseño: usa `conceptualizador-bolsas/` (MyBags) como referencia.
3. Agrégala a la tabla de arriba y a la página de inicio (`index.html` de la raíz).
4. Sube los cambios (`git add`, `git commit`, `git push`). En 1–2 minutos queda publicada.

## Trabajar entre dos

- Cada uno trabaja en su copia (`git clone https://github.com/Rdlabrador/5dollartools`).
- Antes de empezar: `git pull` (traer lo último). Al terminar: `git add -A`, `git commit -m "qué cambió"`, `git push`.
- Mejor no editar el mismo archivo al mismo tiempo; si pasa, Git avisa y se resuelve el conflicto.

## Qué NO se sube

Las carpetas `referencias/` (fotos originales, ejemplos de clientes con datos de contacto, logos de prueba) quedan solo en el computador de cada uno; están excluidas en `.gitignore`.
