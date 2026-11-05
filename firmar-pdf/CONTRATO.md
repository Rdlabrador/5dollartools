# Firmar PDF — contrato entre el programa (C#) y la interfaz (HTML/JS)

Programa de Windows: C# .NET 8 WinForms + WebView2. Sin navegador, sin internet.
Usuarios: personas mayores → botones grandes (mín. 48 px de alto), letra base 18 px, texto + ícono, mensajes cortos en español.

## Carpetas
```
firmar-pdf\
  PepePDF.sln                    ← solución: comun\ (biblioteca multiplataforma) + src\ (programa de Windows)
  src\FirmarPdf.csproj  Program.cs  VentanaPrincipal.cs  PlataformaWindows.cs  Impresion.cs ...
  comun\PepePDF.Comun.csproj  Puente.cs  IPlataforma.cs (ver PLATAFORMA.md)  ServidorMovil.cs ...
  comun\wwwroot\               ← todo va INCRUSTADO en el exe (EmbeddedResource), nada suelto
    index.html  app.css             ← interfaz del PC
    js\                             ← módulos ES: main, estado, util, puente, visor, historial, documento, elementos, firmar, guardar, herramientas, teclado, pruebas
    movil.html                      ← página del celular (la sirve el servidor de red)
    lib\pdfjs\  (build\pdf.min.mjs, build\pdf.worker.min.mjs, web\pdf_viewer.mjs, web\pdf_viewer.css,
                 web\images\, cmaps\, standard_fonts\, wasm\, iccs\)   ← pdf.js 6.5.438 (YA DESCARGADO)
    lib\pdf-lib.min.js              ← pdf-lib 1.17.1 UMD, global PDFLib (YA DESCARGADO)
    lib\suite.css                   ← diseño de la suite (variables --bg, --panel, --accent #f5c400, .btn, .btn.primary, .toast, .hidden)
```

## Cómo se carga la interfaz
- WebView2 navega a `https://app.local/index.html?idioma=es` (o `en`): C# pasa el idioma actual por la URL. La web lo lee al arrancar y se traduce sola.
- Idioma: C# lo guarda en `%LOCALAPPDATA%\FirmarPDF\idioma.txt` (`es` o `en`). Si no existe, usa el idioma de Windows (empieza con "es" → `es`, si no `en`). Los textos de C# (diálogos, filtros, errores, nombres por defecto) salen en ese idioma (`src\Textos.cs`).
- WebView2 navega a `https://app.local/index.html`. C# atiende `https://app.local/*` con `WebResourceRequested`, leyendo los recursos incrustados (tipos MIME correctos: .mjs → text/javascript, .wasm → application/wasm, .bcmap/.pfb → application/octet-stream).
- Carpeta de datos de WebView2: `%LOCALAPPDATA%\FirmarPDF\WebView2` (así localStorage persiste: allí se guarda la última firma).
- Sin menú contextual de depuración en Release; F12 desactivado en Release.

