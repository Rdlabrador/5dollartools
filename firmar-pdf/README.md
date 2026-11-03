# PepePDF

Programa para Windows que permite abrir un PDF, llenarlo, firmarlo, anotarlo, cambiarle las páginas y guardarlo.
Funciona sin internet. Está en español e inglés.

**Descargar el instalador:** https://github.com/Rdlabrador/5dollartools/raw/main/firmar-pdf/descargar/PepePDF-Setup.exe
(No pide permisos de administrador. Crea el acceso directo del escritorio y del menú Inicio, y agrega PepePDF a "Abrir con" para los PDF.
Para desinstalarlo: Configuración → Aplicaciones → PepePDF. Las firmas guardadas no se borran.)
Para rearmar el instalador después de cambiar el código: `instalador\crear-instalador.bat`.

Parte de la suite 5dollartools. Se distribuye como programa, no está en la web.

---

# Parte 1: Cómo usarlo

## Antes de empezar

1. Instale el programa con `PepePDF-Setup.exe` (doble clic y siga los pasos). Después ábralo con el acceso directo **PepePDF** del escritorio o del menú Inicio.
2. Si Windows muestra una advertencia azul al instalar, pulse "Más información" y luego "Ejecutar de todas formas".
3. Si el programa dice que falta el componente **WebView2**, pulse el enlace que aparece.
   Instálelo y vuelva a abrir el programa. En Windows 10 y 11 al día, normalmente ya está.

## Cambiar el idioma

1. Al abrir, el programa usa el idioma de Windows: español o inglés.
2. Para cambiarlo, pulse el botón con el **globo** que está al final de la barra de arriba. Alterna entre **ES** y **EN**.
3. El documento no se cierra. El programa recuerda la elección la próxima vez.

Notas:

- Las fechas cambian de forma. En español: `03-11-2026`. En inglés: `11/03/2026`.
- El celular usa el mismo idioma que el computador.
- El OCR pregunta el idioma del documento. Es otra cosa: no cambia el idioma del programa.

## La barra de arriba

El programa tiene fondo claro y botones con íconos de línea, en azul tinta. La barra de arriba está en una sola fila:

- **Abrir**: abre un PDF.
- **Guardar**: guarda el documento.
- **Imprimir**: envía el documento a la impresora.
- **Firmar**: pone su firma. Es el botón grande.
- **Rellenar**: abre un menú con **Texto**, **Fecha**, **Anotar** y **Foto del celular**.
- **Buscar**: busca una palabra.
- **Herramientas**: otras acciones para el documento.
- **Páginas**: muestra u oculta las páginas en miniatura a la izquierda.
- **Globo**: cambia el idioma (ES / EN).

La barra de abajo, flotante, tiene:

- **↶ y ↷**: deshacer y rehacer.
- **−, +, Ajustar**: alejar, acercar y ajustar al ancho.
- **Página X de N**: dice en qué página está y cuántas tiene.

## Abrir un PDF

Hay tres formas:

1. Pulse el botón **Abrir** y busque el archivo.
2. Arrastre el PDF hasta la ventana del programa.
3. Haga clic derecho sobre el PDF en el Explorador de Windows, elija **Abrir con** y luego **PepePDF**.

Si el programa está vacío, también puede empezar con **Herramientas**, y elegir **Unir PDF** o **Imágenes a PDF**. Así crea un documento nuevo.

## Leer el documento

1. Use las flechas para pasar de página.
2. Use los botones **+** y **−** para acercar o alejar. Están abajo.
3. Pulse **Ajustar** para que el documento ocupe todo el ancho de la ventana.

## Buscar una palabra

1. Pulse **Buscar** (o **Ctrl + F**).
2. Escriba la palabra.
3. Pulse **Siguiente** o **Anterior** para ir de un resultado a otro. También sirve la tecla **Enter**.
4. Para cerrar, pulse **Cerrar** o la tecla **Esc**.

## Llenar un formulario

1. Haga clic en el campo que quiere llenar y escriba.
2. Si el PDF tiene casillas o listas, haga clic en ellas como en cualquier formulario.

## Agregar texto o fecha

1. Pulse **Rellenar**, y luego **Texto** o **Fecha**.
2. El texto aparece en el documento. Arrástrelo al lugar que quiera.
3. Para la fecha, el programa pone el día de hoy, con el formato de su idioma.

