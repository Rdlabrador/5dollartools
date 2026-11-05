// OCR con el framework Vision de macOS (10.15 o superior). JXA: se ejecuta con osascript.
// Uso a mano:
//   osascript -l JavaScript mac/scripts/ocr.js imagen.png es-ES    -> JSON del reconocimiento por stdout
//   osascript -l JavaScript mac/scripts/ocr.js --idiomas           -> JSON con las etiquetas de idioma soportadas
// Coordenadas en pixeles de la imagen, origen arriba-izquierda (Vision usa origen abajo-izquierda normalizado).
// Si Vision no existe sale con el error VISION_NO_DISPONIBLE (el programa lo convierte en "OCR no disponible").
ObjC.import('Foundation');
ObjC.import('AppKit');

function cargarVision() {
  try { ObjC.import('Vision'); } catch (e) { throw new Error('VISION_NO_DISPONIBLE'); }
  if (typeof $.VNRecognizeTextRequest === 'undefined' || typeof $.VNImageRequestHandler === 'undefined')
    throw new Error('VISION_NO_DISPONIBLE');
}

function idiomasSoportados(req) {
  try {
    var err = Ref();
    var arr = req.supportedRecognitionLanguagesAndReturnError(err);
    var lista = [];
    for (var i = 0; i < arr.count; i++) lista.push(ObjC.unwrap(arr.objectAtIndex(i)));
    if (lista.length) return lista;
  } catch (e) { /* macOS anterior a 12: sin consulta */ }
  return ['en-US'];
}

// Elige la etiqueta soportada que mejor coincide con la pedida (exacta o por idioma base).
function elegirIdioma(pedido, soportados) {
  if (!pedido) return null;
  var p = String(pedido).toLowerCase();
  var base = p.split(/[-_]/)[0];
  for (var i = 0; i < soportados.length; i++) if (soportados[i].toLowerCase() === p) return soportados[i];
  for (var j = 0; j < soportados.length; j++) if (soportados[j].toLowerCase().split(/[-_]/)[0] === base) return soportados[j];
  return null;
}

function run(argv) {
  cargarVision();
  var req = $.VNRecognizeTextRequest.alloc.init;

  if (argv[0] === '--idiomas') return JSON.stringify(idiomasSoportados(req));

  var ruta = argv[0];
  if (!ruta) throw new Error('Falta la ruta de la imagen');
  var url = $.NSURL.fileURLWithPath(ruta);
  var rep = $.NSBitmapImageRep.imageRepWithContentsOfURL(url);
  var W = Number(rep.pixelsWide), H = Number(rep.pixelsHigh);
  if (!(W > 0 && H > 0)) throw new Error('No se pudo leer la imagen');

  var soportados = idiomasSoportados(req);
  var idioma = elegirIdioma(argv[1], soportados);
  req.recognitionLevel = 0;            // VNRequestTextRecognitionLevelAccurate
  req.usesLanguageCorrection = true;
  if (idioma) req.recognitionLanguages = $([idioma]);
  else { try { req.automaticallyDetectsLanguage = true; } catch (e) { /* macOS < 13 */ } }

  var handler = $.VNImageRequestHandler.alloc.initWithURLOptions(url, $({}));
  var err = Ref();
  var ok = handler.performRequestsError($([req]), err);
  if (!ok) throw new Error('Vision no pudo reconocer la imagen');

  var lineas = [];
  var res = req.results;
  var n = res ? Number(res.count) : 0;
  for (var i = 0; i < n; i++) {
    var obs = res.objectAtIndex(i);
    var cands = obs.topCandidates(1);
    if (!cands || Number(cands.count) < 1) continue;
    var cand = cands.objectAtIndex(0);
    var texto = ObjC.unwrap(cand.string);
    if (!texto || !texto.trim()) continue;
    var bb = obs.boundingBox;
    var L = { x: bb.origin.x * W, y: (1 - bb.origin.y - bb.size.height) * H, ancho: bb.size.width * W, alto: bb.size.height * H };

    // Palabras: se separan por espacios (indices UTF-16, iguales en JS y NSString) y cada una pide su caja a Vision.
    var palabras = [];
    var re = /\S+/g, m;
    while ((m = re.exec(texto)) !== null) {
      var caja = null;
      try {
        var e2 = Ref();
        var sub = cand.boundingBoxForRangeError($.NSMakeRange(m.index, m[0].length), e2);
        var b = sub.boundingBox;
        caja = { x: b.origin.x * W, y: (1 - b.origin.y - b.size.height) * H, ancho: b.size.width * W, alto: b.size.height * H };
      } catch (e) { caja = null; }
      if (!caja || !(caja.ancho > 0)) {
        // Respaldo: reparto proporcional al largo del texto dentro de la caja de la linea.
        var f0 = m.index / texto.length, f1 = (m.index + m[0].length) / texto.length;
        caja = { x: L.x + L.ancho * f0, y: L.y, ancho: L.ancho * (f1 - f0), alto: L.alto };
      }
      palabras.push({ texto: m[0], x: caja.x, y: caja.y, ancho: caja.ancho, alto: caja.alto });
    }
    if (!palabras.length) continue;
    lineas.push({ texto: texto, x: L.x, y: L.y, ancho: L.ancho, alto: L.alto, palabras: palabras });
  }
  // Vision suele entregar las lineas de arriba hacia abajo; se ordena por si acaso.
  lineas.sort(function (a, b) { return a.y - b.y || a.x - b.x; });
  return JSON.stringify({ idioma: idioma || '', anchoImg: W, altoImg: H, lineas: lineas });
}