## Mensajes (JSON) — `window.chrome.webview.postMessage(obj)` / `PostWebMessageAsJson`
Interfaz → programa:
| tipo | campos | respuesta |
|---|---|---|
| `listo` | — | si el exe se abrió con un PDF como argumento ("Abrir con…"), C# envía `pdf` |
| `idioma` | `idioma` (`es` o `en`) | C# lo guarda en `idioma.txt` y desde ese momento usa ese idioma en diálogos, filtros y errores. No recarga la página (la web se traduce sola). Sin respuesta. Otro valor se ignora |
| `abrir` | — | diálogo Abrir (filtro *.pdf) → `pdf` o nada si cancela |
| `guardar` | `datos` (base64 del PDF), `nombre` (sugerido, ej. `contrato-firmado.pdf`) | diálogo Guardar como (carpeta del archivo original si se conoce) → `guardado {ruta}` o `cancelado` |
| `imprimir` | `datos` (base64) | C# lo escribe en %TEMP%, lo abre en una ventana con WebView2 (visor PDF de Edge) y llama `ShowPrintUI(System)` → `impreso` o `error` |
| `movilIniciar` | `modo?` (`firma` por defecto, o `foto`) | enciende el servidor de red en ese modo → `movilQR {url, qr}` (qr = data URL PNG) o `movilError {mensaje}`. Cada sesión y su token sirven solo para un modo; cualquier otro valor de `modo` vale `firma` |
| `movilCancelar` | — | apaga el servidor |
| `abrirArchivos` | `tipos` (`pdf`\|`imagenes`\|`pdf+imagenes`\|`office`), `multiple` (bool), `titulo`, `id` | diálogo Abrir (imagenes = jpg, jpeg, png, bmp, gif, tif, tiff, webp; office = doc, docx, xls, xlsx, ppt, pptx) → `archivos {lista:[{nombre, datos(base64)}], id}` o `cancelado {id}` |
| `guardarArchivo` | `datos` (base64), `nombre`, `tipo` (`pdf`\|`png`\|`jpg`\|`docx`\|`zip`\|`txt`), `id` | diálogo Guardar como con el filtro del tipo → `guardado {ruta, id}` o `cancelado {id}` |
| `guardarVarios` | `archivos` (`[{nombre, datos}]`), `id` | diálogo de carpeta; escribe todos sin sobrescribir (si existe agrega " (2)", " (3)"…) → `guardado {ruta (carpeta), cantidad, id}` y abre la carpeta en el Explorador; `cancelado {id}` si se cierra el diálogo |
| `elegirCarpeta` | `id`, `titulo` | diálogo de carpeta (recuerda la última) → `carpeta {ruta, id}` o `cancelado {id}`. La carpeta elegida queda "permitida" durante la sesión |
| `escribirEnCarpeta` | `id`, `carpeta` (ruta devuelta por `elegirCarpeta`/`guardarVarios`), `archivos` (`[{nombre, datos}]`) | escribe cada archivo con nombre saneado y sin sobrescribir (" (2)", " (3)"…), fuera del hilo de UI → `escritos {id, nombres:[finales], fallidos, error?}`. Si un archivo falla sigue con los demás. Carpeta no permitida → `error {id}` |
| `abrirCarpeta` | `carpeta` | abre la carpeta en el Explorador (solo carpetas permitidas; si no, no hace nada) |
| `limpiarPdf` | `id`, `datos` (base64) | respaldo: PDFsharp abre y vuelve a guardar (solo objetos alcanzables) → `pdfLimpio {id, datos}` o `error {id, mensaje}` |
| `crearDocx` | `id`, `documento` (`DocumentoWord`, ver abajo), `nombre` | genera el .docx y abre Guardar como (tipo docx) → `guardado {ruta, id}` / `cancelado {id}` / `error {id, mensaje}` |
| `ocr` | `id`, `png` (base64 o data URL), `idioma?` (idioma del DOCUMENTO, independiente del de la interfaz; etiqueta, por defecto `es`) | reconoce texto con Windows.Media.Ocr (asíncrono, sin bloquear) → `ocrResultado {id, resultado}`. Si el idioma no está instalado usa los del perfil de usuario; si no hay ninguno → `error {id}` |
| `ocrIdiomas` | `id` | → `ocrIdiomas {id, idiomas:[etiquetas], tieneEspanol}` |
| `officeDisponible` | `id` | → `office {id, word, excel, powerpoint}` (bool; ¿está instalado cada programa?) |
| `officeAPdf` | `id` | diálogo Abrir (doc, docx, rtf, odt, xls, xlsx, ods, ppt, pptx, odp, solo los de los programas instalados); convierte con el Office instalado (invisible, máx. 2 min) → `pdfDeOffice {id, nombre (con .pdf), datos (base64)}` / `cancelado {id}` / `error {id, mensaje}` (sin Office: error con explicación) |
| `analizarPdf` | `id`, `datos` (base64) | todo en segundo plano → `infoPdf {id, info:{formularios, marcadores, firmaDigital, requiereContrasena, paginas}}` (si pide contraseña solo informa `requiereContrasena`) |
| `comprimirPdf` | `id`, `datos`, `nivel` (`ligera`\|`media`) | → `pdfComprimido {id, datos, antes, despues, imagenes}` (bytes; si no baja, devuelve el original y `antes == despues`) |
| `protegerPdf` | `id`, `datos`, `contrasena` | cifra AES-256 → `pdfProtegido {id, datos}` |
| `quitarContrasena` | `id`, `datos`, `contrasena` | → `pdfSinContrasena {id, datos}` (las páginas se copian a un PDF nuevo: se pierden formularios y marcadores) |
| `sucio` | `valor` (bool) | la interfaz informa cada vez que cambia el estado "hay cambios sin guardar"; C# lo recuerda y, al cerrar la ventana con `valor=true`, pregunta "Tiene cambios sin guardar. ¿Salir sin guardar?" |