## Agregar fotos desde el celular

Sirve para poner una foto tomada con el celular dentro del documento, o agregarla como página nueva.

1. Pulse **Rellenar**, y luego **Foto del celular**. También está en **Herramientas**.
2. Aparece un código QR (un cuadro con puntos).
3. Con el celular, abra la cámara y apunte al código. Toque el aviso que aparece.
4. En el celular, tome o elija hasta **10 fotos** y envíelas.
5. En el computador aparecen las fotos. Para cada una, elija:
   - **Ponerla en la página**: la foto se coloca en la página y se ajusta igual que la firma.
   - **Agregar como página nueva**: la foto queda como página nueva al final del documento.

Notas importantes:

- Las fotos se achican en el celular a 2000 px antes de enviarse. Así el envío es más rápido.
- Como con la firma, el celular y el computador deben estar en **la misma Wi-Fi**.
- Si Windows pregunta por el Firewall, marque **redes privadas** y pulse **Permitir**.

## Firmar

Hay tres formas de firmar. Elija la que le resulte más fácil.

### Opción A: firmar con el mouse

1. Pulse **Firmar**, y luego **Con el mouse**.
2. Dibuje su firma en el recuadro.
3. Elija el color: **Negro** o **Azul**.
4. Si se equivoca, pulse **Borrar** y vuelva a dibujar.
5. Pulse **Listo**.
6. Haga clic en el lugar del documento donde va la firma.

### Opción B: firmar con el celular

Use esta opción si no tiene mouse o si prefiere firmar con el dedo.

1. Su computador y su celular deben estar en **la misma Wi-Fi**.
2. Pulse **Firmar**, y luego **Con el celular**.
3. Aparece un código QR (un cuadro con puntos).
4. Con el celular, abra la cámara y apunte al código. Toque el aviso que aparece.
5. En el celular se abre una hoja en blanco. Firme con el dedo.
6. Pulse **Enviar al computador**.
7. La firma llega al computador. Haga clic en el lugar del documento donde va.

Notas importantes:

- El código sirve **una sola vez**.
- El código vence a los **5 minutos**. Si vence, pulse **Crear código nuevo**.
- La primera vez, Windows puede preguntar si permite el programa en la red (Firewall).
  Marque **redes privadas** y pulse **Permitir**.
- Nada sale por internet. Todo pasa dentro de su Wi-Fi.

### Opción C: usar la firma guardada

1. Pulse **Firmar**, y luego **Usar mi firma guardada**.
2. Haga clic en el lugar del documento donde va la firma.

La última firma queda guardada en este computador. Si nunca firmó aquí, esta opción no aparece.

## Anotar

1. Pulse **Rellenar**, y luego **Anotar**. Aparece una barra con las herramientas.
2. Elija una herramienta:
   - **Resaltar**: marca el texto con color. Seleccione el texto con el mouse.
   - **Subrayar** y **Tachar**: hacen lo mismo con una línea. Seleccione el texto primero.
   - **Dibujar**: haga trazos a mano.
   - **Rectángulo** y **Flecha**: dibujan esas formas con el mouse.
   - **Nota**: pone un comentario. Queda como comentario real dentro del PDF.
3. Elija el **color** y el **grosor** (Fino, Medio o Grueso) de la barra.
4. Pulse **Cerrar** (o **Esc**) cuando termine.

Las anotaciones se pueden mover, agrandar y borrar igual que la firma.

## Marca de agua y números de página

Están en **Herramientas**, grupo **Anotar**.

- **Marca de agua**: escriba una palabra grande, como "COPIA" o "BORRADOR".
- **Números de página**: numera todas las páginas.

## Mover, agrandar o borrar

1. Haga clic sobre el texto, la fecha, la firma, la foto o la anotación.
2. Arrástrelo para moverlo.
3. Para agrandarlo o achicarlo, use las esquinas.
4. Para borrarlo, selecciónelo y pulse la tecla **Supr**.

## Trabajar con las páginas

Pulse **Páginas** para ver las miniaturas a la izquierda. Puede:

- **Girar** una página a la derecha o a la izquierda.
- **Borrar** las páginas marcadas.
- **Subir** o **Bajar** una página un lugar.
- **Arrastrar** una página para cambiarla de lugar.
- **Insertar página en blanco**: la agrega después de la marcada.
- **Extraer**: guarda las páginas marcadas en un PDF nuevo.
- **Marcar varias**: haga clic en la casilla de cada página. Use **Marcar todas** o **Quitar marcas** para marcar o desmarcar todas.

