# IPlataforma: lo que cada sistema debe implementar

`comun\IPlataforma.cs`. La lógica (`Puente.cs`) atiende los mensajes del contrato (`CONTRATO.md`) y solo toca el sistema por esta interfaz.
Cada programa (Windows en `src\`, Mac más adelante) hace: ventana con web view que carga la interfaz de `Recursos` (index.html, `?idioma=` + `Textos.Idioma`), `Textos.Iniciar(CarpetaDatos)`, `var p = new Puente(plataforma, pdfInicial)`, cada mensaje JS → `p.Recibir(json)`, al cerrar `p.Cerrar()` (y si `p.HayCambios`, preguntar antes de cerrar).
Recursos servidos con `Recursos.Leer(ruta)` / `Recursos.Mime(ruta)`; la interfaz nunca debe navegar fuera de su origen.

Hilos: `Recibir` y los diálogos corren en el hilo de la UI. El trabajo pesado va en hilos de fondo y vuelve por `EnHiloUI`.
Los métodos marcados (BG) pueden llamarse desde un hilo de fondo.

| Miembro | Recibe -> devuelve | Mensajes que lo usan |
|---|---|---|
| `CarpetaDatos` | -> ruta. Windows: `%LOCALAPPDATA%\FirmarPDF` (idioma.txt, ultima-carpeta.txt, firmas del WebView). Debe ser fija y existir o poder crearse | `idioma`, y recordar la última carpeta en todos los diálogos |
| `CarpetaPredeterminada` | -> ruta (Documentos) cuando no hay última carpeta | todos los diálogos |
| `EnviarJson(json)` | JSON de un mensaje programa -> interfaz; se entrega a `window` como mensaje web (equivale a `PostWebMessageAsJson`). Hilo UI | todas las respuestas |
| `EnHiloUI(accion)` (BG) | ejecuta la acción en el hilo UI; puede lanzar si la ventana se cerró (el puente lo ignora) | respuestas asíncronas, `movil*` |
| `AbrirArchivos(titulo, filtro, multiple, carpetaInicial)` | -> rutas o `null` si cancela | `abrir`, `abrirArchivos`, `officeAPdf` |
| `GuardarArchivo(titulo, nombreSugerido, filtro, extension, carpetaInicial)` | -> ruta o `null`. Pregunta si sobrescribir y agrega `extension` si falta | `guardar`, `guardarArchivo`, `crearDocx` |
| `ElegirCarpeta(titulo, carpetaInicial)` | -> ruta o `null` | `elegirCarpeta`, `guardarVarios` |
| `AbrirCarpetaEnSistema(ruta)` (BG) | abre en Explorer/Finder; nunca lanza | `abrirCarpeta`, `guardarVarios` |
| `ImprimirPdfAsync(rutaPdf)` | PDF temporal -> `Abierto` (diálogo de impresión mostrado), `Aviso` (no se pudo; la interfaz muestra "usar Ctrl+P"), `Cerrado` (el usuario cerró; sin aviso). El archivo temporal lo crea el puente | `imprimir` -> `impreso`/`error` |
| `IdiomasOcr()` (BG) | -> etiquetas ("es-ES"); vacío = sin OCR | `ocrIdiomas` |
| `ReconocerAsync(png, idioma)` | PNG, etiqueta o null -> `ResultadoOcr` (líneas/palabras con X,Y,Ancho,Alto en píxeles del PNG, ver `Motor\ModelosOcr.cs`). Sin motor: lanzar `OcrNoDisponibleException` | `ocr` |
| `OfficeDisponible()` (BG) | -> `OfficeDisp(Word, Excel, PowerPoint)`; todo `false` si no hay/no se soporta | `officeDisponible`, `officeAPdf` |
| `OfficeAPdf(archivo, extension)` (BG) | bytes y ".docx" -> bytes del PDF; lanza con mensaje legible si falla | `officeAPdf` |
| `RecomprimirJpeg(datos, esJpeg, ancho, alto, componentes, nuevoAncho, nuevoAlto, calidad)` (BG) | ver abajo | `comprimirPdf` |

## Tipos
- `FiltroArchivo(Etiqueta, Extensiones[], MostrarExtensiones=true)`: extensiones sin punto ("pdf"). Windows arma `Etiqueta (*.pdf;*.jpg)|*.pdf;*.jpg` (sin el paréntesis si `MostrarExtensiones` es false). En Mac: lista de tipos permitidos.
- `ResultadoImpresion`: `Abierto | Aviso | Cerrado`.

## RecomprimirJpeg
Si `esJpeg`, `datos` es un JPEG completo y debe medir `ancho` x `alto` (si no, devolver `null`). Si no, son píxeles crudos de 8 bits, `componentes` = 1 (gris) o 3 (RGB, orden R,G,B), filas seguidas sin relleno, `ancho*alto*componentes` bytes.
Devuelve un JPEG RGB de `nuevoAncho` x `nuevoAlto` (reducción de buena calidad, fondo blanco, `calidad` 1-100), o `null` si no se puede. El motor ya decidió tamaño y descarta el resultado si no pesa menos.

## Notas
- Los textos de diálogos y mensajes vienen de `Textos.T(clave)`; el puente ya los pasa traducidos.
- Seguridad (token del servidor del celular, límites, carpetas permitidas) está en comun; no repetirla ni relajarla.
- Variables de depuración `FIRMARPDF_*` solo en Debug: `FIRMARPDF_DATOS` (carpeta de datos) la lee la plataforma en `CarpetaDatos`; las demás ya las lee comun.