Programa → interfaz:
| tipo | campos |
|---|---|
| `pdf` | `nombre` (ej. `contrato.pdf`), `datos` (base64), `protegido` (bool: el PDF pide contraseña; pdf.js la pide al abrirlo) |
| `guardado` | `ruta` (y `cantidad`, `id` si responde a `guardarArchivo`/`guardarVarios`) |
| `archivos` | `lista` `[{nombre, datos}]`, `id` (respuesta a `abrirArchivos`) |
| `carpeta` | `ruta`, `id` (respuesta a `elegirCarpeta`) |
| `escritos` | `id`, `nombres` (nombres finales), `fallidos` (n), `error?` (primer motivo) |
| `pdfLimpio` | `id`, `datos` (base64) |
| `ocrResultado` | `id`, `resultado` `{idioma, anchoImg, altoImg, lineas:[{texto, x, y, ancho, alto, palabras:[{texto, x, y, ancho, alto}]}]}` (píxeles de la imagen enviada) |
| `ocrIdiomas` | `id`, `idiomas`, `tieneEspanol` |
| `office` | `id`, `word`, `excel`, `powerpoint` |
| `pdfDeOffice` | `id`, `nombre`, `datos` (base64) |
| `cancelado` | — (con `id` si responde a una petición con id) |
| `firmaMovil` | `png` (data URL, fondo transparente, recortada) |
| `fotosMovil` | `imagenes` (`[dataURL...]`, de 1 a 10, cada una `data:image/jpeg;base64,...` o `data:image/png;base64,...` ya validada: máx. 4000 px por lado). Solo en modo `foto`. La interfaz pregunta si van dentro de una página (elemento `imagen`) o como páginas nuevas |
| `movilError` | `mensaje` |
| `movilConectado` | — (el celular abrió la página con un código válido; una sola vez por sesión; no revela datos ni consume el código. Se envía en cuanto el GET con token válido llega, por cualquier IP (red o 127.0.0.1), sin mirar cabeceras. La interfaz pasa de «Escanee el código» a «Celular conectado»; al llegar `firmaMovil`/`fotosMovil` muestra vista previa y sigue solo al tocar «Listo») |
| `movilVencido` | — (el código del celular venció a los 5 min; el servidor ya se apagó) |
| `impreso` | — (la impresión se envió a la impresora; ver `imprimir`) |
| `error` | `mensaje` (con `id` si la petición traía id). En `analizarPdf`/`comprimirPdf`/`protegerPdf`/`quitarContrasena` trae además `codigo`: `contrasena` \| `yaProtegido` \| `danado` \| `otro` |

Nombres de archivo (`guardarVarios`, `escribirEnCarpeta`): se quitan rutas, se reemplazan caracteres inválidos, se rechazan vacíos/`.`/`..`, se prefijan con `_` los reservados de Windows (CON, NUL, COM1…), se recortan espacios/puntos finales y el largo máximo es 150. Si el JSON del mensaje no es válido se ignora; si es válido pero algo falla, la respuesta es `error {id, mensaje}` con el id leído. La lectura/escritura de archivos y la conversión base64 corren fuera del hilo de UI.

Los mensajes con `id` (`abrirArchivos`, `guardarArchivo`, `guardarVarios`, `elegirCarpeta`, `escribirEnCarpeta`, `limpiarPdf`) devuelven el mismo `id` en la respuesta; en JS se usan con `pedir(tipo, datos)` (puente.js), que resuelve con la respuesta o `null` si se canceló o hubo error. Sin el programa (modo prueba) abrirArchivos usa un `<input type=file>` y guardarArchivo/guardarVarios descargan. Los mensajes `abrir` y `guardar` siguen igual (sin id).

Arrastrar un PDF a la ventana lo maneja la interfaz (FileReader); no pasa por C#.