Los cambios de páginas también se pueden deshacer.

## Herramientas

Pulse **Herramientas**. Las acciones están en cuatro grupos.

**Páginas**

- **Unir PDF**: junta varios PDF o imágenes en un solo documento.
- **Imágenes a PDF**: convierte fotos en un PDF.
- **Foto del celular**: agrega fotos tomadas con el celular (ver arriba).
- **Dividir PDF**: separa el documento en varios archivos.
- **Extraer páginas**: guarda algunas páginas en un PDF nuevo.
- **Girar páginas**: da vuelta las páginas que están de lado.
- **Borrar páginas**: quita las páginas que no necesita.
- **Exportar a imagen**: guarda las páginas como fotos JPG o PNG. Elija una carpeta. Verá el progreso y puede pulsar **Cancelar**.

**Anotar**

- **Marca de agua** y **Números de página** (ver arriba).

**Proteger**

- **Comprimir PDF**: lo hace más liviano para enviarlo. Elija **Ligera**, **Media** o **Fuerte**.
  - Con **Fuerte**, las páginas se vuelven imágenes. El texto ya no se puede seleccionar ni buscar.
- **Poner contraseña**: solo quien la sepa podrá abrir el archivo. Se usa cifrado AES-256. El programa guarda una copia del original.
- **Quitar contraseña**: deja el archivo abierto para editarlo y guardarlo. Al abrir un PDF protegido, el programa también ofrece esta opción.
  - Se pierden los formularios y los marcadores del PDF.
- **Ocultar información**: tape datos que no deben verse (ver abajo).

**Convertir**

- **PDF a Word**: pasa el documento a Word para editarlo.
  - Es una conversión aproximada. Las tablas y las columnas pueden cambiar. El color del texto no se conserva.
- **Hacer el PDF buscable (OCR)**: sirve para documentos escaneados. Así se puede buscar y copiar el texto.
  - Primero le pregunta en qué idioma está el documento (español o inglés).
  - Necesita ese idioma instalado en Windows, con **Reconocimiento de texto**.
- **Copiar todo el texto**: copia el texto para pegarlo en otro programa.
- **Guardar como texto (.txt)**: guarda solo el texto en un archivo simple.
- **Word, Excel o PowerPoint a PDF**: convierte esos archivos en PDF.
  - Necesita tener Office instalado en el computador.
  - No acepta archivos con macros ni con contraseña. Las macros quedan desactivadas.
- **Exportar a imagen (JPG/PNG)** y **Imágenes a PDF**: igual que en Páginas.

## Ocultar información

Sirve para tapar algo que no debe verse nunca. Por ejemplo, un número de cuenta.

1. Pulse **Herramientas**, luego **Proteger** y **Ocultar información**.
2. Dibuje recuadros negros sobre lo que quiere tapar.
3. Pulse **Aplicar y ocultar para siempre**.
4. El programa convierte esas páginas en imagen y borra el texto que había debajo. No queda nada para copiar.

Notas importantes:

- Si hay recuadros sin aplicar, el programa **no deja guardar, exportar ni copiar**. Primero pulse **Aplicar**.
- Hay una casilla que viene marcada: **Borrar también el título, asunto, palabras clave y marcadores del documento**. Déjela marcada si no quiere que esos datos queden en el archivo.

## Deshacer y rehacer

- Para deshacer, pulse **Ctrl + Z** (o la flecha **↶**, abajo).
- Para rehacer, pulse **Ctrl + Y** (o la flecha **↷**, abajo).

Sirve también para los cambios de páginas.

## Guardar

Pulse **Guardar**. Aparecen dos opciones:

- **Guardar**: guarda el PDF y se puede seguir editando.
- **Guardar versión final**: guarda el PDF cerrado. Después no se puede cambiar nada.
  Use esta opción cuando termine.

El programa le pide dónde guardar el archivo. También funciona **Ctrl + S**.

Si intenta cerrar la ventana con cambios sin guardar, el programa le pregunta antes.

## Imprimir

1. Pulse **Imprimir**.
2. Se abre la ventana de impresión de Windows.
3. Elija la impresora y pulse **Imprimir**.

## Problemas comunes

| Lo que pasa | Qué hacer |
|---|---|
| El celular no abre el código | Revise que el celular esté en la misma Wi-Fi que el computador. |
| Windows bloqueó la conexión | Permita el programa en **redes privadas** (ver arriba). |
| Dice "Este código ya no sirve" | Pulse **Crear código nuevo** en el computador. |
| El programa no abre un PDF | Puede que el PDF tenga contraseña o que sea un formulario especial (ver Límites). |
| Pide contraseña al abrir | Escríbala. Si no la tiene, no se puede abrir. |
| No deja guardar | Revise si hay recuadros de **Ocultar información** sin aplicar. Pulse **Aplicar**. |
| El OCR no reconoce el idioma | Elija el idioma correcto al empezar. Instale ese idioma con **Reconocimiento de texto** en la configuración de Windows. |
| Word, Excel o PowerPoint no convierte | Revise que Office esté instalado. El archivo no debe tener macros ni contraseña. |
| Falta WebView2 | Pulse el enlace que aparece y vuelva a abrir el programa. |
| Quiero el programa en otro idioma | Pulse el globo (ES / EN) al final de la barra de arriba. |

## Límites

- La firma dibujada es una imagen. **No es una firma electrónica avanzada**. Si un banco o una notaría pide una firma certificada, pregunte qué tipo de firma acepta.
- Hay formularios de tipo **XFA (Adobe LiveCycle)** que este programa no puede llenar.
- Un PDF con **contraseña** se puede leer, pero no se puede guardar sin quitarla antes.
- **PDF a Word** es aproximado. Revise el resultado.
- **Comprimir (Fuerte)** y **Ocultar información** convierten páginas en imagen. Ya no se puede copiar ni buscar ese texto.
- **Word, Excel o PowerPoint a PDF** necesita Office instalado.

---

# Parte 2: Para quien mantiene el código

## Requisitos

- Windows 10 u 11 actualizado.
- WebView2 Runtime (viene con Windows actualizado).
- Para compilar: .NET 8 SDK.
- Opcionales, para ciertas funciones:
  - Office instalado (para Word, Excel o PowerPoint a PDF).
  - Idioma con "Reconocimiento de texto" instalado (para el OCR).

## Estructura

```
firmar-pdf\
  README.md                  este archivo
  CONTRATO.md                mensajes entre C# y la interfaz (leer antes de cambiar algo)
  src\
    FirmarPdf.csproj         target net8.0-windows10.0.19041.0 (AssemblyName: PepePDF)
    Program.cs               arranque
    VentanaPrincipal.cs      ventana WinForms con WebView2
    ServidorMovil.cs         servidor Kestrel para el celular (solo bajo demanda)
    Impresion.cs             impresión mediante ShowPrintUI
    Recursos.cs              lectura de los recursos incrustados
    Nombres.cs               nombres de archivo seguros (sin rutas, sin nombres reservados)
    Textos.cs                todos los textos del C# en español e inglés, y el idioma actual
    Motor\
      OperacionesPdf.cs      operaciones de PDF (unir, dividir, girar, comprimir, contraseñas)
      Word.cs                PDF a Word y DocumentoWord a .docx (DocumentFormat.OpenXml)
      Ocr.cs                 OCR con Windows.Media.Ocr
      Office.cs              Word, Excel o PowerPoint a PDF (COM con late binding)
    icono.ico
    wwwroot\                 interfaz (se incrusta dentro del exe)
      index.html, app.css    interfaz del PC
      movil.html             página del celular
      js\                    módulos de la interfaz (ver lista abajo)
      lib\                   librerías locales (ver abajo)
```