## Servidor del celular (Kestrel, solo bajo demanda)
- Escucha en `http://0.0.0.0:47615` (si está ocupado, 47616…47625). Sin admin (Kestrel no usa http.sys).
- IP: la IPv4 de la interfaz activa con puerta de enlace (Wi-Fi/Ethernet, no virtual). URL del QR: `http://<ip>:<puerto>/f/<token>?l=es` (`l` = idioma actual, `es` o `en`; la ruta valida el token igual y la página del celular lee `l`) (token aleatorio de 32 caracteres, de un solo uso, vence a los 5 min).
- `GET /f/{token}` → `movil.html` (si el token no vale: página simple "Este código ya no sirve. Pida uno nuevo en el computador.", en el idioma actual del programa).
- `POST /f/{token}/firma` cuerpo JSON `{png:"data:image/png;base64,..."}` (máx. 3 MB; valida que sea PNG) → 200 `{ok:true}` y envía `firmaMovil` a la interfaz; luego invalida el token y apaga el servidor a los pocos segundos.
- Modo `foto` (`movilIniciar {modo:'foto'}`): `GET /f/{token}` sirve `movil-foto.html` (misma URL y mismo token de un solo uso, 5 min). `POST /f/{token}/fotos` cuerpo JSON `{fotos:["data:image/jpeg;base64,...", ...]}` (1 a 10; límite de cuerpo 25 MB en este modo, 3 MB en modo firma) → 200 `{ok:true}` y envía `fotosMovil {imagenes}`; luego invalida el token y apaga el servidor. Solo JPEG (`FF D8 FF`, dimensiones leídas del marcador SOF; si no se encuentran se rechaza) o PNG (IHDR); máx. 4000 px por lado; el tipo se decide por los bytes, no por el encabezado del data URL. En modo foto `/firma` da 404 y en modo firma `/fotos` da 404.
- Cualquier otra ruta → 404. No sirve nada más (la interfaz del PC NO es accesible desde la red).
- Al cerrar el programa se apaga.

## Página del celular (movil.html)
Antes de firmar hay dos botones grandes «Azul» (#1E3A8A, por defecto) y «Negro» (#111111); al cambiar se redibujan los trazos y el PNG enviado lleva ese color; la elección se recuerda en `localStorage` (`pepepdf.colorFirma`).

Diálogo del QR en el PC: en los pasos 1 y 2 el botón «Aceptar» cierra el diálogo SIN enviar `movilCancelar` (el servidor sigue hasta que llegue algo o venza); lo que llegue después (`firmaMovil`/`fotosMovil`) se carga igual: aviso, y «Guardar esta firma»/pregunta de fotos cuando no haya otro modal ni un elemento por colocar. «Cancelar» sí apaga. Prueba: `FIRMARPDF_PRUEBA_VIGENCIA_S` acorta la vigencia (segundos).
Pantalla blanca completa para firmar con el dedo; arriba "Firme aquí con el dedo"; abajo botones grandes "Borrar" y "Enviar al computador". `touch-action:none`, sin scroll ni zoom, alta resolución (devicePixelRatio). Trazo negro/azul oscuro suave. Al enviar: recorta al contenido con margen, PNG transparente, POST a `location.pathname + '/firma'`, y muestra "¡Listo! Mire el computador.". Funciona sin librerías, autocontenida (estilos de la suite copiados en línea).

## Página de fotos del celular (movil-foto.html)
Mismo estilo y esquema de idioma (`?l=`) que `movil.html`. Botones grandes "Tomar foto" (`capture=environment`) y "Elegir de la galería" (`multiple`); hasta 10 fotos en miniatura con X para quitarlas; cada foto se reduce en el celular (lado mayor 2000 px, JPEG calidad 0,85, orientación EXIF respetada) y "Enviar" muestra progreso. No bloquea `touchstart` a nivel de documento. En el PC (`jsotomovil.js`): "Rellenar → Foto del celular" y tarjeta en Herramientas → Páginas; al llegar las fotos se elige "Ponerla en la página" (elemento `imagen` `{tipo:'imagen', src (dataURL), x,y,w,h}` que se coloca con clic como la firma, una tras otra) o "Agregar como página nueva" (una página por foto al final, tamaño de la primera página con margen de 10 mm, con deshacer).

## DocumentoWord (mensaje `crearDocx`, camelCase)
```
{ titulo, paginas: [ { anchoPt, altoPt, bloques: [
  { tipo: "parrafo"|"imagen"|"saltoPagina", alineacion: "izq"|"centro"|"der"|"just", sangriaPt, espacioAntesPt,
    runs: [ { texto, tamPt, negrita, cursiva, subrayado, fuente, color: "#rrggbb" } ],
    imagenPng (base64), anchoImgPt, altoImgPt } ] } ] }
```
Cada página = una sección del .docx con su tamaño y orientación (márgenes de 2 cm) y salto de sección entre páginas. Fuentes: Arial/Helvetica→Arial, Times→Times New Roman, Courier→Courier New, otras→Calibri. Las imágenes van en línea y se reducen al ancho útil si lo superan. Se eliminan los caracteres de control no válidos en XML. Motor: `src\Motor\Word.cs` (DocumentFormat.OpenXml, MIT), `Ocr.cs` (Windows.Media.Ocr, requiere net8.0-windows10.0.19041.0), `Office.cs` (COM con late binding).