Módulos de `wwwroot\js\`:

- `main.js`: arranque y conexión de los botones de la barra.
- `i18n.js`: idioma de la interfaz (es / en) y textos. Ver "Idioma" abajo.
- `textos-index.js`: textos fijos del HTML (`index.html`). Se importa antes de `traducirDOM()`, en `main.js`.
- `iconos.js`: íconos de línea (SVG en el propio código). Se usan con `data-ic`.
- `menus.js`: menú desplegable **Rellenar** y selector de idioma (globo). Solo abre y cierra el menú; cada opción conserva su botón y su función.
- `estado.js`: estado compartido (documento, página, zoom, cambios sin guardar).
- `util.js`: funciones pequeñas comunes.
- `puente.js`: mensajes con C# (`pedir` y respuestas con `id`).
- `visor.js`: visor de pdf.js, zoom y páginas.
- `miniaturas.js`: panel lateral de páginas.
- `paginas.js`: acciones de páginas y las herramientas del grupo Páginas.
- `documento.js`: carga del documento y datos del PDF.
- `elementos.js`: texto, fecha, firma e imágenes puestos sobre la página (mover, borrar).
- `firmar.js`: firma con mouse, celular y firma guardada.
- `fotomovil.js`: fotos del celular. Llegan con código QR y se ponen en la página (como la firma) o como páginas nuevas al final, con margen de 10 mm.
- `anotar.js`: barra y herramientas de Anotar.
- `dibujo.js`: geometría y dibujo de las anotaciones (también usado al guardar).
- `marcas.js`: marca de agua y números de página.
- `ocultos.js`: recuadros de Ocultar información.
- `proteger.js`: comprimir, contraseñas y Ocultar información aplicado.
- `convertir.js`: PDF a Word, OCR, texto, imagen y Office.
- `buscar.js`: barra de búsqueda.
- `guardar.js`: guardar, versión final y construcción del PDF.
- `historial.js`: deshacer y rehacer.
- `herramientas.js`: menú Herramientas. Función `registrarHerramienta`.
- `teclado.js`: atajos (Ctrl+Z, Ctrl+Y, Ctrl+F, Ctrl+S, Esc, Supr).
- `pruebas.js`: expone `window.__fp` para pruebas.

Todo lo de `wwwroot` va **dentro del exe** (EmbeddedResource). No hay archivos sueltos.
Después de cambiar la interfaz, hay que compilar y publicar de nuevo.

## Idioma (es / en)

Textos de la interfaz (`i18n.js`):

- `agregar({es: {...}, en: {...}})`: registra los textos de un módulo. Las claves llevan el prefijo del módulo, por ejemplo `'paginas.unir'`.
- `t('clave', {var})`: devuelve el texto. `{var}` se reemplaza por el valor.
- `tn('clave', n)`: plural. Usa `'clave.1'` si `n` es 1, y `'clave.n'` en otro caso. `{n}` queda disponible.
- HTML fijo: `data-i18n` (texto), y también `data-i18n-title`, `data-i18n-placeholder`, `data-i18n-alt` y `data-i18n-aria`. Si pone `data-i18n` en un `<span>`, no borra los íconos vecinos.
- `cambiarIdioma(l)`: cambia el idioma sin recargar. Avisa a C#, traduce el HTML y emite el evento `idioma`. Los módulos que dibujan texto en pantalla deben escuchar `on('idioma', ...)` y volver a pintarlo.
- `fechaLocal()`: fecha de hoy en formato del idioma (es: `03-11-2026`, en: `11/03/2026`).
- Si falta una clave en inglés, se usa el español. Si falta en los dos, se muestra la clave y sale un aviso en la consola.
- El idioma inicial llega en la URL (`?idioma=es` o `?idioma=en`), que pone el programa de Windows. En pruebas con Chrome, sin ese parámetro, se usa el idioma del navegador.

Textos de C# (`Textos.cs`):

- `Textos.T("clave")` o `Textos.T("clave", arg0, arg1)`: formato con `{0}`, `{1}`.
- `Textos.Iniciar(carpeta)`: al arrancar, lee `idioma.txt`. Si no existe, usa el idioma de Windows.
- `Textos.Cambiar(l)`: cambia el idioma y lo guarda en `idioma.txt`.

Regla: no escriba textos en español directamente en el código. Va en `agregar` (JS) o en `Textos.cs` (C#), en los dos idiomas.

## Librerías

| Librería | Versión | Licencia | Dónde |
|---|---|---|---|
| pdf.js | 6.5.438 | Apache-2.0 | `wwwroot\lib\pdfjs\` |
| pdf-lib | 1.17.1 | MIT | `wwwroot\lib\pdf-lib.min.js` |
| suite.css | propio de la suite | - | `wwwroot\lib\suite.css` |
| Microsoft.Web.WebView2 (NuGet) | 1.0.4314.35 | MIT | referencia del csproj |
| QRCoder (NuGet) | 1.8.1 | MIT | referencia del csproj |
| PDFsharp (NuGet) | 6.2.4 | MIT | referencia del csproj |
| DocumentFormat.OpenXml (NuGet) | 3.5.1 | MIT | referencia del csproj |

Advertencia: **no actualice PDFsharp a 6.5 o más**. Desde esa versión la licencia es AGPL.

Windows.Media.Ocr viene con Windows. Office→PDF usa el Office instalado, por COM con late binding.

## Compilar y publicar

Desde la carpeta `src`:

```
dotnet build
dotnet publish -c Release
```

El exe queda en:

```
src\bin\Release\net8.0-windows10.0.19041.0\win-x64\publish\PepePDF.exe
```

Tamaño aproximado: 85 MB. Es grande porque lleva dentro pdf.js y pdf-lib.

## Cómo se comunican C# y la interfaz

- La interfaz (HTML/JS) manda mensajes con `window.chrome.webview.postMessage`.
- C# responde con `PostWebMessageAsJson`.
- La lista completa de mensajes (nombres, campos y respuestas) está en `CONTRATO.md`.
- Los mensajes con `id` se piden con `pedir(tipo, datos)` en `puente.js`.
- Al cambiar de idioma, la interfaz manda `{tipo: 'idioma', idioma: 'en'}` (o `'es'`). C# lo guarda en `idioma.txt`.

Reglas de la interfaz:

- Botones grandes (mínimo 48 px de alto).
- Letra base de 18 px.
- Mensajes cortos, en español (y su versión en inglés).

Para agregar una herramienta nueva al menú Herramientas, llame a `registrarHerramienta({id, grupo, titulo, descripcion, icono, accion})` en el módulo que corresponda. Grupos: `Páginas`, `Anotar`, `Convertir`, `Proteger`.

## Servidor del celular

- Escucha en `http://0.0.0.0:47615`. Si el puerto está ocupado, prueba del 47616 al 47625.
- No necesita permisos de administrador.
- Solo se enciende cuando el usuario pulsa **Con el celular** o **Foto del celular**.
- Cada código sirve una vez y vence a los 5 minutos.
- La interfaz del PC no es accesible desde la red. Solo la página del celular.
- Al cerrar el programa, el servidor se apaga.
- Las fotos llegan redimensionadas a 2000 px desde el celular.

## Pruebas

1. Cierre cualquier instancia abierta del programa.
2. Ejecute el exe con la variable de entorno:

   ```
   WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333
   ```

3. Conecte DevTools al puerto 9333 y controle la interfaz.
4. La interfaz expone `window.__fp` para hacer pruebas desde DevTools.
5. Para probar en inglés en Chrome, abra la página con `?idioma=en`.

En Release, F12 y el menú contextual de depuración están desactivados.

Variables solo para pruebas (Debug). Conservan su nombre anterior:

- `FIRMARPDF_PRUEBA_GUARDAR=<carpeta>`: guarda en esa carpeta sin mostrar el diálogo.
- `FIRMARPDF_DATOS=<carpeta>`: usa otra carpeta de datos. Así no se bloquea el programa que usa el usuario.

Para pruebas con el programa abierto, láncelo minimizado y ciérrelo por PID.

Pendiente: la conversión Word, Excel o PowerPoint a PDF no se ha probado con Office real.

## Datos del usuario

La carpeta de datos es `%LOCALAPPDATA%\FirmarPDF` (conserva el nombre anterior). Ahí está:

- `idioma.txt`: el idioma elegido (`es` o `en`).
- `ultima-carpeta.txt`: la última carpeta usada.
- `WebView2\`: los datos del navegador interno. Ahí se guarda `localStorage`, incluida la última firma.

Para borrar la firma guardada, o para que el programa olvide el idioma y la última carpeta, borre esa carpeta con el programa cerrado. Se borra todo lo que guardó el programa.

## Cambios frecuentes

- **Cambiar un mensaje**: edite `CONTRATO.md` y los dos lados (C# y JS).
- **Cambiar un texto visible**: agréguelo o cámbielo en los dos idiomas, en `agregar` (JS) o en `Textos.cs` (C#).
- **Cambiar la interfaz**: edite `wwwroot`, compile y publique.
- **Cambiar el diseño**: use las variables de `suite.css` (`--accent #f5c400`, `--bg`, `--panel`, etc.).
- **Agregar una herramienta**: use `registrarHerramienta` (ver arriba). Si necesita un mensaje nuevo, agréguelo a `CONTRATO.md` primero.
